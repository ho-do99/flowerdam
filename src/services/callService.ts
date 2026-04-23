import prisma from '../config/database';

export interface InitiateCallInput {
  order_id: string;
  recipient_name: string;
  delivery_address: string;
  delivery_place: string;
  product_name: string;
  price: number;
}

export interface CallResponse {
  id: string;
  order_id: string;
  initiated_at: string;
  expires_at: string;
  status: string;
}

export class CallService {
  // 콜 시스템: 지역 내 모든 활성 가맹점에 동시 발신
  async initiateCall(input: InitiateCallInput, region: string): Promise<CallResponse> {
    // 배송지역의 활성 가맹점 조회
    const activePartners = await prisma.partner.findMany({
      where: {
        region,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (activePartners.length === 0) {
      throw new Error('No active partners in this region');
    }

    // 콜 유효 시간: 60초
    const expiresAt = new Date(Date.now() + 60 * 1000);

    // 콜 정보 저장 (추후 추적용)
    // TODO: Call 테이블 추가 (Prisma schema 확장 필요)

    return {
      id: `call_${input.order_id}`,
      order_id: input.order_id,
      initiated_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      status: 'INITIATED',
    };
  }

  // 가맹점이 콜을 수락했을 때
  async acceptCall(orderId: string, partnerId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'PENDING') {
      throw new Error('Order is not in PENDING status');
    }

    // 주문을 해당 가맹점에 배정
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        partner_id: partnerId,
        status: 'ACCEPTED',
      },
    });

    return {
      id: updatedOrder.id,
      status: updatedOrder.status,
      partner_id: partnerId,
      accepted_at: new Date().toISOString(),
    };
  }

  // 가맹점이 콜을 거절했을 때
  async rejectCall(orderId: string, partnerId: string, reason?: string) {
    return {
      order_id: orderId,
      partner_id: partnerId,
      rejected_at: new Date().toISOString(),
      reason: reason || 'Partner declined',
    };
  }

  // 콜 미수락 시: 관리자에게 알림
  async handleUnassignedCall(orderId: string) {
    // TODO: Notification 생성
    // admin에게 "미배정 주문" 알림 발송

    return {
      order_id: orderId,
      status: 'UNASSIGNED',
      message: 'Admin notification sent for unassigned order',
      notified_at: new Date().toISOString(),
    };
  }

  // 콜 통계
  async getCallStats(partnerId: string, period: 'daily' | 'weekly' | 'monthly' = 'daily') {
    // 가맹점이 받은 콜 수
    const totalCalls = await prisma.order.count({
      where: { partner_id: partnerId, status: { not: 'PENDING_PAYMENT' } },
    });

    // 수락한 콜 수
    const acceptedCalls = await prisma.order.count({
      where: { partner_id: partnerId, status: { in: ['ACCEPTED', 'IN_PROGRESS', 'DELIVERING', 'COMPLETED'] } },
    });

    // 거절한 콜 수 (간접 계산)
    const rejectedCalls = totalCalls - acceptedCalls;

    // 수락률
    const acceptanceRate = totalCalls > 0 ? ((acceptedCalls / totalCalls) * 100).toFixed(2) : '0.00';

    return {
      total_calls: totalCalls,
      accepted_calls: acceptedCalls,
      rejected_calls: rejectedCalls,
      acceptance_rate: parseFloat(acceptanceRate),
      period,
    };
  }

  // 평균 수락 시간 (초)
  async getAverageAcceptanceTime(partnerId: string): Promise<number> {
    const orders = await prisma.order.findMany({
      where: {
        partner_id: partnerId,
        status: { in: ['ACCEPTED', 'IN_PROGRESS', 'DELIVERING', 'COMPLETED'] },
      },
      select: { created_at: true, updated_at: true },
    });

    if (orders.length === 0) return 0;

    const totalTime = orders.reduce((sum, order) => {
      const acceptTime = (order.updated_at.getTime() - order.created_at.getTime()) / 1000;
      return sum + acceptTime;
    }, 0);

    return Math.round(totalTime / orders.length);
  }

  // 콜 타이머 만료 확인 (60초)
  async isCallExpired(initiatedAt: Date): Promise<boolean> {
    const elapsedSeconds = (Date.now() - initiatedAt.getTime()) / 1000;
    return elapsedSeconds > 60;
  }

  // 지역별 활성 가맹점 수
  async getActivePartnersInRegion(region: string): Promise<number> {
    return prisma.partner.count({
      where: {
        region,
        status: 'ACTIVE',
      },
    });
  }
}

export const callService = new CallService();
