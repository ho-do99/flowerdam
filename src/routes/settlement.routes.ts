import { Router } from 'express';
import { getMySettlements, getMyWallet, instantWithdraw, getPartnerStats } from '../controllers/settlement.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// PARTNER_STAFF는 정산/매출 접근 불가 (CLAUDE.md 역할 분리 원칙)
const NO_STAFF = requireRole('CUSTOMER', 'SELLER', 'PARTNER_OWNER', 'ADMIN');

router.get('/', NO_STAFF, getMySettlements);
router.get('/wallet', NO_STAFF, getMyWallet);
router.post('/withdraw/instant', requireRole('PARTNER_OWNER', 'SELLER'), instantWithdraw);
router.get('/stats/partner', requireRole('PARTNER_OWNER'), getPartnerStats);

export default router;
