import prisma from '../config/database';

export interface CreatePartnerInput {
  user_id: string;
  name: string;
  region: string;
  address: string;
  business_number: string;
}

export interface PartnerResponse {
  id: string;
  owner_id: string;
  name: string;
  region: string;
  address: string;
  status: string;
  created_at: string;
}

export interface StaffResponse {
  id: string;
  user_id: string;
  partner_id: string;
  name: string;
  status: string;
}

export class PartnerService {
  async createPartner(input: CreatePartnerInput): Promise<PartnerResponse> {
    // 파트너 프로필 생성 (가입 신청)
    const partner = await prisma.partner.create({
      data: {
        owner_id: input.user_id,
        name: input.name,
        region: input.region,
        address: input.address,
        business_number: input.business_number,
        status: 'PENDING',
      },
    });

    return this.formatPartnerResponse(partner);
  }

  async getPartnerByOwnerId(userId: string): Promise<PartnerResponse | null> {
    const partner = await prisma.partner.findUnique({
      where: { owner_id: userId },
    });

    return partner ? this.formatPartnerResponse(partner) : null;
  }

  async getPartnerById(id: string): Promise<PartnerResponse | null> {
    const partner = await prisma.partner.findUnique({
      where: { id },
    });

    return partner ? this.formatPartnerResponse(partner) : null;
  }

  async getPartnersByRegion(region: string, status: string = 'ACTIVE') {
    const partners = await prisma.partner.findMany({
      where: { region, status: status as any },
      orderBy: { created_at: 'desc' },
    });

    return partners.map(p => this.formatPartnerResponse(p));
  }

  async getPartnersByStatus(status: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [partners, total] = await Promise.all([
      prisma.partner.findMany({
        where: { status: status as any },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.partner.count({ where: { status: status as any } }),
    ]);

    return {
      data: partners.map(p => this.formatPartnerResponse(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async approvePartner(id: string, approvedBy: string): Promise<PartnerResponse> {
    const partner = await prisma.partner.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        approved_by: approvedBy,
        approved_at: new Date(),
      },
    });

    return this.formatPartnerResponse(partner);
  }

  async rejectPartner(id: string, rejectedBy: string): Promise<PartnerResponse> {
    const partner = await prisma.partner.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approved_by: rejectedBy,
        approved_at: new Date(),
      },
    });

    return this.formatPartnerResponse(partner);
  }

  async getPartnerStaff(partnerId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [staff, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          partner_id: partnerId,
          role: 'partner_staff',
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.user.count({
        where: {
          partner_id: partnerId,
          role: 'partner_staff',
        },
      }),
    ]);

    return {
      data: staff.map(s => ({
        id: s.id,
        user_id: s.id,
        partner_id: s.partner_id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        status: s.status,
        approved_at: s.approved_at?.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async approveStaff(staffId: string, partnerId: string): Promise<StaffResponse> {
    const staff = await prisma.user.update({
      where: { id: staffId },
      data: {
        status: 'ACTIVE',
        approved_at: new Date(),
      },
    });

    if (staff.partner_id !== partnerId) {
      throw new Error('Staff does not belong to this partner');
    }

    return this.formatStaffResponse(staff);
  }

  async rejectStaff(staffId: string, partnerId: string): Promise<StaffResponse> {
    const staff = await prisma.user.update({
      where: { id: staffId },
      data: {
        status: 'REJECTED',
        approved_at: new Date(),
      },
    });

    if (staff.partner_id !== partnerId) {
      throw new Error('Staff does not belong to this partner');
    }

    return this.formatStaffResponse(staff);
  }

  async getPartnerStats(partnerId: string) {
    const [orders, commissions, staff] = await Promise.all([
      prisma.order.count({
        where: { partner_id: partnerId },
      }),
      prisma.settlement.count({
        where: { partner_id: partnerId },
      }),
      prisma.user.count({
        where: { partner_id: partnerId, role: 'partner_staff' },
      }),
    ]);

    return {
      total_orders: orders,
      total_settlements: commissions,
      active_staff: staff,
    };
  }

  private formatPartnerResponse(partner: any): PartnerResponse {
    return {
      id: partner.id,
      owner_id: partner.owner_id,
      name: partner.name,
      region: partner.region,
      address: partner.address,
      status: partner.status,
      created_at: partner.created_at.toISOString(),
    };
  }

  private formatStaffResponse(staff: any): StaffResponse {
    return {
      id: staff.id,
      user_id: staff.id,
      partner_id: staff.partner_id,
      name: staff.name,
      status: staff.status,
    };
  }
}

export const partnerService = new PartnerService();
