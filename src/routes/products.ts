import { Router, Request, Response } from 'express';
import { productService } from '../services/productService';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/rbac';

const router = Router();

// 상품 목록 조회 (공개)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, page = '1', limit = '20' } = req.query;
    const products = await productService.getProducts(
      category as string | undefined,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_PRODUCTS_ERROR', message: 'Failed to fetch products' },
    });
  }
});

// 상품 상세 조회 (공개)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const product = await productService.getProductById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'GET_PRODUCT_ERROR', message: 'Failed to fetch product' },
    });
  }
});

// 상품 생성 (admin만)
router.post('/', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const { name, description, price, category, image_url } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Missing required fields' },
      });
    }

    const product = await productService.createProduct({
      name,
      description,
      price: parseFloat(price),
      category,
      image_url,
    });

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_PRODUCT_ERROR', message: 'Failed to create product' },
    });
  }
});

// 상품 정보 수정 (admin만)
router.patch('/:id', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_PRODUCT_ERROR', message: 'Failed to update product' },
    });
  }
});

// 상품 활성화/비활성화 (admin만)
router.patch(
  '/:id/status',
  authenticate,
  authorize(['admin']),
  async (req: Request, res: Response) => {
    try {
      const { is_active } = req.body;

      if (typeof is_active !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'is_active must be boolean' },
        });
      }

      const product = await productService.toggleProductStatus(req.params.id, is_active);

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'UPDATE_STATUS_ERROR', message: 'Failed to update status' },
      });
    }
  }
);

export default router;
