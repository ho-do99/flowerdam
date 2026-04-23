import { prisma } from '../utils/prisma';
import { OrderStatus } from '@prisma/client';
import { getIO } from '../utils/socket';
import { sendPushToRegion } from './push.service';
import { getCallConfig } from '../utils/config';

export async function dispatchCall(orderId: string, region: string): Promise<void> {
  const cfg = await getCallConfig();

  // 해당 지역 승인된 파트너(사장) 조회
  let partners = await prisma.user.findMany({
    where: {
      role: { in: ['PARTNER_OWNER'] },
      region,
      isApproved: true,
      isActive: true,
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  // 최대 파트너 수 제한
  if (cfg.maxPartners > 0) {
    partners = partners.slice(0, cfg.maxPartners);
  }

  if (partners.length === 0) {
    const io = getIO();
    io.to('admin').emit('no_partner', { orderId, region });
    return;
  }

  // 주문 상태 CALLING으로 변경
  await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.CALLING },
  });

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const io = getIO();
  const expiresAt = new Date(Date.now() + cfg.timeoutMs).toISOString();

  if (cfg.mode === 'sequential') {
    // 순차 발송: 첫 번째 파트너에게만 발송
    const first = partners[0];
    await prisma.callReceive.createMany({
      data: [{ orderId, partnerId: first.id, status: 'PENDING' }],
      skipDuplicates: true,
    });
    io.to(`partner:${first.id}`).emit('new_call', { orderId, order, expiresAt });
  } else {
    // 동시 발송 (broadcast)
    await prisma.callReceive.createMany({
      data: partners.map((p) => ({ orderId, partnerId: p.id, status: 'PENDING' })),
      skipDuplicates: true,
    });
    for (const partner of partners) {
      io.to(`partner:${partner.id}`).emit('new_call', { orderId, order, expiresAt });
    }
  }

  // 푸시 알림 발송
  await sendPushToRegion(region, {
    title: '🔔 새 주문 콜!',
    body: `${order?.deliveryRegion} ${order?.price?.toLocaleString()}원 - ${order?.recipientName}`,
    data: { type: 'new_call', orderId, order },
    channelId: 'calls',
  });

  // 타임아웃 후 미수락 처리
  setTimeout(() => handleCallTimeout(orderId, cfg.retryOnTimeout, region), cfg.timeoutMs);
}

async function handleCallTimeout(orderId: string, retry: boolean, region: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== OrderStatus.CALLING) return;

  await prisma.callReceive.updateMany({
    where: { orderId, status: 'PENDING' },
    data: { status: 'EXPIRED' },
  });

  const io = getIO();

  if (retry) {
    // 재발송: 새 콜 발송 (무한 루프 방지 위해 retry 없이)
    await dispatchCallOnce(orderId, region);
  } else {
    io.to('admin').emit('call_timeout', { orderId });
  }
}

// retry 없이 단순 재발송 (handleCallTimeout 에서만 호출)
async function dispatchCallOnce(orderId: string, region: string): Promise<void> {
  const cfg = await getCallConfig();

  let partners = await prisma.user.findMany({
    where: { role: { in: ['PARTNER_OWNER'] }, region, isApproved: true, isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (cfg.maxPartners > 0) partners = partners.slice(0, cfg.maxPartners);

  if (partners.length === 0) {
    const io = getIO();
    io.to('admin').emit('call_timeout', { orderId });
    return;
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  const io = getIO();
  const expiresAt = new Date(Date.now() + cfg.timeoutMs).toISOString();

  await prisma.callReceive.createMany({
    data: partners.map((p) => ({ orderId, partnerId: p.id, status: 'PENDING' })),
    skipDuplicates: true,
  });
  for (const partner of partners) {
    io.to(`partner:${partner.id}`).emit('new_call', { orderId, order, expiresAt });
  }

  setTimeout(async () => {
    const latest = await prisma.order.findUnique({ where: { id: orderId } });
    if (!latest || latest.status !== OrderStatus.CALLING) return;
    await prisma.callReceive.updateMany({
      where: { orderId, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
    io.to('admin').emit('call_timeout', { orderId });
  }, cfg.timeoutMs);
}
