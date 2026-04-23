import { Router } from 'express';
import {
  getPendingPartners,
  approvePartner,
  rejectPartner,
  getDashboard,
  runSettlements,
  getAllOrders,
  getAllSettlements,
  getAllUsers,
  getAllPartners,
  addPartnerStaff,
  toggleStaffStatus,
  deleteStaff,
  getAllSellers,
  getSellerDetail,
  toggleSellerStatus,
  paySellerCommission,
  getSuspiciousSellers,
  getSystemConfig,
  updateSystemConfig,
} from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/dashboard', getDashboard);
router.get('/partners', getAllPartners);
router.get('/partners/pending', getPendingPartners);
router.post('/partners/:id/approve', approvePartner);
router.post('/partners/:id/reject', rejectPartner);
router.post('/partners/:id/staff', addPartnerStaff);
router.patch('/staff/:staffId/toggle', toggleStaffStatus);
router.delete('/staff/:staffId', deleteStaff);
router.post('/settlements/run', runSettlements);
router.get('/orders', getAllOrders);
router.get('/settlements', getAllSettlements);
router.get('/users', getAllUsers);
router.get('/sellers', getAllSellers);
router.get('/sellers/suspicious', getSuspiciousSellers);
router.get('/sellers/:id', getSellerDetail);
router.patch('/sellers/:id/toggle', toggleSellerStatus);
router.post('/sellers/pay-commission', paySellerCommission);

router.get('/config', getSystemConfig);
router.put('/config', updateSystemConfig);

export default router;
