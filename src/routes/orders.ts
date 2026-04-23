import { Router, Request, Response } from 'express';
import { orderService } from '../services/orderService';
import { fcmService } from '../services/fcmService';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/rbac';

const router = Router();

// 주문 생성 (customer만 가능)
router.post('/', authenticate, authorize(['customer']), async (req: Request, res: Response) => {
  try {
    const {
      product_id,
      recipient_name,
      delivery_place,
      delivery_address,
      delivery_datetime,
      ribbon_message,
      request_note,
      referred_by_seller_id,
      payment_method,
    } = req.body;

    if (!product_id || !recipient_name || !delivery_place || !delivery_address || !delivery_datetime) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing required fields' },
      });
    }

    const order = await orderService.createOrder({
      customer_id: req.userId || '',
      product_id,
      recipient_name,
      delivery_place,
      delivery_address,
      delivery_datetime,
      ribbon_message,
      request_note,
      referred_by_seller_id,
      payment_method: payment_method || 'card',
    });

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_ORDER_ERROR', message: 'Failed to create order' },
    });
  }
});

// 주문 목록 조회 (역할별 필터링)
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;

    // 역할별 필터링
    let userId: string | undefined;
    switch (req.userRole) {
      case 'customer':
        userId = req.userId;
        break;
      case 'partner_owner':
      case 'partner_staff':
        // TODO: assigned_staff_id 필터링 필요 (추후 구현)
        break;
      case 'admin':
        // admin은 전체 조회 가능
        break;
      default:
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Invalid role' },
        });
    }

    const orders = await orderService.getOrders(
      userId,
      status as string | undefined,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_ORDERS_ERROR', message: 'Failed to fetch orders' },
    });
  }
});

// 주문 상세 조회
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const order = await orderService.getOrderById(req.params.id, req.userId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Order not found' },
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_ORDER_ERROR', message: 'Failed to fetch order' },
    });
  }
});

// 주문 상태 변경
router.patch('/:id/status', authenticate, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Status required' },
      });
    }

    const order = await orderService.updateOrderStatus(req.params.id, status, req.userId);

    // FCM 알림 발송
    switch (status) {
      case 'ACCEPTED':
        await fcmService.notifyOrderAccepted(order.customer_id, order.id);
        break;
      case 'IN_PROGRESS':
        await fcmService.notifyOrderInProgress(order.customer_id, order.id);
        break;
      case 'DELIVERING':
        await fcmService.notifyOrderDelivering(order.customer_id, order.id);
        break;
      case 'COMPLETED':
        await fcmService.notifyOrderCompleted(order.customer_id, order.id);
        break;
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    if (error.message.includes('Cannot transition')) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: error.message },
      });
    }
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_ORDER_ERROR', message: 'Failed to update order' },
    });
  }
});

// 주문 취소
router.post('/:id/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Cancellation reason required' },
      });
    }

    const order = await orderService.cancelOrder(req.params.id, reason, req.userId || '');

    // 주문 취소 FCM 알림
    await fcmService.notifyOrderCancelled(order.customer_id, order.id);

    res.json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    if (error.message.includes('Cannot cancel')) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: error.message },
      });
    }
    res.status(500).json({
      success: false,
      error: { code: 'CANCEL_ORDER_ERROR', message: 'Failed to cancel order' },
    });
  }
});

// 배송 완료 사진 업로드
router.post('/:id/photos', authenticate, async (req: Request, res: Response) => {
  try {
    const { photo_urls } = req.body;

    if (!Array.isArray(photo_urls) || photo_urls.length === 0 || photo_urls.length > 5) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Photos must be 1-5 items' },
      });
    }

    const order = await orderService.uploadCompletionPhotos(req.params.id, photo_urls);

    res.json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
    if (error.message.includes('can only be uploaded') || error.message.includes('At least one photo')) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: error.message },
      });
    }
    res.status(500).json({
      success: false,
      error: { code: 'UPLOAD_PHOTOS_ERROR', message: 'Failed to upload photos' },
    });
  }
});

export default router;
