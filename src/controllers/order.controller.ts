import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { ok, created, badRequest, forbidden, notFound, serverError } from '../utils/response';
import { OrderStatus, UserRole } from '@prisma/client';
import { calculateAmounts } from '../services/settlement.service';

const createOrderSchema = z.object({
  recipientName: z.string().min(1),
  recipientPhone: z.string().regex(/^01[0-9]{8,9}$/),
  deliveryAddress: z.string().min(5),
  deliveryRegion: z.string().min(2),
  deliveryLat: z.number().optional(),
  deliveryLng: z.number().optional(),
  productName: z.string().default('근조화환'),
  price: z.number().int().min(10000),
  memo: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  referralCode: z.string().optional(),
  referralClickedAt: z.string().datetime().optional(), // 클라이언트에서 링크 클릭 시각 전송 (7일 유효기간 체크)
});

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.errors[0].message);
      return;
    }

    const { referralCode, referralClickedAt, scheduledAt, ...orderData } = parsed.data;

    // 셀러 추천 코드 확인 (7일 유효기간 체크)
    let sellerId: string | undefined;
    if (referralCode) {
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const clickedAt = referralClickedAt ? new Date(referralClickedAt) : null;
      const isWithin7Days = !clickedAt || Date.now() - clickedAt.getTime() <= SEVEN_DAYS_MS;
      if (isWithin7Days) {
        const seller = await prisma.user.findUnique({ where: { referralCode } });
        if (seller) sellerId = seller.id;
      }
    }

    const amounts = calculateAmounts(orderData.price);

    const order = await prisma.order.create({
      data: {
        ...orderData,
        customerId: req.user!.userId,
        sellerId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        status: OrderStatus.PENDING,
        ...amounts,
      },
    });

    await prisma.log.create({
      data: { userId: req.user!.userId, action: 'ORDER_CREATED', detail: { orderId: order.id } },
    });

    // 결제 완료 후 콜 발송 (payment.controller에서 호출)
    // dispatchCall은 결제 확인 후 실행됨

    created(res, order);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

export const getMyOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = { customerId: req.user!.userId };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          partner: { select: { id: true, name: true, businessName: true, phone: true } },
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

export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        partner: { select: { id: true, name: true, businessName: true, phone: true } },
      },
    });

    if (!order) {
      notFound(res);
      return;
    }

    // 본인 주문 또는 담당 파트너 또는 관리자만 조회 가능
    const { userId, role } = req.user!;
    if (
      order.customerId !== userId &&
      order.partnerId !== userId &&
      role !== UserRole.ADMIN
    ) {
      forbidden(res);
      return;
    }

    ok(res, order);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 파트너용: 내 수주 목록
export const getPartnerOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const { userId, role } = req.user!;

    // PARTNER_OWNER: 본인 + 소속 직원이 수락한 주문 모두 조회
    let partnerIds = [userId];
    if (role === UserRole.PARTNER_OWNER) {
      const staff = await prisma.user.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });
      partnerIds = [userId, ...staff.map((s) => s.id)];
    }

    const where: Record<string, unknown> = { partnerId: { in: partnerIds } };

    // 콤마 구분 복수 상태 지원 (예: ACCEPTED,IN_PROGRESS,DELIVERING)
    if (status) {
      const statusList = String(status).split(',').map((s) => s.trim()).filter(Boolean);
      where.status = statusList.length === 1 ? statusList[0] : { in: statusList };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);

    ok(res, { orders, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 파트너: 주문 수락
export const acceptOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });

    if (!order) {
      notFound(res);
      return;
    }

    if (order.status !== OrderStatus.CALLING) {
      badRequest(res, '수락 가능한 주문 상태가 아닙니다');
      return;
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.ACCEPTED,
        partnerId: req.user!.userId,
        acceptedAt: new Date(),
      },
    });

    // 콜 수신 기록 업데이트
    await prisma.callReceive.updateMany({
      where: { orderId: order.id, partnerId: req.user!.userId },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });

    await prisma.log.create({
      data: {
        userId: req.user!.userId,
        action: 'ORDER_ACCEPTED',
        detail: { orderId: order.id },
      },
    });

    ok(res, updated);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 파트너: 주문 상태 업데이트
