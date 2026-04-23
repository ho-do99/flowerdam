import { Router, Request, Response } from 'express';
import { partnerService } from '../services/partnerService';
import { fcmService } from '../services/fcmService';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/rbac';
import prisma from '../config/database';

const router = Router();

// 파트너 가입 신청 (partner_owner)
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { name, region, address, business_number } = req.body;

    if (!name || !region || !address || !business_number) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing required fields' },
      });
    }

    const partner = await partnerService.createPartner({
      user_id: req.userId || '',
      name,
      region,
      address,
      business_number,
    });

    res.status(201).json({
      success: true,
      data: partner,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_PARTNER_ERROR', message: error.message },
    });
  }
});

// 내 파트너 정보 조회 (partner_owner, partner_staff)
router.get('/me', authenticate, authorize(['partner_owner', 'partner_staff']), async (req: Request, res: Response) => {
  try {
    // partner_staff의 경우 user의 partner_id에서 조회
    let partnerId: string | undefined;

    if (req.userRole === 'partner_owner') {
      const partner = await partnerService.getPartnerByOwnerId(req.userId || '');
      if (!partner) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Partner not found' },
        });
      }
      res.json({ success: true, data: partner });
    } else {
      // partner_staff는 Prisma를 통해 partner_id 조회 필요
      // 현재는 간단한 구현으로 user 테이블의 partner_id 사용
      res.json({
        success: true,
        data: { message: 'Staff info - get from user.partner_id' },
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_PARTNER_ERROR', message: error.message },
    });
  }
});

// 파트너 목록 조회 (admin, 상태별 필터)
router.get('/', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const { status = 'PENDING', page = '1', limit = '20' } = req.query;

    const result = await partnerService.getPartnersByStatus(
      status as string,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_PARTNERS_ERROR', message: error.message },
    });
  }
});

// 지역별 파트너 조회 (공개)
router.get('/region/:region', async (req: Request, res: Response) => {
  try {
    const partners = await partnerService.getPartnersByRegion(req.params.region, 'ACTIVE');

    res.json({ success: true, data: partners });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_PARTNERS_ERROR', message: error.message },
    });
  }
});

// 파트너 상세 조회
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const partner = await partnerService.getPartnerById(req.params.id);

    if (!partner) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Partner not found' },
      });
    }

    res.json({ success: true, data: partner });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_PARTNER_ERROR', message: error.message },
    });
  }
});

// 파트너 승인 (admin)
router.post('/:id/approve', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const partner = await partnerService.approvePartner(req.params.id, req.userId || '');

    // 파트너 사장에게 승인 알림 발송
    const ownerUser = await prisma.user.findUnique({
      where: { id: partner.owner_id },
    });
    if (ownerUser) {
      await fcmService.notifyPartnerApproved(partner.owner_id);
    }

    res.json({
      success: true,
      data: {
        message: 'Partner approved',
        partner,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'APPROVE_PARTNER_ERROR', message: error.message },
    });
  }
});

// 파트너 거절 (admin)
router.post('/:id/reject', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const partner = await partnerService.rejectPartner(req.params.id, req.userId || '');

    // 파트너 사장에게 거절 알림 발송
    const ownerUser = await prisma.user.findUnique({
      where: { id: partner.owner_id },
    });
    if (ownerUser) {
      await fcmService.notifyPartnerRejected(partner.owner_id, reason);
    }

    res.json({
      success: true,
      data: {
        message: 'Partner rejected',
        partner,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'REJECT_PARTNER_ERROR', message: error.message },
    });
  }
});

// 내 파트너의 직원 목록 조회 (partner_owner 전용)
router.get('/me/staff', authenticate, authorize(['partner_owner']), async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20' } = req.query;

    // 파트너 사장의 파트너 ID 조회
    const partner = await partnerService.getPartnerByOwnerId(req.userId || '');
    if (!partner) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Partner not found' },
      });
    }

    const result = await partnerService.getPartnerStaff(
      partner.id,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_STAFF_ERROR', message: error.message },
    });
  }
});

// 파트너 소속 직원 조회 (partner_owner)
router.get('/:id/staff', authenticate, authorize(['partner_owner', 'admin']), async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20' } = req.query;

    const result = await partnerService.getPartnerStaff(
      req.params.id,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_STAFF_ERROR', message: error.message },
    });
  }
});

// 직원 승인 (partner_owner)
router.post('/:id/staff/:staffId/approve', authenticate, authorize(['partner_owner']), async (req: Request, res: Response) => {
  try {
    const staff = await partnerService.approveStaff(req.params.staffId, req.params.id);

    // 직원에게 승인 알림 발송
    await fcmService.notifyStaffApproved(req.params.staffId);

    res.json({
      success: true,
      data: {
        message: 'Staff approved',
        staff,
      },
    });
  } catch (error: any) {
    if (error.message.includes('does not belong')) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: error.message },
      });
    }
    res.status(500).json({
      success: false,
      error: { code: 'APPROVE_STAFF_ERROR', message: error.message },
    });
  }
});

// 직원 거절 (partner_owner)
router.post('/:id/staff/:staffId/reject', authenticate, authorize(['partner_owner']), async (req: Request, res: Response) => {
  try {
    const staff = await partnerService.rejectStaff(req.params.staffId, req.params.id);

    res.json({
      success: true,
      data: {
        message: 'Staff rejected',
        staff,
      },
    });
  } catch (error: any) {
    if (error.message.includes('does not belong')) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: error.message },
      });
    }
    res.status(500).json({
      success: false,
      error: { code: 'REJECT_STAFF_ERROR', message: error.message },
    });
  }
});

// 파트너 통계 조회 (partner_owner, admin)
router.get('/:id/stats', authenticate, authorize(['partner_owner', 'admin']), async (req: Request, res: Response) => {
  try {
    const stats = await partnerService.getPartnerStats(req.params.id);

    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_STATS_ERROR', message: error.message },
    });
  }
});

export default router;
