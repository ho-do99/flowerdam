import prisma from '../config/database';

export interface CreateSellerInput {
  user_id: string;
  sns_info?: string;
}

export interface SellerResponse {
  id: string;
  referral_code: string;
  referral_link: string;
  total_commission_earned: number;
  pending_commission: number;
  status: string;
}

export class SellerService {
  async createSellerProfile(input: CreateSellerInput): Promise<SellerResponse> {
    // 고유한 referral_code 생성
    const referralCode = this.generateReferralCode();

    const seller = await prisma.seller.create({
      data: {
        user_id: input.user_id,
        referral_code: referralCode,
        referral_link: `https://flowerdam.com/order?ref=${referralCode}`,
        sns_info: input.sns_info,
        status: 'ACTIVE',
      },
    });

    return this.formatSellerResponse(seller);
  }

  async getSellerByUserId(userId: string): Promise<SellerResponse | null> {
    const seller = await prisma.seller.findUnique({
      where: { user_id: userId },
    });

    return seller ? this.formatSellerResponse(seller) : null;
  }

  async getSellerCommissions(sellerId: string, status?: string) {
    const where: any = { seller_id: sellerId };
    if (status) {
      where.status = status;
    }

    const commissions = await prisma.sellerCommission.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    const toNum = (val: any) => (typeof val === 'number' ? val : val.toNumber());

    const total = commissions.reduce((sum, c) => sum + toNum(c.commission_amount), 0);

    const pending = commissions
      .filter(c => c.status === 'PENDING')
      .reduce((sum, c) => sum + toNum(c.commission_amount), 0);

    const paid = commissions
      .filter(c => c.status === 'PAID')
      .reduce((sum, c) => sum + toNum(c.commission_amount), 0);

    return {
      commissions: commissions.map(c => ({
        id: c.id,
        order_id: c.order_id,
        amount: toNum(c.commission_amount),
        status: c.status,
        paid_at: c.paid_at?.toISOString(),
        created_at: c.created_at.toISOString(),
      })),
      total,
      pending,
      paid,
    };
  }

  async recordReferralClick(sellerId: string, ipAddress?: string, userAgent?: string) {
    const click = await prisma.sellerReferralClick.create({
      data: {
        seller_id: sellerId,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    });

    return {
      id: click.id,
      seller_id: click.seller_id,
      clicked_at: click.clicked_at.toISOString(),
    };
  }

  async requestWithdrawal(
    sellerId: string,
    amount: number,
    withdrawalType: 'REGULAR' | 'INSTANT'
  ) {
    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new Error('Seller not found');
    }

    const toNum = (val: any) => (typeof val === 'number' ? val : val.toNumber());
    const pendingAmount = toNum(seller.pending_commission);
    if (pendingAmount < amount) {
      throw new Error('Insufficient pending commission');
    }

    const fee = withdrawalType === 'INSTANT' ? amount * 0.015 : 0;

    // 출금 기록 생성 (Settlement 레코드)
    const settlement = await prisma.settlement.create({
      data: {
        partner_id: sellerId,
        order_id: '',
        amount,
        type: withdrawalType === 'INSTANT' ? 'INSTANT' : 'REGULAR',
        fee_amount: fee,
        status: 'PENDING',
      },
    });

    return {
      id: settlement.id,
      seller_id: sellerId,
      amount,
      fee,
      type: withdrawalType,
      status: settlement.status,
      created_at: settlement.created_at.toISOString(),
    };
  }

  async getSellerStats(
    sellerId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'monthly'
  ) {
    const clicks = await prisma.sellerReferralClick.count({
      where: { seller_id: sellerId },
    });

    const conversions = await prisma.sellerReferralClick.count({
      where: { seller_id: sellerId, converted: true },
    });

    const commissions = await prisma.sellerCommission.findMany({
      where: { seller_id: sellerId },
    });

    const toNum = (val: any) => (typeof val === 'number' ? val : val.toNumber());
    const revenue = commissions.reduce((sum, c) => sum + toNum(c.commission_amount), 0);

    return {
      clicks,
      conversions,
      conversionRate: clicks > 0 ? ((conversions / clicks) * 100).toFixed(2) : '0.00',
      revenue,
      period,
    };
  }

  private generateReferralCode(): string {
    return `SELLER_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }

  private formatSellerResponse(seller: any): SellerResponse {
    return {
      id: seller.id,
      referral_code: seller.referral_code,
      referral_link: seller.referral_link,
      total_commission_earned:
        seller.total_commission_earned.toNumber?.() || seller.total_commission_earned,
      pending_commission: seller.pending_commission.toNumber?.() || seller.pending_commission,
      status: seller.status,
    };
  }
}

export const sellerService = new SellerService();
