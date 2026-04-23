import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { ok, badRequest, notFound, serverError } from '../utils/response';

// GET /seller/profile - 셀러 프로필 + 통계
export const getSellerProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = await prisma.sellerProfile.findUnique({
      where: { userId: req.user!.userId },
      include: {
        user: { select: { name: true, phone: true, referralCode: true, createdAt: true } },
      },
    });

    if (!profile) {
      notFound(res, '셀러 프로필을 찾을 수 없습니다');
      return;
    }

    const [orderCount, clickCount] = await Promise.all([
      prisma.order.count({ where: { sellerId: req.user!.userId } }),
      prisma.sellerReferralClick.count({ where: { sellerId: req.user!.userId } }),
    ]);

    const convertedCount = await prisma.sellerReferralClick.count({
      where: { sellerId: req.user!.userId, converted: true },
    });

    ok(res, {
      ...profile,
      stats: {
        totalOrders: orderCount,
        totalClicks: clickCount,
        convertedClicks: convertedCount,
        conversionRate: clickCount > 0 ? Math.round((convertedCount / clickCount) * 100) : 0,
      },
    });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// GET /seller/commissions - 수수료 내역
export const getSellerCommissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = { sellerId: req.user!.userId };
    if (status) where.status = status;

    const [commissions, total] = await Promise.all([
      prisma.sellerCommission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          order: {
            select: {
              orderNumber: true,
              price: true,
              productName: true,
              status: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.sellerCommission.count({ where }),
    ]);

    ok(res, { commissions, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// GET /seller/orders - 내 링크로 유입된 주문 목록
export const getSellerOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { sellerId: req.user!.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        select: {
          id: true,
          orderNumber: true,
          price: true,
          sellerAmount: true,
          productName: true,
          status: true,
          createdAt: true,
          sellerCommission: { select: { status: true, commissionAmount: true } },
        },
      }),
      prisma.order.count({ where: { sellerId: req.user!.userId } }),
    ]);

    ok(res, { orders, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// GET /seller/stats - 기간별 통계
export const getSellerStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = '30' } = req.query;
    const days = Number(period);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [orders, commissions, clicks] = await Promise.all([
      prisma.order.findMany({
        where: { sellerId: req.user!.userId, createdAt: { gte: since } },
        select: { price: true, sellerAmount: true, status: true, createdAt: true },
      }),
      prisma.sellerCommission.aggregate({
        where: { sellerId: req.user!.userId, createdAt: { gte: since } },
        _sum: { commissionAmount: true },
        _count: true,
      }),
      prisma.sellerReferralClick.count({
        where: { sellerId: req.user!.userId, clickedAt: { gte: since } },
      }),
    ]);

    const convertedClicks = await prisma.sellerReferralClick.count({
      where: { sellerId: req.user!.userId, clickedAt: { gte: since }, converted: true },
    });

    ok(res, {
      period: days,
      orderCount: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + o.price, 0),
      totalCommission: commissions._sum.commissionAmount ?? 0,
      clicks,
      convertedClicks,
      conversionRate: clicks > 0 ? Math.round((convertedClicks / clicks) * 100) : 0,
    });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// POST /seller/track-click - 추천 링크 클릭 추적
export const trackReferralClick = async (req: Request, res: Response): Promise<void> => {
  try {
    const { referralCode } = req.body;
    if (!referralCode) {
      badRequest(res, '추천 코드가 필요합니다');
      return;
    }

    const seller = await prisma.user.findUnique({ where: { referralCode } });
    if (!seller) {
      notFound(res, '유효하지 않은 추천 코드입니다');
      return;
    }

    await prisma.sellerReferralClick.create({
      data: {
        sellerId: seller.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    ok(res, { sellerId: seller.id });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};
