import admin from 'firebase-admin';
import { getMessaging } from '../config/firebase';
import prisma from '../config/database';
import { NotificationType } from '@prisma/client';

interface FCMPayload {
  title: string;
  body: string;
  type: NotificationType;
  ref_id?: string;
  data?: Record<string, string>;
}

export const fcmService = {
  // 단일 사용자에게 푸시 발송
  async sendToUser(userId: string, payload: FCMPayload): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.fcm_token) {
        console.log(`⚠️  User ${userId} has no FCM token`);
        return false;
      }

      const messaging = getMessaging();
      if (!messaging) {
        console.warn('FCM not initialized');
        return false;
      }

      const messagePayload: admin.messaging.Message = {
        token: user.fcm_token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          type: String(payload.type),
          ref_id: payload.ref_id || '',
          ...(payload.data || {}),
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              alert: {
                title: payload.title,
                body: payload.body,
              },
            },
          },
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'flowerdam-notifications',
          },
        },
      };

      const messageId = await messaging.send(messagePayload);
      console.log(`✅ FCM sent to user ${userId}: ${messageId}`);

      // DB에 알림 기록
      await prisma.notification.create({
        data: {
          user_id: userId,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          ref_id: payload.ref_id,
        },
      });

      return true;
    } catch (error) {
      console.error(`❌ FCM send error for user ${userId}:`, error);
      return false;
    }
  },

  // 다중 사용자에게 푸시 발송
  async sendToUsers(userIds: string[], payload: FCMPayload): Promise<number> {
    let successCount = 0;
    for (const userId of userIds) {
      const success = await this.sendToUser(userId, payload);
      if (success) successCount++;
    }
    return successCount;
  },

  // Topic 기반 푸시 발송 (예: 지역별 파트너)
  async sendToTopic(topic: string, payload: FCMPayload): Promise<boolean> {
    try {
      const messaging = getMessaging();
      if (!messaging) {
        console.warn('FCM not initialized');
        return false;
      }

      const messagePayload: admin.messaging.Message = {
        topic,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          type: String(payload.type),
          ref_id: payload.ref_id || '',
          ...(payload.data || {}),
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              alert: {
                title: payload.title,
                body: payload.body,
              },
            },
          },
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'flowerdam-notifications',
          },
        },
      };

      const messageId = await messaging.send(messagePayload);
      console.log(`✅ FCM sent to topic ${topic}: ${messageId}`);
      return true;
    } catch (error) {
      console.error(`❌ FCM topic send error for ${topic}:`, error);
      return false;
    }
  },

  // 특정 지역의 모든 파트너에게 푸시 발송
  async sendToPartnersByRegion(region: string, payload: FCMPayload): Promise<number> {
    try {
      // 지역 내 활성 파트너의 모든 사용자(owner + staff) 조회
      const partners = await prisma.partner.findMany({
        where: {
          region,
          status: 'ACTIVE',
        },
        select: { owner_id: true },
      });

      const staffUsers = await prisma.user.findMany({
        where: {
          role: 'partner_staff',
          status: 'ACTIVE',
          partner_id: {
            in: partners.map((p: any) => p.owner_id),
          },
        },
        select: { id: true },
      });

      const ownerUsers = await prisma.user.findMany({
        where: {
          id: {
            in: partners.map((p: any) => p.owner_id),
          },
        },
        select: { id: true },
      });

      const allUserIds = [
        ...staffUsers.map((u: any) => u.id),
        ...ownerUsers.map((u: any) => u.id),
      ];

      return await this.sendToUsers(allUserIds, payload);
    } catch (error) {
      console.error(`❌ Error sending to partners in region ${region}:`, error);
      return 0;
    }
  },

  // 주문 콜 알림
  async notifyOrderCall(region: string, orderId: string): Promise<number> {
    return this.sendToPartnersByRegion(region, {
      title: '새로운 주문이 들어왔습니다',
      body: '빠르게 수락해주세요!',
      type: 'ORDER_CALL',
      ref_id: orderId,
      data: { orderId },
    });
  },

  // 주문 수락 알림 (고객에게)
  async notifyOrderAccepted(customerId: string, orderId: string): Promise<boolean> {
    return this.sendToUser(customerId, {
      title: '주문이 수락되었습니다',
      body: '가맹점이 귀사의 주문을 수락했습니다. 배송 준비 중입니다.',
      type: 'ORDER_ACCEPTED',
      ref_id: orderId,
      data: { orderId },
    });
  },

  // 작업 시작 알림
  async notifyOrderInProgress(customerId: string, orderId: string): Promise<boolean> {
    return this.sendToUser(customerId, {
      title: '화환 제작이 시작되었습니다',
      body: '가맹점에서 화환을 만들고 있습니다.',
      type: 'ORDER_IN_PROGRESS',
      ref_id: orderId,
      data: { orderId },
    });
  },

  // 배송 시작 알림
  async notifyOrderDelivering(customerId: string, orderId: string): Promise<boolean> {
    return this.sendToUser(customerId, {
      title: '배송이 시작되었습니다',
      body: '화환이 배송 중입니다. 곧 도착합니다.',
      type: 'ORDER_DELIVERING',
      ref_id: orderId,
      data: { orderId },
    });
  },

  // 배송 완료 알림
  async notifyOrderCompleted(customerId: string, orderId: string): Promise<boolean> {
    return this.sendToUser(customerId, {
      title: '배송이 완료되었습니다',
      body: '현장 사진을 확인해주세요.',
      type: 'ORDER_COMPLETED',
      ref_id: orderId,
      data: { orderId },
    });
  },

  // 주문 취소 알림
  async notifyOrderCancelled(customerId: string, orderId: string): Promise<boolean> {
    return this.sendToUser(customerId, {
      title: '주문이 취소되었습니다',
      body: '결제 금액이 환불됩니다.',
      type: 'ORDER_CANCELLED',
      ref_id: orderId,
      data: { orderId },
    });
  },

  // 가맹점 승인 알림
  async notifyPartnerApproved(partnerId: string): Promise<boolean> {
    return this.sendToUser(partnerId, {
      title: '가맹점 가입이 승인되었습니다',
      body: '꽃담 플랫폼에서 주문을 수신할 수 있습니다.',
      type: 'PARTNER_APPROVED',
      ref_id: partnerId,
    });
  },

  // 가맹점 거절 알림
  async notifyPartnerRejected(partnerId: string, reason?: string): Promise<boolean> {
    return this.sendToUser(partnerId, {
      title: '가맹점 가입이 거절되었습니다',
      body: reason || '관리자에게 문의해주세요.',
      type: 'PARTNER_REJECTED',
      ref_id: partnerId,
    });
  },

  // 직원 가입 신청 알림
  async notifyStaffSignupRequest(ownerUserId: string, staffName: string): Promise<boolean> {
    return this.sendToUser(ownerUserId, {
      title: `${staffName} 직원이 가입을 신청했습니다`,
      body: '앱에서 승인/거절 처리해주세요.',
      type: 'STAFF_SIGNUP_REQUEST',
    });
  },

  // 직원 승인 알림
  async notifyStaffApproved(staffUserId: string): Promise<boolean> {
    return this.sendToUser(staffUserId, {
      title: '가입이 승인되었습니다',
      body: '이제 주문을 수신할 수 있습니다.',
      type: 'STAFF_APPROVED',
      ref_id: staffUserId,
    });
  },

  // 수수료 적립 알림
  async notifyCommissionEarned(sellerId: string, amount: number): Promise<boolean> {
    return this.sendToUser(sellerId, {
      title: '수수료가 적립되었습니다',
      body: `₩${amount.toLocaleString('ko-KR')}가 적립되었습니다.`,
      type: 'COMMISSION_EARNED',
      data: { amount: amount.toString() },
    });
  },

  // 미배정 주문 알림 (관리자)
  async notifyUnassignedOrder(orderId: string): Promise<boolean> {
    try {
      const adminUsers = await prisma.user.findMany({
        where: { role: 'admin', status: 'ACTIVE' },
        select: { id: true },
      });

      return (await this.sendToUsers(
        adminUsers.map((u: any) => u.id),
        {
          title: '미배정 주문 발생',
          body: '60초 내 수락이 없는 주문입니다. 수동 배정이 필요합니다.',
          type: 'UNASSIGNED_ORDER',
          ref_id: orderId,
          data: { orderId },
        }
      )) > 0;
    } catch (error) {
      console.error('Error notifying unassigned order:', error);
      return false;
    }
  },

  // 이상 거래 감지 알림 (관리자)
  async notifyFraudDetected(fraudAlertId: string, description: string): Promise<boolean> {
    try {
      const adminUsers = await prisma.user.findMany({
        where: { role: 'admin', status: 'ACTIVE' },
        select: { id: true },
      });

      return (await this.sendToUsers(
        adminUsers.map((u: any) => u.id),
        {
          title: '이상 거래 감지됨',
          body: description,
          type: 'FRAUD_DETECTED',
          ref_id: fraudAlertId,
          data: { fraudAlertId },
        }
      )) > 0;
    } catch (error) {
      console.error('Error notifying fraud detection:', error);
      return false;
    }
  },

  // FCM 토큰 업데이트
  async updateFCMToken(userId: string, token: string): Promise<boolean> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { fcm_token: token },
      });
      console.log(`✅ FCM token updated for user ${userId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating FCM token for user ${userId}:`, error);
      return false;
    }
  },

  // Topic 구독 (지역별)
  async subscribeToRegionTopic(token: string, region: string): Promise<boolean> {
    try {
      const messaging = getMessaging();
      if (!messaging) {
        console.warn('FCM not initialized');
        return false;
      }

      const topic = `region_${region.toLowerCase().replace(/\s+/g, '_')}`;
      await messaging.subscribeToTopic(token, topic);
      console.log(`✅ Token subscribed to topic ${topic}`);
      return true;
    } catch (error) {
      console.error('Error subscribing to topic:', error);
      return false;
    }
  },

  // Topic 구독 해제
  async unsubscribeFromRegionTopic(token: string, region: string): Promise<boolean> {
    try {
      const messaging = getMessaging();
      if (!messaging) {
        console.warn('FCM not initialized');
        return false;
      }

      const topic = `region_${region.toLowerCase().replace(/\s+/g, '_')}`;
      await messaging.unsubscribeFromTopic(token, topic);
      console.log(`✅ Token unsubscribed from topic ${topic}`);
      return true;
    } catch (error) {
      console.error('Error unsubscribing from topic:', error);
      return false;
    }
  },
};