export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });

    if (!order) {
      notFound(res);
      return;
    }

    if (order.partnerId !== req.user!.userId && req.user!.role !== UserRole.ADMIN) {
      forbidden(res);
      return;
    }

    const allowedTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
      [OrderStatus.ACCEPTED]: [OrderStatus.IN_PROGRESS],
      [OrderStatus.IN_PROGRESS]: [OrderStatus.DELIVERING],
      [OrderStatus.DELIVERING]: [OrderStatus.DELIVERED],
    };

    if (!allowedTransitions[order.status]?.includes(status)) {
      badRequest(res, '유효하지 않은 상태 변경입니다');
      return;
    }

    const updateData: Record<string, unknown> = { status };
    if (status === OrderStatus.DELIVERED) updateData.deliveredAt = new Date();

    const updated = await prisma.order.update({ where: { id: order.id }, data: updateData });

    ok(res, updated);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 파트너: 완료 사진 업로드
export const uploadCompletionPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { photoUrl } = req.body;
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });

    if (!order) {
      notFound(res);
      return;
    }

    if (order.partnerId !== req.user!.userId) {
      forbidden(res);
      return;
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        completionPhoto: photoUrl,
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(),
      },
    });

    ok(res, updated);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 고객: 주문 확인
export const confirmOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });

    if (!order) {
      notFound(res);
      return;
    }

    if (order.customerId !== req.user!.userId) {
      forbidden(res);
      return;
    }

    if (order.status !== OrderStatus.DELIVERED) {
      badRequest(res, '배송 완료 후 확인 가능합니다');
      return;
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CONFIRMED, confirmedAt: new Date() },
    });

    // 정산 트리거 (비동기)
    triggerSettlement(order.id).catch(console.error);

    ok(res, updated);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

async function triggerSettlement(orderId: string): Promise<void> {
  const { createSettlements } = await import('../services/settlement.service');
  await createSettlements(orderId);
}

// 타 지역 재발주 (파트너 사장 전용)
export const redispatchOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetRegion, note } = req.body;
    if (!targetRegion) {
      badRequest(res, '재발주 대상 지역을 선택해주세요');
      return;
    }

    const original = await prisma.order.findUnique({
      where: { id: req.params.id },
    });

    if (!original) {
      notFound(res);
      return;
    }

    // 이미 재발주된 주문이면 차단
    if (original.status === OrderStatus.REDISPATCHED) {
      badRequest(res, '이미 재발주된 주문입니다');
      return;
    }

    // 수락한 파트너만 재발주 가능
    if (original.partnerId !== req.user!.userId) {
      forbidden(res);
      return;
    }

    const amounts = calculateAmounts(original.price);

    // 트랜잭션: 원본 주문 REDISPATCHED 처리 + 새 발주 주문 생성
    const [, newOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: original.id },
        data: { status: OrderStatus.REDISPATCHED },
      }),
      prisma.order.create({
        data: {
          customerId: original.customerId,
          sellerId: original.sellerId ?? undefined,
          recipientName: original.recipientName,
          recipientPhone: original.recipientPhone,
          deliveryAddress: original.deliveryAddress,
          deliveryRegion: targetRegion,
          deliveryLat: original.deliveryLat ?? undefined,
          deliveryLng: original.deliveryLng ?? undefined,
          productName: original.productName,
          price: original.price,
          memo: original.memo ?? undefined,
          scheduledAt: original.scheduledAt ?? undefined,
          status: OrderStatus.PENDING,
          parentOrderId: original.id,
          redispatchNote: note ?? `${original.deliveryRegion}→${targetRegion} 재발주`,
          ...amounts,
        },
      }),
    ]);

    // 대상 지역 파트너들에게 콜 발송
    const { dispatchCall } = await import('../services/call.service');
    await dispatchCall(newOrder.id, targetRegion);

    created(res, {
      originalOrderId: original.id,
      newOrderId: newOrder.id,
      targetRegion,
      message: `${targetRegion} 지역 파트너에게 재발주했습니다`,
    });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};
