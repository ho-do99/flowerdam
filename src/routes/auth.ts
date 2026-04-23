import { Router, Request, Response } from 'express';
import { userService } from '../services/userService';
import { fcmService } from '../services/fcmService';
import { createTokens, verifyRefreshToken } from '../utils/jwt';
import { authenticate } from '../middleware/authenticate';
import { verifyPassword } from '../utils/password';
import { validateEmail, validatePassword as validatePasswordStrength, validatePhone, validateRole } from '../utils/validation';

const router = Router();

// 회원가입
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone, role, partner_id } = req.body;

    // 필수 필드 검증
    if (!email || !password || !name || !phone || !role) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing required fields' },
      });
    }

    // 직원 역할은 partner_id 필수
    if (role === 'partner_staff' && !partner_id) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'partner_id is required for partner_staff role' },
      });
    }

    // 이메일 형식 검증
    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Invalid email format' },
      });
    }

    // 비밀번호 강도 검증
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: passwordValidation.message },
      });
    }

    // 휴대폰 번호 검증
    if (!validatePhone(phone)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PHONE', message: 'Invalid phone number format' },
      });
    }

    // 역할 검증
    if (!validateRole(role)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: 'Invalid role' },
      });
    }

    // 사용자 생성
    const user = await userService.createUser({
      email,
      password,
      name,
      phone,
      role,
      partner_id: role === 'partner_staff' ? partner_id : undefined,
    });

    res.status(201).json({
      success: true,
      data: {
        message: 'User registered successfully',
        user,
      },
    });
  } catch (error: any) {
    if (error.message === 'Email already exists') {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'Email already exists' },
      });
    }

    res.status(500).json({
      success: false,
      error: { code: 'REGISTER_ERROR', message: 'Failed to register user' },
    });
  }
});

// 로그인
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email and password required' },
      });
    }

    // DB에서 사용자 조회
    const user = await userService.getUserWithPassword(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    // 비밀번호 검증
    const isPasswordValid = await verifyPassword(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    // 토큰 발급
    const { accessToken, refreshToken, accessExpiry, refreshExpiry } = createTokens(
      user.id,
      user.email,
      user.role
    );

    // Refresh Token DB에 저장
    const refreshTokenExpiresAt = new Date(refreshExpiry * 1000);
    await userService.saveRefreshToken(user.id, refreshToken, refreshTokenExpiresAt);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        accessExpiry,
        refreshExpiry,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'LOGIN_ERROR', message: 'Failed to login' },
    });
  }
});

// Access Token 갱신
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Refresh token required' },
      });
    }

    // Refresh Token 검증
    const payload = verifyRefreshToken(refreshToken);

    if (!payload) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' },
      });
    }

    // 토큰이 DB에 존재하는지 확인
    const storedToken = await userService.getRefreshToken(payload.userId, refreshToken);

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_NOT_FOUND', message: 'Refresh token not found' },
      });
    }

    // 사용자 정보 조회
    const user = await userService.getUserById(payload.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    // 새 Access Token 발급
    const { accessToken, accessExpiry } = createTokens(
      user.id,
      user.email,
      user.role
    );

    res.json({
      success: true,
      data: {
        accessToken,
        accessExpiry,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'REFRESH_ERROR', message: 'Failed to refresh token' },
    });
  }
});

// 로그아웃
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Refresh token required' },
      });
    }

    // Refresh Token DB에서 삭제
    await userService.deleteRefreshToken(refreshToken);

    res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'LOGOUT_ERROR', message: 'Failed to logout' },
    });
  }
});

// 카카오 본인인증 검증
router.post('/kakao-verify', async (req: Request, res: Response) => {
  try {
    const { authCode } = req.body;

    if (!authCode) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Auth code required' },
      });
    }

    // TODO: 실제 카카오 API 연동
    // 현재는 mock 응답 반환
    // 실제 구현 시 kakao-auth SDK 사용

    res.json({
      success: true,
      data: {
        verified: true,
        name: 'Verified User',
        phone: '010-1234-5678',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'KAKAO_ERROR', message: 'Kakao verification failed' },
    });
  }
});

// FCM 토큰 업데이트
router.patch('/users/me/fcm-token', authenticate, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const userId = req.userId || '';

    if (!token || !userId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'FCM token and user ID required' },
      });
    }

    const success = await fcmService.updateFCMToken(userId, token);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: { code: 'FCM_UPDATE_ERROR', message: 'Failed to update FCM token' },
      });
    }

    res.json({
      success: true,
      data: { message: 'FCM token updated successfully' },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'FCM_ERROR', message: 'Failed to update FCM token' },
    });
  }
});

export default router;
