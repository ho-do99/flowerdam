import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { requestInstantWithdrawal } from '../services/settlement.service';
import { ok, badRequest, serverError } from '../utils/response';
import { z } from 'zod';

export const getMySettlements = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', type } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = { userId: req.user!.userId };
    if (type) where.type = type;

    const [settlements, total] = await Promise.all([
      prisma.settlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: { order: { select: { orderNumber: true, price: true, recipientName: true } } },
      }),
      prisma.settlement.count({ where }),
    ]);

    ok(res, { settlements, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

export const getMyWallet = async (req: Request, res: Response): Promise<void> => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user!.userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    ok(res, wallet);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

const withdrawSchema = z.object({
  amount: z.number().int().min(10000, '최소 10,000원부터 출금 가능합니다'),
});

export const instantWithdraw = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = withdrawSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.errors[0].message);
      return;
    }

    const result = await requestInstantWithdrawal(req.user!.userId, parsed.data.amount);

    if (!result.success) {
      badRequest(res, result.message);
      return;
    }

    ok(res, null, result.message);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

export const getPartnerStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const partnerId = req.user!.userId;
    const { period = 'month' } = req.query;

    const now = new Date();
    let startDate: Date;
    if (period === 'day') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const [totalOrders, periodOrders, revenue, recentOrders] = await Promise.all([
      prisma.order.count({ where: { partnerId } }),
      prisma.order.count({ where: { partnerId, createdAt: { gte: startDate } } }),
      prisma.order.aggregate({
        where: { partnerId, status: { in: ['CONFIRMED', 'DELIVERED'] } },
        _sum: { partnerAmount: true },
      }),
      prisma.order.findMany({
        where: { partnerId, createdAt: { gte: startDate } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true, price: true, partnerAmount: true,
          status: true, recipientName: true, createdAt: true,
        },
      }),
    ]);

    ok(res, {
      totalOrders,
      periodOrders,
      totalRevenue: revenue._sum.partnerAmount ?? 0,
      recentOrders,
      period,
    });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};
