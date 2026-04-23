import { Router } from 'express';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getPartnerOrders,
  acceptOrder,
  updateOrderStatus,
  uploadCompletionPhoto,
  confirmOrder,
  redispatchOrder,
} from '../controllers/order.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// 고객
router.post('/', requireRole('CUSTOMER'), createOrder);
router.get('/my', requireRole('CUSTOMER'), getMyOrders);
router.post('/:id/confirm', requireRole('CUSTOMER'), confirmOrder);

// 파트너
router.get('/partner', requireRole('PARTNER_OWNER', 'PARTNER_STAFF'), getPartnerOrders);
router.post('/:id/accept', requireRole('PARTNER_OWNER', 'PARTNER_STAFF'), acceptOrder);
router.patch('/:id/status', requireRole('PARTNER_OWNER', 'PARTNER_STAFF', 'ADMIN'), updateOrderStatus);
router.post('/:id/photo', requireRole('PARTNER_OWNER', 'PARTNER_STAFF'), uploadCompletionPhoto);
router.post('/:id/redispatch', requireRole('PARTNER_OWNER'), redispatchOrder);

// 공통
router.get('/:id', getOrderById);

export default router;
