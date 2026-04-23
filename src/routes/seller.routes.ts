import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import {
  getSellerProfile,
  getSellerCommissions,
  getSellerOrders,
  getSellerStats,
  trackReferralClick,
} from '../controllers/seller.controller';

const router = Router();

// 공개: 클릭 추적 (인증 불필요)
router.post('/track-click', trackReferralClick);

// 셀러 전용
router.use(authenticate, requireRole(UserRole.SELLER));
router.get('/profile', getSellerProfile);
router.get('/commissions', getSellerCommissions);
router.get('/orders', getSellerOrders);
router.get('/stats', getSellerStats);

export default router;
