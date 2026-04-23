import { Response } from 'express';

export const ok = (res: Response, data: unknown, message = 'success') =>
  res.status(200).json({ success: true, message, data });

export const created = (res: Response, data: unknown, message = 'created') =>
  res.status(201).json({ success: true, message, data });

export const badRequest = (res: Response, message: string) =>
  res.status(400).json({ success: false, message });

export const unauthorized = (res: Response, message = '인증이 필요합니다') =>
  res.status(401).json({ success: false, message });

export const forbidden = (res: Response, message = '권한이 없습니다') =>
  res.status(403).json({ success: false, message });

export const notFound = (res: Response, message = '리소스를 찾을 수 없습니다') =>
  res.status(404).json({ success: false, message });

export const serverError = (res: Response, message = '서버 오류가 발생했습니다') =>
  res.status(500).json({ success: false, message });
