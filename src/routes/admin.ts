import { Router, Request, Response } from 'express';
import { adminService } from '../services/adminService';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/rbac';

const router = Router();

// 대시보드 KPI 조회 (admin)
router.get('/dashboard', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const kpi = await adminService.getDashboardKPI();

    res.json({
      success: true,
      data: kpi,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'DASHBOARD_ERROR', message: error.message },
    });
  }
});

// 전체 사용자 조회 (admin)
router.get('/users', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const { role, page = '1', limit = '20' } = req.query;

    const result = await adminService.getAllUsers(
      role as string | undefined,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_USERS_ERROR', message: error.message },
    });
  }
});

// 전체 주문 통계 (admin)
router.get('/orders', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;

    const result = await adminService.getOrderStats(
      status as string | undefined,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_ORDERS_ERROR', message: error.message },
    });
  }
});

// 이상 거래 감지 목록 (admin)
router.get('/fraud-alerts', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;

    const result = await adminService.getFraudAlerts(
      status as string | undefined,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_FRAUD_ALERTS_ERROR', message: error.message },
    });
  }
});

// 이상 거래 처리 (admin)
router.post('/fraud-alerts/:id', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const { decision } = req.body;

    if (!decision || !['CLEARED', 'ON_HOLD', 'SUSPENDED'].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid decision' },
      });
    }

    const result = await adminService.handleFraudAlert(
      req.params.id,
      decision as 'CLEARED' | 'ON_HOLD' | 'SUSPENDED',
      req.userId || ''
    );

    res.json({
      success: true,
      data: {
        message: 'Fraud alert processed',
        alert: result,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'PROCESS_FRAUD_ALERT_ERROR', message: error.message },
    });
  }
});

// 전체 셀러 조회 (admin)
router.get('/sellers', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;

    const result = await adminService.getAllSellers(
      status as string | undefined,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_SELLERS_ERROR', message: error.message },
    });
  }
});

// 전체 정산 내역 (admin)
router.get('/settlements', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;

    const result = await adminService.getAllSettlements(
      status as string | undefined,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_SETTLEMENTS_ERROR', message: error.message },
    });
  }
});

// 플랫폼 통계 (admin)
router.get('/stats', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const stats = await adminService.getPlatformStats();

    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_STATS_ERROR', message: error.message },
    });
  }
});

export default router;
