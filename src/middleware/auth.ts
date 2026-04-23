import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { unauthorized, forbidden } from '../utils/response';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    unauthorized(res);
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    req.user = verifyAccessToken(token);
    next();
  } catch {
    unauthorized(res, '토큰이 유효하지 않습니다');
  }
};

export const requireRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      forbidden(res);
      return;
    }
    next();
  };
