import { Request, Response } from 'express';
import { ok, badRequest, serverError } from '../utils/response';
import { predictDemand, detectAnomalies, suggestRibbonText } from '../services/ai.service';

// GET /api/ai/demand/:region - 수요 예측
export const getDemandPrediction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { region } = req.params;
    if (!region) {
      badRequest(res, '지역을 입력해주세요');
      return;
    }

    const result = await predictDemand(region);
    ok(res, result);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// GET /api/ai/anomaly/:userId - 이상 거래 감지 (관리자용)
export const getAnomalyCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await detectAnomalies(req.params.userId);
    ok(res, result);
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// POST /api/ai/ribbon - 리본 문구 추천
export const getRibbonSuggestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { occasion, senderName, recipientName } = req.body;
    if (!occasion || !senderName || !recipientName) {
      badRequest(res, '상황, 보내는 분, 받는 분을 입력해주세요');
      return;
    }

    const suggestions = await suggestRibbonText(occasion, senderName, recipientName);
    ok(res, { suggestions });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};
