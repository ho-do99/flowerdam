import prisma from '../config/database';

export interface CreateOrderInput {
  customer_id: string;
  product_id: string;
  recipient_name: string;
  delivery_place: string;
  delivery_address: string;
  delivery_datetime: string;
  ribbon_message?: string;
  request_note?: string;
  referred_by_seller_id?: string;
  payment_method: string;
}

export interface OrderResponse {
  id: string;
  customer_id: string;
  product_id: string;
  price: number;
  status: string;
  created_at: string;
}

export class OrderService {
  async createOrder(input: CreateOrderInput): Promise<OrderResponse> {
    // 상품 정보 조회
    const product = await prisma.product.findUnique({
      where: { id: input.product_id },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    // 주문 생성
    const order = await prisma.order.create({
      data: {
        customer_id: input.customer_id,
        product_id: input.product_id,
        price: product.price,
        recipient_name: input.recipient_name,
        delivery_place: input.delivery_place,
        delivery_address: input.delivery_address,
        delivery_datetime: new Date(input.delivery_datetime),
        ribbon_message: input.ribbon_message,
        request_note: input.request_note,
        referred_by_seller_id: input.referred_by_seller_id,
        payment_method: input.payment_method,
        status: 'PENDING_PAYMENT',
      },
    });

    return this.formatOrderResponse(order);
  }

  async getOrders(customerId?: string, status?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (customerId) {
      where.customer_id = customerId;
    }
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
      data: orders.map(o => this.formatOrderResponse(o)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOrderById(id: string, userId?: string): Promise<OrderResponse | null> {
    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) return null;

    // customer는 자신의 주문만 조회 가능
    if (userId && order.customer_id !== userId) {
      throw new Error('Unauthorized');
    }

    return this.formatOrderResponse(order);
  }

  async updateOrderStatus(
    id: string,
    newStatus: string,
    userId?: string
  ): Promise<OrderResponse> {
    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // 상태 전환 규칙 검증
    const validTransitions: Record<string, string[]> = {
      PENDING_PAYMENT: ['PENDING', 'CANCELLED'],
      PENDING: ['ACCEPTED', 'CANCELLED'],
      ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['DELIVERING', 'CANCELLED'],
      DELIVERING: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!validTransitions[order.status]?.includes(newStatus)) {
      throw new Error(
        `Cannot transition from ${order.status} to ${newStatus}`
      );
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: newStatus as any },
    });

    return this.formatOrderResponse(updatedOrder);
  }

  async cancelOrder(id: string, reason: string, userId: string): Promise<OrderResponse> {
    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // 취소 불가능 상태 확인
    const cancellableStatuses = ['PENDING_PAYMENT', 'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'DELIVERING'];
    if (!cancellableStatuses.includes(order.status)) {
      throw new Error(`Cannot cancel order with status ${order.status}`);
    }

    // 주문 취소
    const cancelledOrder = await prisma.order.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelled_at: new Date(),
        cancel_reason: reason,
      },
    });

    return this.formatOrderResponse(cancelledOrder);
  }

  async uploadCompletionPhotos(
    orderId: string,
    photoUrls: string[]
  ): Promise<OrderResponse> {
    if (!photoUrls || photoUrls.length === 0) {
      throw new Error('At least one photo is required');
    }

    if (photoUrls.length > 5) {
      throw new Error('Maximum 5 photos allowed');
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'DELIVERING') {
      throw new Error('Photos can only be uploaded when order is DELIVERING');
    }

    // 사진 업로드 후 상태를 COMPLETED로 변경
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        completed_photos: photoUrls,
        status: 'COMPLETED',
      },
    });

    return this.formatOrderResponse(updatedOrder);
  }

  private formatOrderResponse(order: any): OrderResponse {
    return {
      id: order.id,
      customer_id: order.customer_id,
      product_id: order.product_id,
      price: order.price.toNumber?.() || order.price,
      status: order.status,
      created_at: order.created_at.toISOString(),
    };
  }
}

export const orderService = new OrderService();
