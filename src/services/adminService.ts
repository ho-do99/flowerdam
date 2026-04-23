import prisma from '../config/database';

export class AdminService {
  // 전체 KPI 조회
  async getDashboardKPI() {
    const [totalUsers, totalOrders, totalRevenue, activePartners] = await Promise.all([
      prisma.user.count(),
      prisma.order.count(),
      prisma.order.aggregate({
        _sum: { price: true },
        where: { status: 'COMPLETED' },
      }),
      prisma.partner.count({ where: { status: 'ACTIVE' } }),
    ]);

    const totalRev = totalRevenue._sum?.price || 0;
    const revNum = typeof totalRev === 'number' ? totalRev : totalRev.toNumber();

    return {
      total_users: totalUsers,
      total_orders: totalOrders,
      total_revenue: revNum,
      active_partners: activePartners,
      platform_fee_earned: revNum * 0.257, // 약 25.7%
    };
  }

  // 전체 사용자 관리
  async getAllUsers(role?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          created_at: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users.map(u => ({
        ...u,
        created_at: u.created_at.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 전체 주문 통계
  async getOrderStats(status?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      data: orders.map(o => ({
        id: o.id,
        price: typeof o.price === 'number' ? o.price : o.price.toNumber(),
        status: o.status,
        recipient_name: o.recipient_name,
        delivery_address: o.delivery_address,
        created_at: o.created_at.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 이상 거래 감지 목록
  async getFraudAlerts(status?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [alerts, total] = await Promise.all([
      prisma.fraudAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.fraudAlert.count({ where }),
    ]);

    return {
      data: alerts.map(a => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        description: a.description,
        status: a.status,
        created_at: a.created_at.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 이상 거래 처리
  async handleFraudAlert(alertId: string, decision: 'CLEARED' | 'ON_HOLD' | 'SUSPENDED', adminId: string) {
    const alert = await prisma.fraudAlert.update({
      where: { id: alertId },
      data: {
        status: decision,
        reviewed_by: adminId,
        reviewed_at: new Date(),
      },
    });

    // decision에 따라 추가 처리
    if (decision === 'SUSPENDED' && alert.target_id) {
      // 셀러 계정 정지
      await prisma.seller.update({
        where: { user_id: alert.target_id },
        data: { status: 'SUSPENDED' },
      }).catch(() => {}); // 셀러가 아닐 수 있음
    }

    return {
      id: alert.id,
      status: alert.status,
      reviewed_at: alert.reviewed_at?.toISOString(),
    };
  }

  // 셀러 전체 관리
  async getAllSellers(status?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [sellers, total] = await Promise.all([
      prisma.seller.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.seller.count({ where }),
    ]);

    return {
      data: sellers.map(s => ({
        id: s.id,
        referral_code: s.referral_code,
        total_earned: typeof s.total_commission_earned === 'number'
          ? s.total_commission_earned
          : s.total_commission_earned.toNumber(),
        pending: typeof s.pending_commission === 'number'
          ? s.pending_commission
          : s.pending_commission.toNumber(),
        status: s.status,
        created_at: s.created_at.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 정산 내역 전체 조회
  async getAllSettlements(status?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [settlements, total] = await Promise.all([
      prisma.settlement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.settlement.count({ where }),
    ]);

    return {
      data: settlements.map(s => ({
        id: s.id,
        partner_id: s.partner_id,
        amount: typeof s.amount === 'number' ? s.amount : s.amount.toNumber(),
        type: s.type,
        status: s.status,
        settled_at: s.settled_at?.toISOString(),
        created_at: s.created_at.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 플랫폼 통계 (상세)
  async getPlatformStats() {
    const [ordersByStatus, ordersByRegion, revenueByMonth] = await Promise.all([
      prisma.order.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.partner.groupBy({
        by: ['region'],
        _count: true,
      }),
      prisma.order.findMany({
        where: { status: 'COMPLETED' },
        select: { price: true, created_at: true },
      }),
    ]);

    // 월별 수익 계산
    const revenueByMonthMap = new Map<string, number>();
    revenueByMonth.forEach(order => {
      const month = new Date(order.created_at).toISOString().slice(0, 7);
      const price = typeof order.price === 'number' ? order.price : order.price.toNumber();
      revenueByMonthMap.set(month, (revenueByMonthMap.get(month) || 0) + price);
    });

    return {
      orders_by_status: ordersByStatus.map(s => ({
        status: s.status,
        count: s._count,
      })),
      partners_by_region: ordersByRegion.map(r => ({
        region: r.region,
        count: r._count,
      })),
      monthly_revenue: Array.from(revenueByMonthMap.entries()).map(([month, revenue]) => ({
        month,
        revenue,
      })),
    };
  }
}

export const adminService = new AdminService();
