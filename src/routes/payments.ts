import { Router, Request, Response } from 'express';
import { paymentService } from '../services/paymentService';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// 결제 확인
router.post('/confirm', authenticate, async (req: Request, res: Response) => {
  try {
    const { orderId, paymentKey, amount } = req.body;

    if (!orderId || !paymentKey || !amount) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing required fields' },
      });
    }

    const order = await paymentService.confirmPayment(orderId, paymentKey, amount);

    res.json({
      success: true,
      data: {
        message: 'Payment confirmed',
        order,
      },
    });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    if (error.message.includes('mismatch') || error.message.includes('Cannot confirm')) {
      return res.status(400).json({
        success: false,
        error: { code: 'PAYMENT_ERROR', message: error.message },
      });
    }
    res.status(500).json({
      success: false,
      error: { code: 'CONFIRM_PAYMENT_ERROR', message: 'Failed to confirm payment' },
    });
  }
});

export default router;
