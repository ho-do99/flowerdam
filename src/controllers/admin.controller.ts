import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { ok, badRequest, notFound, serverError } from '../utils/response';
import { processDailySettlements } from '../services/settlement.service';

const ALLOWED_CONFIG_KEYS = [
  'call_timeout_minutes',
  'call_mode',
  'call_retry_on_timeout',
  'call_max_partners',
] as const;

export const getPendingPartners = async (req: Request, res: Response): Promise<void> => {
  try {
    const partners = await prisma.user.findMany({
      where: { role: { in: ['PARTNER_OWNER'] }, isApproved: false },
      select: { id: true, name: true, phone: true, businessName: true, address: true, region: true, createdAt: true },
    });
    ok(res, partners);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

export const approvePartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      notFound(res);
      return;
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isApproved: true },
      select: { id: true, name: true, businessName: true, isApproved: true },
    });

    ok(res, updated, '가맹점 승인 완료');
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

export const rejectPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    ok(res, updated, '가맹점 거절 완료');
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      todayOrders,
      totalRevenue,
      pendingPartners,
      activePartners,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.aggregate({
        where: { status: { in: ['CONFIRMED', 'DELIVERED'] } },
        _sum: { platformAmount: true },
      }),
      prisma.user.count({ where: { role: 'PARTNER_OWNER', isApproved: false } }),
      prisma.user.count({ where: { role: 'PARTNER_OWNER', isApproved: true, isActive: true } }),
    ]);

    ok(res, {
      totalOrders,
      todayOrders,
      platformRevenue: totalRevenue._sum.platformAmount ?? 0,
      pendingPartners,
      activePartners,
    });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

export const runSettlements = async (req: Request, res: Response): Promise<void> => {
  try {
    await processDailySettlements();
    ok(res, null, 'D+1 정산 실행 완료');
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

export const getAllOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          partner: { select: { id: true, name: true, businessName: true } },
          payment: { select: { status: true, method: true, paymentKey: true, amount: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    ok(res, { orders, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

export const getAllSettlements = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', status, type } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [settlements, total] = await Promise.all([
      prisma.settlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          user: { select: { id: true, name: true, role: true } },
          order: { select: { orderNumber: true } },
        },
      }),
      prisma.settlement.count({ where }),
    ]);

    ok(res, { settlements, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', role, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { phone: { contains: String(search) } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        select: {
          id: true, name: true, phone: true, email: true,
          role: true, isApproved: true, isActive: true,
          businessName: true, region: true, createdAt: true,
          wallet: { select: { balance: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    ok(res, { users, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 승인된 파트너 목록
export const getAllPartners = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search } = req.query;
    const where: Record<string, unknown> = { role: 'PARTNER_OWNER' };
    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { businessName: { contains: String(search) } },
        { region: { contains: String(search) } },
      ];
    }

    const partners = await prisma.user.findMany({
      where,
      orderBy: [{ isApproved: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, name: true, phone: true, businessName: true,
        address: true, region: true, isApproved: true, isActive: true,
        createdAt: true,
        wallet: { select: { balance: true } },
        staff: {
          select: { id: true, name: true, phone: true, isActive: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { ordersAsPartner: true } },
      },
    });

    ok(res, partners);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

const addStaffSchema = z.object({
  name: z.string().min(1),
  phone: z.string().regex(/^01[0-9]{8,9}$/),
  password: z.string().min(6),
});

// 직원 추가
export const addPartnerStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = addStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.errors[0].message);
      return;
    }

    const owner = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'PARTNER_OWNER' },
    });
    if (!owner) {
      notFound(res);
      return;
    }

    const exists = await prisma.user.findUnique({ where: { phone: parsed.data.phone } });
    if (exists) {
      badRequest(res, '이미 등록된 전화번호입니다');
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    const staff = await prisma.user.create({
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        passwordHash,
        role: 'PARTNER_STAFF',
        region: owner.region ?? undefined,
        ownerId: owner.id,
        isApproved: true,
        isActive: true,
      },
      select: {
        id: true, name: true, phone: true, role: true,
        isActive: true, createdAt: true, ownerId: true,
      },
    });

    // 직원용 지갑 생성
    await prisma.wallet.create({ data: { userId: staff.id } });

    ok(res, staff, '직원 계정이 생성되었습니다');
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 직원 활성화/비활성화
export const toggleStaffStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const staff = await prisma.user.findFirst({
      where: { id: req.params.staffId, role: 'PARTNER_STAFF' },
    });
    if (!staff) {
      notFound(res);
      return;
    }

    const updated = await prisma.user.update({
      where: { id: staff.id },
      data: { isActive: !staff.isActive },
      select: { id: true, name: true, isActive: true },
    });

    ok(res, updated, updated.isActive ? '직원 활성화 완료' : '직원 비활성화 완료');
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 직원 삭제
export const deleteStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const staff = await prisma.user.findFirst({
      where: { id: req.params.staffId, role: 'PARTNER_STAFF' },
    });
    if (!staff) {
      notFound(res);
      return;
    }

    await prisma.user.delete({ where: { id: staff.id } });
    ok(res, null, '직원 계정이 삭제되었습니다');
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// ─── 셀러 관리 ───────────────────────────────────────────────────────────────

// 셀러 목록 (프로필 + 통계 포함)
export const getAllSellers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, status } = req.query;

    const where: Record<string, unknown> = { role: 'SELLER' };
    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { phone: { contains: String(search) } },
        { referralCode: { contains: String(search) } },
      ];
    }

    const sellers = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, phone: true, referralCode: true,
        isActive: true, createdAt: true,
        wallet: { select: { balance: true } },
        sellerProfile: {
          select: {
            totalCommissionEarned: true,
            totalCommissionPaid: true,
            pendingCommission: true,
            status: true,
          },
        },
        _count: {
          select: { ordersAsCustomer: false, sellerCommissions: true, referralClicks: true },
        },
      },
    });

    const filtered = status
      ? sellers.filter((s) => s.sellerProfile?.status === status)
      : sellers;

    ok(res, filtered);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 셀러 상세 (수수료 내역 포함)
