import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { ok, created, badRequest, unauthorized, serverError } from '../utils/response';
import { UserRole } from '@prisma/client';
import { sendPushToUser } from '../services/push.service';
import { getIO } from '../utils/socket';

const registerSchema = z.object({
  name: z.string().min(2, '이름은 2자 이상이어야 합니다'),
  phone: z.string().regex(/^01[0-9]{8,9}$/, '올바른 전화번호를 입력해주세요'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
  role: z.nativeEnum(UserRole).default(UserRole.CUSTOMER),
  email: z.string().email().optional(),
  businessName: z.string().optional(),
  address: z.string().optional(),
  region: z.string().optional(),
  referralCode: z.string().optional(),
  ownerId: z.string().optional(), // PARTNER_STAFF 가입 시 소속 화원 사장 ID
});

const loginSchema = z.object({
  phone: z.string(),
  password: z.string(),
});

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.errors[0].message);
      return;
    }

    const { name, phone, password, role, email, businessName, address, region, referralCode, ownerId } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      badRequest(res, '이미 가입된 전화번호입니다');
      return;
    }

    // PARTNER_STAFF 가입 시 ownerId 필수 검증
    if (role === UserRole.PARTNER_STAFF) {
      if (!ownerId) {
        badRequest(res, '소속 화원을 선택해주세요');
        return;
      }
      const owner = await prisma.user.findFirst({
        where: { id: ownerId, role: UserRole.PARTNER_OWNER, isApproved: true, isActive: true },
      });
      if (!owner) {
        badRequest(res, '유효하지 않은 화원입니다');
        return;
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // CUSTOMER, SELLER: 즉시 승인 / PARTNER_OWNER: 관리자 승인 대기 / PARTNER_STAFF: 사장 승인 대기
    const isApproved = role === UserRole.CUSTOMER || role === UserRole.SELLER;
    const isActive = role !== UserRole.PARTNER_STAFF; // 직원은 사장 승인 전까지 로그인 불가

    // 셀러 추천 코드 생성 (SELLER 가입 시)
    let sellerReferralCode: string | undefined;
    if (role === UserRole.SELLER) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      sellerReferralCode = 'FD' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    const user = await prisma.user.create({
      data: {
        name, phone, passwordHash, role, email,
        businessName, address, region,
        isApproved,
        isActive,
        referralCode: sellerReferralCode,
        ownerId: role === UserRole.PARTNER_STAFF ? ownerId : undefined,
        wallet: { create: { balance: 0 } },
      },
      select: { id: true, name: true, phone: true, role: true, isApproved: true, isActive: true },
    });

    // 셀러 프로필 자동 생성
    if (role === UserRole.SELLER && sellerReferralCode) {
      const baseUrl = process.env.APP_BASE_URL ?? 'https://flowerdam.com';
      await prisma.sellerProfile.create({
        data: {
          userId: user.id,
          referralCode: sellerReferralCode,
          referralLink: `${baseUrl}/order?ref=${sellerReferralCode}`,
        },
      });
    }

    // 고객 추천인 처리 (추천 코드로 유입된 경우)
    if (role === UserRole.CUSTOMER && referralCode) {
      await prisma.user.update({
        where: { id: user.id },
        data: { referredBy: referralCode },
      });
    }

    // PARTNER_STAFF는 사장 승인 대기 상태 - 토큰 미발급
    if (role === UserRole.PARTNER_STAFF) {
      // 사장에게 푸시 + 소켓 알림
      sendPushToUser(ownerId!, {
        title: '👥 직원 가입 신청',
        body: `${name}님이 직원으로 가입 신청했습니다. 승인해주세요.`,
        data: { type: 'staff_request', staffId: user.id },
      }).catch(() => {});
      try {
        getIO().to(`partner:${ownerId}`).emit('staff_request', { staffId: user.id, name, phone });
      } catch {}
      created(res, { user, pending: true, message: '가입 신청이 완료되었습니다. 화원 사장님의 승인을 기다려주세요.' });
      return;
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

    created(res, { user, accessToken, refreshToken });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, '전화번호와 비밀번호를 입력해주세요');
      return;
    }

    const { phone, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      unauthorized(res, '전화번호 또는 비밀번호가 올바르지 않습니다');
      return;
    }

    // 직원 승인 대기 안내
    if (user.role === UserRole.PARTNER_STAFF && !user.isActive) {
      unauthorized(res, '승인 대기 중입니다. 화원 사장님의 승인을 기다려주세요');
      return;
    }

    if (!user.isActive) {
      unauthorized(res, '전화번호 또는 비밀번호가 올바르지 않습니다');
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      unauthorized(res, '전화번호 또는 비밀번호가 올바르지 않습니다');
      return;
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

    await prisma.log.create({
      data: { userId: user.id, action: 'LOGIN', ip: req.ip },
    });

    ok(res, {
      user: { id: user.id, name: user.name, role: user.role, isApproved: user.isApproved },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      unauthorized(res);
      return;
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user || user.refreshToken !== refreshToken) {
      unauthorized(res, '유효하지 않은 토큰입니다');
      return;
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    const newRefreshToken = signRefreshToken({ userId: user.id, role: user.role });

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: newRefreshToken } });

    ok(res, { accessToken, refreshToken: newRefreshToken });
  } catch {
    unauthorized(res, '토큰이 만료되었습니다');
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { refreshToken: null },
    });
    ok(res, null, '로그아웃 되었습니다');
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

export const savePushToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    if (!token) { badRequest(res, '토큰이 필요합니다'); return; }
    await prisma.user.update({ where: { id: req.user!.userId }, data: { pushToken: token } });
    ok(res, null, '푸시 토큰 저장 완료');
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// 직원 가입 시 소속 화원 선택을 위한 공개 파트너 목록
export const getPartnersList = async (req: Request, res: Response): Promise<void> => {
  try {
    const partners = await prisma.user.findMany({
      where: { role: UserRole.PARTNER_OWNER, isApproved: true, isActive: true },
      select: { id: true, name: true, businessName: true, region: true },
      orderBy: { businessName: 'asc' },
    });
    ok(res, partners);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

export const me = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, name: true, phone: true, email: true,
        role: true, isApproved: true, businessName: true,
        address: true, region: true, referralCode: true,
        createdAt: true,
        wallet: { select: { balance: true } },
      },
    });
    ok(res, user);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};
