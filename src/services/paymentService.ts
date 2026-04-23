import prisma from '../config/database';

export class PaymentService {
  async confirmPayment(orderId: string, paymentKey: string, amount: number) {
    // 주문 확인
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');

    // 금액 검증
    if (order.price.toNumber() !== amount) {
      throw new Error('Amount mismatch');
    }

    // 상태 검증 (PENDING_PAYMENT만 결제 가능)
    if (order.status !== 'PENDING_PAYMENT') {
      throw new Error(`Cannot confirm payment for order in ${order.status} status`);
    }

    // 주문 상태 업데이트: PENDING_PAYMENT → PENDING
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PENDING',
        payment_key: paymentKey,
      },
    });

    return updatedOrder;
  }
}

export const paymentService = new PaymentService();
