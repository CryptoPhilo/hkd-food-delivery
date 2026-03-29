import { PrismaClient } from '@prisma/client';
import { Restaurant, Menu } from '../types/prisma';

const prisma = new PrismaClient();

interface SyncRestaurantData {
  naverPlaceId: string;
  name: string;
  address: string;
  roadAddress?: string | null;
  latitude: number;
  longitude: number;
  category?: string | null;
  phone?: string | null;
  isOpen?: boolean;
  rating?: number | null;
  imageUrl?: string | null;
  menus?: {
    name: string;
    price: number;
    description?: string | null;
    isAvailable?: boolean;
  }[];
}

export class RestaurantSyncService {
  private static instance: RestaurantSyncService;

  static getInstance(): RestaurantSyncService {
    if (!RestaurantSyncService.instance) {
      RestaurantSyncService.instance = new RestaurantSyncService();
    }
    return RestaurantSyncService.instance;
  }

  async syncRestaurant(data: SyncRestaurantData): Promise<Restaurant> {
    const restaurantData = {
      naverPlaceId: data.naverPlaceId,
      name: data.name,
      address: data.address,
      roadAddress: data.roadAddress || null,
      latitude: data.latitude,
      longitude: data.longitude,
      category: data.category || null,
      phone: data.phone || null,
      businessStatus: data.isOpen ? 'open' : 'closed',
      rating: data.rating || null,
      imageUrl: data.imageUrl || null,
      isActive: true,
      isDeliverable: true,
    };

    const restaurant = await prisma.restaurant.upsert({
      where: { naverPlaceId: data.naverPlaceId },
      update: restaurantData,
      create: restaurantData,
    });

    if (data.menus && data.menus.length > 0) {
      await this.syncMenus(restaurant.id, data.menus);
    }

    return restaurant;
  }

  private async syncMenus(
    restaurantId: string,
    menus: SyncRestaurantData['menus']
  ): Promise<void> {
    if (!menus) return;
    for (const menu of menus) {
      const existingMenu = await prisma.menu.findFirst({
        where: {
          restaurantId,
          name: menu.name,
        },
      });

      if (existingMenu) {
        await prisma.menu.update({
          where: { id: existingMenu.id },
          data: {
            price: menu.price,
            description: menu.description || existingMenu.description,
            isAvailable: menu.isAvailable ?? existingMenu.isAvailable,
          },
        });
      } else {
        await prisma.menu.create({
          data: {
            restaurantId,
            name: menu.name,
            price: menu.price,
            description: menu.description || null,
            isAvailable: menu.isAvailable ?? true,
            isActive: true,
          },
        });
      }
    }
  }

  async setRestaurantVisibility(
    restaurantId: string,
    isActive: boolean
  ): Promise<Restaurant> {
    return prisma.restaurant.update({
      where: { id: restaurantId },
      data: { isActive: isActive },
    });
  }

  async setRestaurantDeliverable(
    restaurantId: string,
    isDeliverable: boolean
  ): Promise<Restaurant> {
    return prisma.restaurant.update({
      where: { id: restaurantId },
      data: { isDeliverable: isDeliverable },
    });
  }

  async setMenuVisibility(
    menuId: string,
    isAvailable: boolean
  ): Promise<Menu> {
    return prisma.menu.update({
      where: { id: menuId },
      data: { isAvailable: isAvailable },
    });
  }

  async getActiveRestaurantsInArea(
    latitude: number,
    longitude: number,
    radiusKm: number = 3.0
  ): Promise<Restaurant[]> {
    const minLat = latitude - (radiusKm / 111);
    const maxLat = latitude + (radiusKm / 111);
    const minLng = longitude - (radiusKm / (111 * Math.cos(latitude * Math.PI / 180)));
    const maxLng = longitude + (radiusKm / (111 * Math.cos(latitude * Math.PI / 180)));

    return prisma.restaurant.findMany({
      where: {
        isActive: true,
        isDeliverable: true,
        latitude: { gte: minLat, lte: maxLat },
        longitude: { gte: minLng, lte: maxLng },
        businessStatus: 'open',
      },
      include: {
        menus: {
          where: {
            isAvailable: true,
            isActive: true,
          },
        },
      },
    });
  }
}

export const restaurantSyncService = RestaurantSyncService.getInstance();
