import { Router, Request, Response } from 'express';
import { sellerService } from '../services/sellerService';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/rbac';

const router = Router();

// 내 셀러 정보 조회
router.get('/me', authenticate, authorize(['seller']), async (req: Request, res: Response) => {
  try {
    const seller = await sellerService.getSellerByUserId(req.userId || '');

    if (!seller) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Seller profile not found' },
      });
    }

    res.json({
      success: true,
      data: seller,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_SELLER_ERROR', message: 'Failed to fetch seller info' },
    });
  }
});

// 추천 링크 조회
router.get('/me/referral', authenticate, authorize(['seller']), async (req: Request, res: Response) => {
  try {
    const seller = await sellerService.getSellerByUserId(req.userId || '');

    if (!seller) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Seller not found' },
      });
    }

    res.json({
      success: true,
      data: {
        referral_code: seller.referral_code,
        referral_link: seller.referral_link,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_REFERRAL_ERROR', message: 'Failed to fetch referral link' },
    });
  }
});

// 내 수수료 조회
router.get('/me/commissions', authenticate, authorize(['seller']), async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const seller = await sellerService.getSellerByUserId(req.userId || '');

    if (!seller) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Seller not found' },
      });
    }

    const commissions = await sellerService.getSellerCommissions(seller.id, status as string);

    res.json({
      success: true,
      data: commissions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_COMMISSIONS_ERROR', message: 'Failed to fetch commissions' },
    });
  }
});

// 출금 신청
router.post('/me/withdraw', authenticate, authorize(['seller']), async (req: Request, res: Response) => {
  try {
    const { amount, type } = req.body;

    if (!amount || !type) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Amount and type required' },
      });
    }

    const seller = await sellerService.getSellerByUserId(req.userId || '');

    if (!seller) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Seller not found' },
      });
    }

    const withdrawal = await sellerService.requestWithdrawal(
      seller.id,
      parseFloat(amount),
      type
    );

    res.status(201).json({
      success: true,
      data: withdrawal,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'WITHDRAW_ERROR', message: 'Failed to request withdrawal' },
    });
  }
});

// 셀러 통계
router.get('/me/stats', authenticate, authorize(['seller']), async (req: Request, res: Response) => {
  try {
    const { period = 'monthly' } = req.query;
    const seller = await sellerService.getSellerByUserId(req.userId || '');

    if (!seller) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Seller not found' },
      });
    }

    const stats = await sellerService.getSellerStats(
      seller.id,
      (period as 'daily' | 'weekly' | 'monthly') || 'monthly'
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_STATS_ERROR', message: 'Failed to fetch stats' },
    });
  }
});

export default router;
