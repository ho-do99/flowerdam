import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { ok, notFound, forbidden, serverError } from '../utils/response';

// GET /partner/staff - 내 화원 직원 목록 (대기 + 활성)
export const getMyStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.user!.userId;

    const staff = await prisma.user.findMany({
      where: { ownerId, role: 'PARTNER_STAFF' },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, name: true, phone: true,
        isActive: true, isApproved: true, createdAt: true,
      },
    });

    // 대기 / 활성 분리
    const pending = staff.filter((s) => !s.isActive && !s.isApproved);
    const active = staff.filter((s) => s.isActive);
    const rejected = staff.filter((s) => !s.isActive && s.isApproved);

    ok(res, { pending, active, rejected, total: staff.length });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// POST /partner/staff/:id/approve - 직원 승인
export const approveStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.user!.userId;

    const staff = await prisma.user.findFirst({
      where: { id: req.params.id, ownerId, role: 'PARTNER_STAFF' },
    });

    if (!staff) {
      notFound(res);
      return;
    }

    if (staff.isActive) {
      ok(res, staff, '이미 활성화된 직원입니다');
      return;
    }

    const updated = await prisma.user.update({
      where: { id: staff.id },
      data: { isActive: true, isApproved: true },
      select: { id: true, name: true, phone: true, isActive: true, isApproved: true },
    });

    await prisma.log.create({
      data: {
        userId: ownerId,
        action: 'STAFF_APPROVED',
        detail: { staffId: staff.id, staffName: staff.name },
      },
    });

    ok(res, updated, `${staff.name} 직원이 승인되었습니다`);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// POST /partner/staff/:id/reject - 직원 거절 (계정 비활성화)
export const rejectStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.user!.userId;

    const staff = await prisma.user.findFirst({
      where: { id: req.params.id, ownerId, role: 'PARTNER_STAFF' },
    });

    if (!staff) {
      notFound(res);
      return;
    }

    await prisma.user.update({
      where: { id: staff.id },
      data: { isActive: false, isApproved: false },
    });

    ok(res, null, `${staff.name} 직원 가입이 거절되었습니다`);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// PATCH /partner/staff/:id/toggle - 직원 활성화/비활성화
export const toggleMyStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.user!.userId;

    const staff = await prisma.user.findFirst({
      where: { id: req.params.id, ownerId, role: 'PARTNER_STAFF', isApproved: true },
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

    ok(res, updated, updated.isActive ? '직원이 활성화되었습니다' : '직원이 비활성화되었습니다');
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// DELETE /partner/staff/:id - 직원 삭제
export const removeMyStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerId = req.user!.userId;

    const staff = await prisma.user.findFirst({
      where: { id: req.params.id, ownerId, role: 'PARTNER_STAFF' },
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

// GET /partner/stats - 내 화원 통계
export const getPartnerStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const partnerId = req.user!.userId;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todayOrders, monthOrders, totalOrders, pendingSettlements] = await Promise.all([
      prisma.order.count({ where: { partnerId, createdAt: { gte: today } } }),
      prisma.order.aggregate({
        where: { partnerId, createdAt: { gte: thisMonth }, status: { in: ['CONFIRMED', 'DELIVERED'] } },
        _sum: { partnerAmount: true },
        _count: true,
      }),
      prisma.order.count({ where: { partnerId } }),
      prisma.settlement.aggregate({
        where: { userId: partnerId, status: 'PENDING' },
        _sum: { netAmount: true },
      }),
    ]);

    ok(res, {
      todayOrders,
      monthOrderCount: monthOrders._count,
      monthRevenue: monthOrders._sum.partnerAmount ?? 0,
      totalOrders,
      pendingSettlement: pendingSettlements._sum.netAmount ?? 0,
    });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};
