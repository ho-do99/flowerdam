import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import prisma from '../config/database';
import { callService } from '../services/callService';
import { fcmService } from '../services/fcmService';

interface CallPayload {
  order_id: string;
  recipient_name: string;
  delivery_address: string;
  delivery_place: string;
  product_name: string;
  price: number;
  region: string;
  customer_id: string;
}

export function initializeSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // 파트너별 소켓 연결 추적 (partner_id -> socket)
  const partnerSockets = new Map<string, Socket[]>();

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // 파트너 가맹점 등록
    // 파트너는 로그인 후 partner_id와 region을 함께 전달
    socket.on('partner:register', async (data: { partner_id: string; region?: string }) => {
      try {
        const { partner_id, region } = data;

        // 이 파트너의 소켓 목록에 추가
        if (!partnerSockets.has(partner_id)) {
          partnerSockets.set(partner_id, []);
        }
        partnerSockets.get(partner_id)!.push(socket);

        // 파트너 식별 룸에 조인
        socket.join(`partner_${partner_id}`);

        // 지역 룸에 조인 (콜 수신을 위해 필요)
        let partnerRegion = region;
        if (!partnerRegion) {
          // region이 전달되지 않으면 DB에서 조회
          const partner = await prisma.partner.findUnique({
            where: { id: partner_id },
            select: { region: true },
          });
          partnerRegion = partner?.region;
        }

        if (partnerRegion) {
          socket.join(`region_${partnerRegion}`);
          console.log(`[Socket] Partner ${partner_id} registered in region ${partnerRegion}`);
        } else {
          console.warn(`[Socket] Partner ${partner_id} registered but region not found`);
        }

        socket.emit('partner:registered', { partner_id, message: 'Successfully registered' });
      } catch (error) {
        console.error('[Register Error]', error);
        socket.emit('partner:register_failed', { error: (error as Error).message });
      }
    });

    // 고객 등록
    socket.on('customer:register', (data: { customer_id: string; region: string }) => {
      const { customer_id, region } = data;
      socket.join(`region_${region}`);
      socket.join(`customer_${customer_id}`);

      console.log(`[Socket] Customer ${customer_id} registered in region ${region}`);
      socket.emit('customer:registered', { customer_id, region });
    });

    // 콜 발신 (고객이 주문 완료 후)
    socket.on('order:call', async (payload: CallPayload) => {
      try {
        const { order_id, region, customer_id, recipient_name, delivery_address, delivery_place, product_name, price } = payload;

        console.log(`[Call] New order call: ${order_id} in region ${region}`);

        // 콜 서비스 호출
        const callResponse = await callService.initiateCall(
          {
            order_id,
            recipient_name,
            delivery_address,
            delivery_place,
            product_name,
            price,
          },
          region
        );

        // 해당 지역의 모든 활성 가맹점에 콜 발신
        io.to(`region_${region}`).emit('order:incoming', {
          call_id: callResponse.id,
          order_id,
          customer_id,
          recipient_name,
          delivery_address,
          delivery_place,
          product_name,
          price,
          expires_at: callResponse.expires_at,
          timer_seconds: 60,
        });

        // FCM 푸시 알림 (백그라운드 대비)
        await fcmService.notifyOrderCall(region, order_id);

        console.log(`[Call] Broadcasted to region ${region}`);

        // 고객에게 콜 발신 완료 알림
        io.to(`customer_${customer_id}`).emit('order:call_sent', {
          order_id,
          message: 'Call sent to nearby partners',
        });

        // 60초 후 자동으로 미수락 처리
        setTimeout(async () => {
          const result = await callService.handleUnassignedCall(order_id);
          console.log(`[Call] Unassigned after 60s: ${order_id}`);

          // 관리자에게 알림 (Socket 또는 DB)
          io.to('admin').emit('order:unassigned', {
            order_id,
            timestamp: new Date().toISOString(),
          });

          // 관리자에게 FCM 푸시 알림
          await fcmService.notifyUnassignedOrder(order_id);
        }, 60000);
      } catch (error) {
        console.error('[Call Error]', error);
        socket.emit('order:call_failed', { error: (error as Error).message });
      }
    });

    // 파트너가 콜 수락
    socket.on('order:accept', async (data: { order_id: string; partner_id: string }) => {
      try {
        const { order_id, partner_id } = data;

        const result = await callService.acceptCall(order_id, partner_id);

        console.log(`[Call] Order accepted: ${order_id} by partner ${partner_id}`);

        // 같은 지역의 다른 파트너들에게 콜 취소 알림
        io.to(`partner_${partner_id}`).emit('order:assigned', {
          order_id,
          partner_id,
          message: 'Order has been assigned',
        });

        // 고객에게 수락 알림
        const order = await prisma.order.findUnique({
          where: { id: order_id },
          select: { customer_id: true },
        });
        if (order) {
          io.to(`customer_${order.customer_id}`).emit('order:accepted', {
            order_id,
            partner_id,
            message: 'Partner has accepted your order',
          });
        }

        // 다른 파트너들에게 콜 취소
        const region = (await callService.getActivePartnersInRegion('any')).toString();
        io.emit('order:cancelled', {
          order_id,
          message: 'This order has been assigned to another partner',
        });
      } catch (error) {
        console.error('[Accept Error]', error);
        socket.emit('order:accept_failed', { error: (error as Error).message });
      }
    });

    // 파트너가 콜 거절
    socket.on('order:reject', async (data: { order_id: string; partner_id: string; reason?: string }) => {
      try {
        const { order_id, partner_id, reason } = data;

        await callService.rejectCall(order_id, partner_id, reason);

        console.log(`[Call] Order rejected: ${order_id} by partner ${partner_id}`);

        // 다른 파트너들은 계속 대기
        socket.emit('order:rejected', {
          order_id,
          message: 'You have rejected this order',
        });
      } catch (error) {
        console.error('[Reject Error]', error);
        socket.emit('order:reject_failed', { error: (error as Error).message });
      }
    });

    // 상태 업데이트 (배송 시작 등)
    socket.on('order:status_update', (data: { order_id: string; status: string }) => {
      const { order_id, status } = data;

      console.log(`[Order Status] ${order_id} -> ${status}`);

      // 고객과 파트너에게 실시간 상태 업데이트
      io.to(`order_${order_id}`).emit('order:status_changed', {
        order_id,
        status,
        timestamp: new Date().toISOString(),
      });
    });

    // 파트너 통계 조회
    socket.on('partner:stats', async (data: { partner_id: string }) => {
      try {
        const stats = await callService.getCallStats(data.partner_id);
        socket.emit('partner:stats_response', stats);
      } catch (error) {
        socket.emit('partner:stats_error', { error: (error as Error).message });
      }
    });

    // 연결 해제
    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);

      // 파트너 소켓 목록에서 제거
      for (const [partnerId, sockets] of partnerSockets.entries()) {
        const index = sockets.indexOf(socket);
        if (index > -1) {
          sockets.splice(index, 1);
          console.log(`[Socket] Partner ${partnerId} socket removed`);
        }
      }
    });
  });

  return io;
}

export default initializeSocket;
