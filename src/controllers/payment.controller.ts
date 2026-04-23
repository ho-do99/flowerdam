import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { ok, badRequest, forbidden, notFound, serverError } from '../utils/response';
import { OrderStatus, UserRole } from '@prisma/client';
import { confirmTossPayment, cancelTossPayment } from '../services/toss.service';
import { dispatchCall } from '../services/call.service';

// POST /payments/prepare - 결제 준비 (토스 결제 정보 반환)
export const preparePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: { select: { name: true } } },
    });

    if (!order) {
      notFound(res);
      return;
    }

    if (order.customerId !== req.user!.userId) {
      forbidden(res);
      return;
    }

    if (order.status !== OrderStatus.PENDING) {
      badRequest(res, '결제 가능한 주문 상태가 아닙니다');
      return;
    }

    // 기존 결제 정보 재사용 또는 새로 생성
    let payment = await prisma.payment.findUnique({ where: { orderId } });
    if (!payment || payment.status === 'ABORTED' || payment.status === 'EXPIRED') {
      payment = await prisma.payment.create({
        data: {
          orderId,
          tossOrderId: `FD-${orderId.slice(-10)}-${Date.now()}`,
          amount: order.price,
          status: 'READY',
        },
      });
    }

    ok(res, {
      clientKey: process.env.TOSS_CLIENT_KEY ?? 'test_ck_placeholder',
      tossOrderId: payment.tossOrderId,
      amount: payment.amount,
      orderName: order.productName,
      customerName: order.customer.name,
    });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// POST /payments/confirm - 결제 확인 (토스 콜백 후 서버 검증)
export const confirmPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentKey, tossOrderId, amount } = req.body;

    const payment = await prisma.payment.findUnique({ where: { tossOrderId } });
    if (!payment) {
      notFound(res);
      return;
    }

    const order = await prisma.order.findUnique({ where: { id: payment.orderId } });
    if (!order || order.customerId !== req.user!.userId) {
      forbidden(res);
      return;
    }

    if (payment.status === 'DONE') {
      ok(res, { success: true, orderId: order.id, alreadyPaid: true });
      return;
    }

    if (payment.amount !== Number(amount)) {
      badRequest(res, '결제 금액이 일치하지 않습니다');
      return;
    }

    // 토스 API 최종 확인
    const tossResult = await confirmTossPayment(paymentKey, tossOrderId, Number(amount));

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        paymentKey,
        method: tossResult.method,
        status: 'DONE',
        approvedAt: new Date(tossResult.approvedAt),
        receiptUrl: tossResult.receipt?.url ?? null,
      },
    });

    await prisma.log.create({
      data: {
        userId: req.user!.userId,
        action: 'PAYMENT_CONFIRMED',
        detail: { orderId: order.id, paymentKey, amount },
      },
    });

    // 결제 완료 후 콜 발송
    dispatchCall(order.id, order.deliveryRegion).catch(console.error);

    ok(res, { success: true, orderId: order.id });
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : '결제 확인 중 오류가 발생했습니다';
    badRequest(res, msg);
  }
};

// POST /payments/cancel/:orderId - 주문 취소 + 환불
export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { cancelReason } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      notFound(res);
      return;
    }

    if (order.customerId !== req.user!.userId && req.user!.role !== UserRole.ADMIN) {
      forbidden(res);
      return;
    }

    const cancellable: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.CALLING, OrderStatus.ACCEPTED];
    if (!cancellable.includes(order.status)) {
      badRequest(res, '취소 가능한 주문 상태가 아닙니다. (작업 중인 주문은 고객센터 문의)');
      return;
    }

    const payment = await prisma.payment.findUnique({ where: { orderId } });

    // 결제 완료된 경우 토스 취소 API 호출
    if (payment?.paymentKey && payment.status === 'DONE') {
      await cancelTossPayment(
        payment.paymentKey,
        cancelReason ?? '고객 요청 취소'
      );
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'CANCELLED',
          cancelReason: cancelReason ?? '고객 요청 취소',
          cancelledAt: new Date(),
        },
      });
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
      }),
      prisma.callReceive.updateMany({
        where: { orderId, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      }),
    ]);

    // 셀러 수수료 취소 (PENDING 상태인 경우)
    const sellerCommission = await prisma.sellerCommission.findUnique({ where: { orderId } });
    if (sellerCommission && sellerCommission.status === 'PENDING') {
      await prisma.sellerCommission.update({
        where: { orderId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      await prisma.sellerProfile.updateMany({
        where: { userId: sellerCommission.sellerId },
        data: {
          totalCommissionEarned: { decrement: sellerCommission.commissionAmount },
          pendingCommission: { decrement: sellerCommission.commissionAmount },
        },
      });
    }

    await prisma.log.create({
      data: {
        userId: req.user!.userId,
        action: 'ORDER_CANCELLED',
        detail: { orderId, cancelReason, refunded: !!payment?.paymentKey },
      },
    });

    ok(res, {
      success: true,
      refunded: !!(payment?.paymentKey && payment.status === 'DONE'),
    });
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : '취소 처리 중 오류가 발생했습니다';
    badRequest(res, msg);
  }
};

// GET /payments/status/:orderId - 결제 상태 조회
export const getPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { orderId: req.params.orderId },
    });

    if (!payment) {
      ok(res, { status: 'NONE' });
      return;
    }

    ok(res, {
      status: payment.status,
      method: payment.method,
      amount: payment.amount,
      approvedAt: payment.approvedAt,
      receiptUrl: payment.receiptUrl,
    });
  } catch (err) {
    console.error(err);
    serverError(res);
  }
};

