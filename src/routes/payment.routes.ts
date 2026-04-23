import { Router } from 'express';
import {
  preparePayment,
  confirmPayment,
  cancelOrder,
  getPaymentStatus,
  getCheckoutPage,
  tossSuccessCallback,
  tossFailCallback,
} from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// 공개 엔드포인트 (WebView 콜백)
router.get('/checkout/:tossOrderId', getCheckoutPage);
router.get('/toss-callback/success', tossSuccessCallback);
router.get('/toss-callback/fail', tossFailCallback);

// 인증 필요
router.use(authenticate);
router.post('/prepare', preparePayment);
router.post('/confirm', confirmPayment);
router.post('/cancel/:orderId', cancelOrder);
router.get('/status/:orderId', getPaymentStatus);

export default router;
