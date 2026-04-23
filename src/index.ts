import 'dotenv/config';
import http from 'http';
import express from 'express';
import path from 'path';
import cors from 'cors';
import { initSocket } from './utils/socket';

import authRoutes from './routes/auth.routes';
import orderRoutes from './routes/order.routes';
import settlementRoutes from './routes/settlement.routes';
import adminRoutes from './routes/admin.routes';
import paymentRoutes from './routes/payment.routes';
import aiRoutes from './routes/ai.routes';
import supplyRoutes from './routes/supply.routes';
import sellerRoutes from './routes/seller.routes';
import uploadRoutes from './routes/upload.routes';
import partnerRoutes from './routes/partner.routes';

const app = express();
const httpServer = http.createServer(app);

// Socket.io 초기화
initSocket(httpServer);

// 미들웨어
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 헬스체크
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 라우트
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/supply', supplyRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// 404
app.use((_, res) => res.status(404).json({ success: false, message: '요청한 경로를 찾을 수 없습니다' }));

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`🌸 꽃담 API 서버 실행 중: http://localhost:${PORT}`);
});

export default app;