// GET /payments/checkout/:tossOrderId - 모바일 WebView용 결제 HTML 페이지
export const getCheckoutPage = async (req: Request, res: Response): Promise<void> => {
  const { tossOrderId } = req.params;
  const { amount, orderName, customerName } = req.query;
  const clientKey = process.env.TOSS_CLIENT_KEY ?? 'test_ck_placeholder';
  const baseUrl = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>꽃담 결제</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; }
    .header { background: #fff; padding: 20px 16px; border-bottom: 1px solid #f3f4f6; }
    .logo { font-size: 20px; font-weight: 700; color: #db2777; }
    .order-info { background: #fff; margin: 12px; border-radius: 12px; padding: 16px; }
    .order-info h3 { font-size: 13px; color: #6b7280; margin-bottom: 8px; }
    .order-name { font-size: 16px; font-weight: 600; color: #111827; }
    .order-amount { font-size: 24px; font-weight: 700; color: #db2777; margin-top: 4px; }
    #payment-widget { margin: 12px; }
    #agreement { margin: 0 12px; }
    .pay-btn {
      display: block; width: calc(100% - 24px); margin: 16px 12px;
      padding: 18px; background: #db2777; color: #fff;
      border: none; border-radius: 12px; font-size: 17px; font-weight: 700; cursor: pointer;
    }
    .pay-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .loading { text-align: center; padding: 40px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="header"><div class="logo">🌸 꽃담</div></div>
  <div class="order-info">
    <h3>주문 상품</h3>
    <div class="order-name">${orderName ?? '화환'}</div>
    <div class="order-amount">${Number(amount).toLocaleString('ko-KR')}원</div>
  </div>
  <div id="payment-widget"><div class="loading">결제 수단 로딩 중...</div></div>
  <div id="agreement"></div>
  <button id="pay-btn" class="pay-btn" disabled>결제하기</button>

  <script src="https://js.tosspayments.com/v2/standard"></script>
  <script>
    const clientKey = '${clientKey}';
    const tossOrderId = '${tossOrderId}';
    const amount = ${Number(amount)};
    const customerName = '${customerName ?? '고객'}';

    async function init() {
      const tossPayments = TossPayments(clientKey);
      const widgets = tossPayments.widgets({ customerKey: TossPayments.ANONYMOUS });

      await widgets.setAmount({ currency: 'KRW', value: amount });

      await Promise.all([
        widgets.renderPaymentMethods({ selector: '#payment-widget', variantKey: 'DEFAULT' }),
        widgets.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' }),
      ]);

      const btn = document.getElementById('pay-btn');
      btn.disabled = false;
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = '결제 처리 중...';
        try {
          await widgets.requestPayment({
            orderId: tossOrderId,
            orderName: '${orderName ?? '화환'}',
            customerName,
            successUrl: '${baseUrl}/api/payments/toss-callback/success',
            failUrl: '${baseUrl}/api/payments/toss-callback/fail',
          });
        } catch (e) {
          btn.disabled = false;
          btn.textContent = '결제하기';
          if (e.code !== 'USER_CANCEL') alert(e.message);
        }
      });
    }
    init().catch(console.error);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
};

// GET /payments/toss-callback/success - 토스 결제 성공 리다이렉트 (WebView 인터셉트용)
export const tossSuccessCallback = (req: Request, res: Response): void => {
  const { paymentKey, orderId, amount } = req.query;
  // WebView에서 이 URL을 인터셉트하여 앱에서 처리
  // 브라우저 직접 접근 시 안내 페이지 표시
  const html = `<!DOCTYPE html><html><body>
    <script>
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'PAYMENT_SUCCESS',
        paymentKey: '${paymentKey}',
        tossOrderId: '${orderId}',
        amount: ${amount}
      }));
    </script>
    <p style="text-align:center;padding:40px;font-family:sans-serif;">결제가 완료되었습니다. 앱으로 돌아가세요.</p>
  </body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
};

// GET /payments/toss-callback/fail - 토스 결제 실패 리다이렉트 (WebView 인터셉트용)
export const tossFailCallback = (req: Request, res: Response): void => {
  const { message, code } = req.query;
  const html = `<!DOCTYPE html><html><body>
    <script>
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'PAYMENT_FAIL',
        message: '${message ?? '결제에 실패했습니다'}',
        code: '${code ?? 'UNKNOWN'}'
      }));
    </script>
    <p style="text-align:center;padding:40px;font-family:sans-serif;">결제에 실패했습니다. 앱으로 돌아가세요.</p>
  </body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
};
