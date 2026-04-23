import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyAccessToken } from './jwt';

let io: Server;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('인증 토큰이 필요합니다'));

    try {
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('유효하지 않은 토큰입니다'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId, role } = socket.data.user;

    // 역할별 룸 자동 입장
    if (role === 'ADMIN') {
      socket.join('admin');
    } else if (role === 'PARTNER_OWNER') {
      socket.join(`partner:${userId}`);
    } else if (role === 'PARTNER_STAFF') {
      // 직원은 본인 룸 + 소속 사장 룸 입장
      socket.join(`partner:${userId}`);
      try {
        const { prisma } = await import('./prisma');
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { ownerId: true },
        });
        if (user?.ownerId) socket.join(`partner:${user.ownerId}`);
      } catch {
        // DB 조회 실패 시 무시
      }
    } else if (role === 'CUSTOMER') {
      socket.join(`customer:${userId}`);
    }

    socket.on('disconnect', () => {
      // cleanup if needed
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io가 초기화되지 않았습니다');
  return io;
}
