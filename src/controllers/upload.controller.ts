import { Request, Response } from 'express';
import { uploadFile } from '../utils/storage';
import { ok, badRequest, serverError } from '../utils/response';

export const uploadImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      badRequest(res, '파일이 없습니다');
      return;
    }

    if (!file.mimetype.startsWith('image/')) {
      badRequest(res, '이미지 파일만 업로드 가능합니다');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      badRequest(res, '파일 크기는 10MB 이하이어야 합니다');
      return;
    }

    const url = await uploadFile(file.buffer, file.originalname, file.mimetype);
    ok(res, { url });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};
