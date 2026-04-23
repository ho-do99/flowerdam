const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY ?? 'test_sk_placeholder';
const TOSS_API_BASE = 'https://api.tosspayments.com/v1/payments';

function authHeader(): string {
  return `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`;
}

export interface TossPaymentResult {
  paymentKey: string;
  orderId: string;
  status: string;
  method: string;
  totalAmount: number;
  approvedAt: string;
  receipt?: { url: string };
}

export async function confirmTossPayment(
  paymentKey: string,
  orderId: string,
  amount: number
): Promise<TossPaymentResult> {
  const res = await fetch(`${TOSS_API_BASE}/confirm`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  const data = await res.json() as TossPaymentResult & { message?: string };
  if (!res.ok) throw new Error(data.message ?? '결제 확인 실패');
  return data;
}

export async function cancelTossPayment(
  paymentKey: string,
  cancelReason: string,
  cancelAmount?: number
): Promise<void> {
  const body: Record<string, unknown> = { cancelReason };
  if (cancelAmount !== undefined) body.cancelAmount = cancelAmount;

  const res = await fetch(`${TOSS_API_BASE}/${paymentKey}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { message?: string };
  if (!res.ok) throw new Error(data.message ?? '결제 취소 실패');
}
