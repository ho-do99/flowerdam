import { Router } from 'express';
import { getDemandPrediction, getAnomalyCheck, getRibbonSuggestions } from '../controllers/ai.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// 리본 문구 추천 - 고객 사용
router.post('/ribbon', authenticate, getRibbonSuggestions);

// 관리자 전용
router.get('/demand/:region', authenticate, requireRole('ADMIN'), getDemandPrediction);
router.get('/anomaly/:userId', authenticate, requireRole('ADMIN'), getAnomalyCheck);

export default router;
