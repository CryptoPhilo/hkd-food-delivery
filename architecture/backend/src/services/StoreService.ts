import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CreateStoreInput {
  storeType: string;
  name: string;
  address: string;
  roadAddress?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  brandName?: string;
  operatingHours24?: boolean;
  deliveryRadius?: number;
  isActive?: boolean;
  isDeliverable?: boolean;
  description?: string;
  imageUrl?: string;
}

interface UpdateStoreInput {
  name?: string;
  address?: string;
  roadAddress?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  brandName?: string;
  operatingHours24?: boolean;
  deliveryRadius?: number;
  isActive?: boolean;
  isDeliverable?: boolean;
  description?: string;
  imageUrl?: string;
}

interface CreateProductInput {
  restaurantId: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  barcode?: string;
  stock?: number;
  requiresAgeVerification?: boolean;
  ageRestriction?: string;
  isAvailable?: boolean;
  isActive?: boolean;
  imageUrl?: string;
}

interface UpdateProductInput {
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  barcode?: string;
  stock?: number;
  requiresAgeVerification?: boolean;
  ageRestriction?: string;
  isAvailable?: boolean;
  isActive?: boolean;
  imageUrl?: string;
}

interface UpdateStockInput {
  quantity: number;
  operation: 'add' | 'subtract' | 'set';
}

export class StoreService {
  private static instance: StoreService;

  static getInstance(): StoreService {
    if (!StoreService.instance) {
      StoreService.instance = new StoreService();
    }
    return StoreService.instance;
  }

  async createStore(input: CreateStoreInput) {
    const { storeType, name, address, latitude, longitude, ...rest } = input;

    if (!name || !address || latitude === undefined || longitude === undefined) {
      throw new Error('필수 필드가 누락되었습니다');
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new Error('잘못된 좌표입니다');
    }

    return prisma.restaurant.create({
      data: {
        storeType: storeType || 'restaurant',
        name,
        address,
        latitude,
        longitude,
        ...rest,
      },
    });
  }

  async getStores(filters?: { storeType?: string; isActive?: boolean }) {
    const where: any = {};

    if (filters?.storeType) {
      where.storeType = filters.storeType;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return prisma.restaurant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStoreById(id: string) {
    const store = await prisma.restaurant.findUnique({
      where: { id },
      include: {
        menus: {
          where: { isActive: true },
          orderBy: { category: 'asc' },
        },
      },
    });

    if (!store) {
      throw new Error('Store not found');
    }

    return store;
  }

  async updateStore(id: string, input: UpdateStoreInput) {
    const store = await prisma.restaurant.findUnique({
      where: { id },
    });

    if (!store) {
      throw new Error('Store not found');
    }

    if (input.latitude !== undefined || input.longitude !== undefined) {
      const lat = input.latitude ?? store.latitude;
      const lng = input.longitude ?? store.longitude;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new Error('잘못된 좌표입니다');
      }
    }

    return prisma.restaurant.update({
      where: { id },
      data: input,
    });
  }

  async deleteStore(id: string) {
    const store = await prisma.restaurant.findUnique({
      where: { id },
    });

    if (!store) {
      throw new Error('Store not found');
    }

    return prisma.restaurant.delete({
      where: { id },
    });
  }

  async createProduct(input: CreateProductInput) {
    const { restaurantId, name, price, ...rest } = input;

    if (!restaurantId || !name || price === undefined) {
      throw new Error('필수 필드가 누락되었습니다');
    }

    if (price < 0) {
      throw new Error('가격은 0 이상이어야 합니다');
    }

    if (rest.stock !== undefined && rest.stock < 0) {
      throw new Error('재고는 0 이상이어야 합니다');
    }

    const store = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });

    if (!store) {
      throw new Error('Store not found');
    }

    const ageRestriction = rest.ageRestriction || 'none';
    const requiresAgeVerification = ageRestriction !== 'none' || rest.requiresAgeVerification || false;

    return prisma.menu.create({
      data: {
        restaurantId,
        name,
        price,
        ...rest,
        ageRestriction,
        requiresAgeVerification,
      },
    });
  }

  async getProducts(
    storeId: string,
    filters?: {
      category?: string;
      requiresAgeVerification?: boolean;
      availableOnly?: boolean;
    }
  ) {
    const where: any = { restaurantId: storeId };

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.requiresAgeVerification !== undefined) {
      where.requiresAgeVerification = filters.requiresAgeVerification;
    }

    if (filters?.availableOnly) {
      where.isAvailable = true;
    }

    return prisma.menu.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async updateProduct(id: string, input: UpdateProductInput) {
    const product = await prisma.menu.findUnique({
      where: { id },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    if (input.price !== undefined && input.price < 0) {
      throw new Error('가격은 0 이상이어야 합니다');
    }

    if (input.stock !== undefined && input.stock < 0) {
      throw new Error('재고는 0 이상이어야 합니다');
    }

    const updateData: any = { ...input };

    if (input.ageRestriction) {
      updateData.requiresAgeVerification = input.ageRestriction !== 'none';
    }

    return prisma.menu.update({
      where: { id },
      data: updateData,
    });
  }

  async updateStock(id: string, input: UpdateStockInput) {
    const product = await prisma.menu.findUnique({
      where: { id },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    let newStock: number;

    switch (input.operation) {
      case 'add':
        newStock = (product.stock || 0) + input.quantity;
        break;
      case 'subtract':
        newStock = (product.stock || 0) - input.quantity;
        break;
      case 'set':
        newStock = input.quantity;
        break;
      default:
        throw new Error('Invalid operation');
    }

    if (newStock < 0) {
      throw new Error('재고는 0 이상이어야 합니다');
    }

    const isAvailable = newStock > 0 ? product.isAvailable : false;

    return prisma.menu.update({
      where: { id },
      data: { stock: newStock, isAvailable },
    });
  }

  async deleteProduct(id: string) {
    const product = await prisma.menu.findUnique({
      where: { id },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    return prisma.menu.delete({
      where: { id },
    });
  }
}

export const storeService = StoreService.getInstance();
