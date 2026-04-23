import { prisma } from '../utils/prisma';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  priority?: 'high' | 'normal';
  channelId?: string;
}

export async function sendPushToUser(userId: string, message: Omit<PushMessage, 'to'>): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pushToken: true } });
  if (!user?.pushToken) return;

  await sendPushNotification({ ...message, to: user.pushToken });
}

export async function sendPushToRegion(region: string, message: Omit<PushMessage, 'to'>): Promise<void> {
  const partners = await prisma.user.findMany({
    where: { role: 'PARTNER_OWNER', region, isApproved: true, isActive: true },
    select: { pushToken: true },
  });

  const tokens = partners.map((p) => p.pushToken).filter(Boolean) as string[];
  if (tokens.length === 0) return;

  await Promise.allSettled(tokens.map((token) => sendPushNotification({ ...message, to: token })));
}

async function sendPushNotification(message: PushMessage): Promise<void> {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...message, sound: 'default', priority: 'high' }),
    });
  } catch (err) {
    console.error('푸시 알림 전송 실패:', err);
  }
}
