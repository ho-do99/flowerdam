import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { ok, created, badRequest, forbidden, notFound, serverError } from '../utils/response';

// 상품 목록 (파트너/모두 조회)
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.query;
    const where: Record<string, unknown> = { isActive: true };
    if (category) where.category = category;

    const products = await prisma.supplyProduct.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    ok(res, products);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 상품 주문 (앱머니 결제)
const placeOrderSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1),
  address: z.string().min(5),
  memo: z.string().optional(),
});

export const placeSupplyOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = placeOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.errors[0].message);
      return;
    }

    const { productId, quantity, address, memo } = parsed.data;

    const product = await prisma.supplyProduct.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) {
      notFound(res);
      return;
    }

    if (product.stock < quantity) {
      badRequest(res, `재고가 부족합니다 (현재 재고: ${product.stock}${product.unit})`);
      return;
    }

    const totalPrice = product.price * quantity;

    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user!.userId } });
    if (!wallet || wallet.balance < totalPrice) {
      badRequest(res, `앱머니가 부족합니다 (필요: ${totalPrice.toLocaleString()}원, 보유: ${(wallet?.balance ?? 0).toLocaleString()}원)`);
      return;
    }

    const [order] = await prisma.$transaction([
      prisma.supplyOrder.create({
        data: {
          buyerId: req.user!.userId,
          productId,
          quantity,
          unitPrice: product.price,
          totalPrice,
          address,
          memo,
          status: 'CONFIRMED',
        },
        include: { product: true },
      }),
      prisma.wallet.update({
        where: { userId: req.user!.userId },
        data: { balance: { decrement: totalPrice } },
      }),
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: -totalPrice,
          type: 'SPEND',
          memo: `공급망 주문: ${product.name} x${quantity}`,
        },
      }),
      prisma.supplyProduct.update({
        where: { id: productId },
        data: { stock: { decrement: quantity } },
      }),
    ]);

    created(res, order);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 내 주문 목록
export const getMySupplyOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await prisma.supplyOrder.findMany({
      where: { buyerId: req.user!.userId },
      include: { product: { select: { name: true, unit: true, imageUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    ok(res, orders);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 관리자: 상품 등록
const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  unit: z.string().min(1),
  price: z.number().int().min(100),
  stock: z.number().int().min(0),
  imageUrl: z.string().url().optional(),
});

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.errors[0].message);
      return;
    }

    const product = await prisma.supplyProduct.create({ data: parsed.data });
    created(res, product);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 관리자: 재고 조정
export const updateStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const { stock } = req.body;
    if (typeof stock !== 'number' || stock < 0) {
      badRequest(res, '유효한 재고 수량을 입력해주세요');
      return;
    }

    const product = await prisma.supplyProduct.update({
      where: { id: req.params.id },
      data: { stock },
    });
    ok(res, product);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 관리자: 전체 공급망 주문 조회
export const getAllSupplyOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const orders = await prisma.supplyOrder.findMany({
      where,
      include: {
        buyer: { select: { name: true, businessName: true, phone: true } },
        product: { select: { name: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    ok(res, orders);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 관리자: 주문 상태 변경
export const updateSupplyOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    const allowed = ['CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!allowed.includes(status)) {
      badRequest(res, '유효하지 않은 상태입니다');
      return;
    }

    const order = await prisma.supplyOrder.update({
      where: { id: req.params.id },
      data: { status },
    });
    ok(res, order);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};