export const getSellerDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const seller = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'SELLER' },
      select: {
        id: true, name: true, phone: true, referralCode: true,
        isActive: true, createdAt: true,
        wallet: { select: { balance: true } },
        sellerProfile: true,
      },
    });

    if (!seller) {
      notFound(res);
      return;
    }

    const commissions = await prisma.sellerCommission.findMany({
      where: { sellerId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        order: { select: { orderNumber: true, price: true, status: true } },
      },
    });

    ok(res, { ...seller, commissions });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 셀러 활성화/비활성화
export const toggleSellerStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const seller = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'SELLER' },
    });
    if (!seller) {
      notFound(res);
      return;
    }

    const updated = await prisma.user.update({
      where: { id: seller.id },
      data: { isActive: !seller.isActive },
      select: { id: true, name: true, isActive: true },
    });

    // SellerProfile 상태도 동기화
    await prisma.sellerProfile.updateMany({
      where: { userId: seller.id },
      data: { status: updated.isActive ? 'ACTIVE' : 'INACTIVE' },
    });

    ok(res, updated, updated.isActive ? '셀러 활성화 완료' : '셀러 비활성화 완료');
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 셀러 수수료 지급 처리 (PENDING → PAID + 지갑 증액)
export const paySellerCommission = async (req: Request, res: Response): Promise<void> => {
  try {
    const { commissionId } = req.body;

    const commission = await prisma.sellerCommission.findUnique({
      where: { id: commissionId },
    });

    if (!commission) {
      notFound(res);
      return;
    }

    if (commission.status !== 'PENDING') {
      badRequest(res, '지급 가능한 수수료가 아닙니다');
      return;
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId: commission.sellerId } });
    if (!wallet) {
      badRequest(res, '셀러 지갑을 찾을 수 없습니다');
      return;
    }

    await prisma.$transaction([
      prisma.sellerCommission.update({
        where: { id: commissionId },
        data: { status: 'PAID', paidAt: new Date() },
      }),
      prisma.wallet.update({
        where: { userId: commission.sellerId },
        data: { balance: { increment: commission.commissionAmount } },
      }),
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: commission.commissionAmount,
          type: 'EARN',
          memo: `셀러 수수료 지급`,
        },
      }),
    ]);

    await prisma.sellerProfile.updateMany({
      where: { userId: commission.sellerId },
      data: {
        pendingCommission: { decrement: commission.commissionAmount },
        totalCommissionPaid: { increment: commission.commissionAmount },
      },
    });

    ok(res, null, '수수료 지급 완료');
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 이상 셀러 감지 (어뷰징 / 자전거래 의심)
export const getSuspiciousSellers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const sellers = await prisma.user.findMany({
      where: { role: 'SELLER', isActive: true },
      select: {
        id: true, name: true, phone: true, referralCode: true, createdAt: true,
        sellerProfile: { select: { totalCommissionEarned: true, pendingCommission: true, status: true } },
        _count: { select: { sellerCommissions: true, referralClicks: true } },
        // 셀러가 직접 주문한 내역 (자전거래 의심)
        ordersAsCustomer: {
          where: { sellerId: { not: null } },
          select: { id: true, sellerId: true, price: true, createdAt: true },
          take: 10,
        },
      },
    });

    const suspicious = sellers
      .map((seller) => {
        const flags: string[] = [];

        const clicks = seller._count.referralClicks;
        const orders = seller._count.sellerCommissions;

        // 클릭 없이 주문 연결 (봇/내부 조작 의심)
        if (orders > 0 && clicks === 0) flags.push('클릭 없이 주문 연결');

        // 전환율 100% + 10건 이상 (비정상적 고전환율)
        const conversionRate = clicks > 0 ? orders / clicks : 0;
        if (conversionRate >= 1 && orders >= 10) flags.push(`전환율 ${Math.round(conversionRate * 100)}% (${orders}건/${clicks}회)`);

        // 자전거래: 셀러 본인이 자신의 추천 코드를 통해 주문
        const selfOrders = seller.ordersAsCustomer.filter((o) => o.sellerId === seller.id);
        if (selfOrders.length > 0) flags.push(`자전거래 의심 ${selfOrders.length}건`);

        // 가입 7일 이내 수수료 50만원 이상 (비정상적 단기 급성장)
        const daysSinceJoin = (Date.now() - new Date(seller.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceJoin <= 7 && (seller.sellerProfile?.totalCommissionEarned ?? 0) >= 500000) {
          flags.push(`가입 ${Math.floor(daysSinceJoin)}일 내 수수료 ${seller.sellerProfile!.totalCommissionEarned.toLocaleString()}원`);
        }

        return { ...seller, flags, riskLevel: flags.length >= 2 ? 'HIGH' : flags.length === 1 ? 'MEDIUM' : 'NONE' };
      })
      .filter((s) => s.flags.length > 0)
      .sort((a, b) => b.flags.length - a.flags.length);

    ok(res, suspicious);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

export const getSystemConfig = async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await prisma.systemConfig.findMany();
    const config: Record<string, string> = {
      call_timeout_minutes: '3',
      call_mode: 'broadcast',
      call_retry_on_timeout: 'false',
      call_max_partners: '0',
    };
    for (const r of rows) config[r.key] = r.value;
    ok(res, config);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

export const updateSystemConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const updates = req.body as Record<string, string>;
    const validKeys = ALLOWED_CONFIG_KEYS as readonly string[];
    const ops = Object.entries(updates)
      .filter(([k]) => validKeys.includes(k))
      .map(([key, value]) =>
        prisma.systemConfig.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      );
    if (ops.length === 0) {
      badRequest(res, '변경할 설정 항목이 없습니다');
      return;
    }
    await Promise.all(ops);
    ok(res, { updated: ops.length });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};
