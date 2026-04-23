import { Router } from 'express';
import { register, login, refresh, logout, me, savePushToken, getPartnersList } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/partners', getPartnersList);
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);
router.post('/push-token', authenticate, savePushToken);

export default router;
