import prisma from '../config/database';

export interface CreateProductInput {
  name: string;
  description?: string;
  price: number;
  category: string;
  image_url?: string;
}

export interface ProductResponse {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url?: string;
  is_active: boolean;
}

export class ProductService {
  async createProduct(input: CreateProductInput): Promise<ProductResponse> {
    const product = await prisma.product.create({
      data: {
        name: input.name,
        description: input.description,
        price: input.price,
        category: input.category,
        image_url: input.image_url,
        is_active: true,
      },
    });

    return this.formatProductResponse(product);
  }

  async getProducts(category?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where: any = { is_active: true };
    if (category) {
      where.category = category;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      data: products.map(p => this.formatProductResponse(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getProductById(id: string): Promise<ProductResponse | null> {
    const product = await prisma.product.findUnique({
      where: { id },
    });

    return product ? this.formatProductResponse(product) : null;
  }

  async updateProduct(id: string, input: Partial<CreateProductInput>): Promise<ProductResponse> {
    const updateData: any = {};

    if (input.name) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.price) updateData.price = input.price;
    if (input.category) updateData.category = input.category;
    if (input.image_url !== undefined) updateData.image_url = input.image_url;

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    return this.formatProductResponse(product);
  }

  async toggleProductStatus(id: string, isActive: boolean): Promise<ProductResponse> {
    const product = await prisma.product.update({
      where: { id },
      data: { is_active: isActive },
    });

    return this.formatProductResponse(product);
  }

  private formatProductResponse(product: any): ProductResponse {
    return {
      id: product.id,
      name: product.name,
      price: product.price.toNumber?.() || product.price,
      category: product.category,
      image_url: product.image_url,
      is_active: product.is_active,
    };
  }
}

export const productService = new ProductService();
