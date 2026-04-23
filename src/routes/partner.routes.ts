import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  getMyStaff,
  approveStaff,
  rejectStaff,
  toggleMyStaff,
  removeMyStaff,
  getPartnerStats,
} from '../controllers/partner.controller';

const router = Router();

router.use(authenticate, requireRole('PARTNER_OWNER'));

router.get('/staff', getMyStaff);
router.post('/staff/:id/approve', approveStaff);
router.post('/staff/:id/reject', rejectStaff);
router.patch('/staff/:id/toggle', toggleMyStaff);
router.delete('/staff/:id', removeMyStaff);
router.get('/stats', getPartnerStats);

export default router;
