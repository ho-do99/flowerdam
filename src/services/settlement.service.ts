import { prisma } from '../utils/prisma';
import { SettlementType, SettlementStatus } from '@prisma/client';
import { sendPushToUser } from './push.service';

const SELLER_RATE = 0.15;
const PARTNER_RATE = 0.56;
const PG_RATE = 0.033;
const INSTANT_WITHDRAWAL_FEE = 1000; // 즉시출금 수수료 1,000원

export function calculateAmounts(price: number) {
  const pgFee = Math.round(price * PG_RATE);
  const sellerAmount = Math.round(price * SELLER_RATE);
  const partnerAmount = Math.round(price * PARTNER_RATE);
  const platformAmount = price - pgFee - sellerAmount - partnerAmount;

  return { pgFee, sellerAmount, partnerAmount, platformAmount };
}

// 주문 확인 후 D+1 정산 생성
export async function createSettlements(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.partnerId) return;

  const settlements = [];

  // 화원 정산
  if (order.partnerAmount) {
    settlements.push({
      userId: order.partnerId,
      orderId,
      amount: order.partnerAmount,
      fee: 0,
      netAmount: order.partnerAmount,
      type: SettlementType.SETTLEMENT,
      status: SettlementStatus.PENDING,
    });
  }

  // 셀러 정산
  if (order.sellerId && order.sellerAmount) {
    settlements.push({
      userId: order.sellerId,
      orderId,
      amount: order.sellerAmount,
      fee: 0,
      netAmount: order.sellerAmount,
      type: SettlementType.SETTLEMENT,
      status: SettlementStatus.PENDING,
    });

    // SellerCommission 기록 + SellerProfile 누적 업데이트
    const existing = await prisma.sellerCommission.findUnique({ where: { orderId } });
    if (!existing) {
      await prisma.sellerCommission.create({
        data: {
          sellerId: order.sellerId,
          orderId,
          commissionAmount: order.sellerAmount,
          status: 'PENDING',
        },
      });
      await prisma.sellerProfile.updateMany({
        where: { userId: order.sellerId },
        data: {
          totalCommissionEarned: { increment: order.sellerAmount },
          pendingCommission: { increment: order.sellerAmount },
        },
      });
    }
  }

  if (settlements.length > 0) {
    await prisma.settlement.createMany({ data: settlements });
  }
}

// D+1 정산 실행 (스케줄러에서 호출)
export async function processDailySettlements(): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingSettlements = await prisma.settlement.findMany({
    where: {
      status: SettlementStatus.PENDING,
      type: SettlementType.SETTLEMENT,
      createdAt: { gte: yesterday, lt: today },
    },
  });

  for (const settlement of pendingSettlements) {
    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId: settlement.userId },
        data: { balance: { increment: settlement.netAmount } },
      }),
      prisma.walletTransaction.create({
        data: {
          walletId: (await prisma.wallet.findUnique({ where: { userId: settlement.userId } }))!.id,
          amount: settlement.netAmount,
          type: 'EARN',
          memo: `주문 정산 (D+1)`,
        },
      }),
      prisma.settlement.update({
        where: { id: settlement.id },
        data: { status: SettlementStatus.COMPLETED, settledAt: new Date() },
      }),
    ]);

    // 정산 완료 푸시 알림
    await sendPushToUser(settlement.userId, {
      title: '💰 정산 완료',
      body: `${settlement.netAmount.toLocaleString()}원이 앱머니로 적립되었습니다.`,
      data: { type: 'settlement', amount: settlement.netAmount },
    });
  }
}

// 즉시출금
export async function requestInstantWithdrawal(
  userId: string,
  amount: number
): Promise<{ success: boolean; message: string }> {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) return { success: false, message: '지갑을 찾을 수 없습니다' };

  const total = amount + INSTANT_WITHDRAWAL_FEE;
  if (wallet.balance < total) {
    return { success: false, message: '잔액이 부족합니다' };
  }

  await prisma.$transaction([
    prisma.wallet.update({
      where: { userId },
      data: { balance: { decrement: total } },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: -total,
        type: 'WITHDRAW',
        memo: `즉시출금 (수수료 ${INSTANT_WITHDRAWAL_FEE.toLocaleString()}원 포함)`,
      },
    }),
    prisma.settlement.create({
      data: {
        userId,
        amount,
        fee: INSTANT_WITHDRAWAL_FEE,
        netAmount: amount,
        type: SettlementType.INSTANT,
        status: SettlementStatus.PENDING,
      },
    }),
  ]);

  return { success: true, message: '즉시출금 신청이 완료되었습니다' };
}
