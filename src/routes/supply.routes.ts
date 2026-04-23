import { Router } from 'express';
import {
  getProducts,
  placeSupplyOrder,
  getMySupplyOrders,
  createProduct,
  updateStock,
  getAllSupplyOrders,
  updateSupplyOrderStatus,
} from '../controllers/supply.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// 파트너/모든 인증 유저: 상품 조회 + 주문
router.get('/products', authenticate, getProducts);
router.post('/orders', authenticate, requireRole('PARTNER_OWNER', 'PARTNER_STAFF'), placeSupplyOrder);
router.get('/orders/my', authenticate, requireRole('PARTNER_OWNER', 'PARTNER_STAFF'), getMySupplyOrders);

// 관리자
router.post('/products', authenticate, requireRole('ADMIN'), createProduct);
router.patch('/products/:id/stock', authenticate, requireRole('ADMIN'), updateStock);
router.get('/orders', authenticate, requireRole('ADMIN'), getAllSupplyOrders);
router.patch('/orders/:id/status', authenticate, requireRole('ADMIN'), updateSupplyOrderStatus);

export default router;
