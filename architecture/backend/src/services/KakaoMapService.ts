import axios from 'axios';

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || '';

const CATEGORY_CODES = {
  RESTAURANT: 'FD6',
  CAFE: 'CE7',
  CONVENIENCE: 'CS2',
  BAKERY: 'BK9',
  FAST_FOOD: 'FD8',
  JAPANESE: 'FD7',
  CHINESE: 'FD5',
  WESTERN: 'FD9',
};

interface KakaoPlace {
  id: number;
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  category_name: string;
  category_group_code: string;
  category_group_name: string;
  phone: string;
  place_url: string;
  distance: string;
}

interface KakaoSearchResult {
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
  };
  documents: KakaoPlace[];
}

export interface RestaurantSyncData {
  kakaoPlaceId: string;
  name: string;
  address: string;
  roadAddress: string | null;
  latitude: number;
  longitude: number;
  category: string | null;
  categoryGroup: string | null;
  phone: string | null;
  placeUrl: string | null;
  isOpen: boolean;
  menuItems: MenuItemData[];
}

interface MenuItemData {
  name: string;
  price: number;
  description?: string;
}

export class KakaoMapService {
  private static instance: KakaoMapService;
  private baseUrl = 'https://dapi.kakao.com/v2/local';

  static getInstance(): KakaoMapService {
    if (!KakaoMapService.instance) {
      KakaoMapService.instance = new KakaoMapService();
    }
    return KakaoMapService.instance;
  }

  async searchByKeyword(
    query: string,
    categoryGroupCode?: string,
    page: number = 1,
    size: number = 15
  ): Promise<KakaoSearchResult> {
    try {
      const params: Record<string, string | number> = {
        query,
        page,
        size,
      };

      if (categoryGroupCode) {
        params.category_group_code = categoryGroupCode;
      }

      const response = await axios.get(`${this.baseUrl}/search/keyword.json`, {
        params,
        headers: {
          'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Kakao API search error:', error.response?.data || error.message);
      throw new Error('Failed to search places from Kakao');
    }
  }

  async searchByCategory(
    categoryCode: string,
    latitude: number,
    longitude: number,
    radius: number = 5000,
    page: number = 1,
    size: number = 15
  ): Promise<KakaoSearchResult> {
    try {
      const response = await axios.get(`${this.baseUrl}/search/category.json`, {
        params: {
          category_group_code: categoryCode,
          x: longitude,
          y: latitude,
          radius,
          page,
          size,
        },
        headers: {
          'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Kakao API category search error:', error.response?.data || error.message);
      throw new Error('Failed to search places by category from Kakao');
    }
  }

  async getPlaceDetail(placeId: string): Promise<RestaurantSyncData | null> {
    return null;
  }

  async searchOpenRestaurantsInArea(
    areaQuery: string,
    radiusKm: number = 5.0,
    page: number = 1
  ): Promise<KakaoPlace[]> {
    try {
      const result = await this.searchByKeyword(
        `${areaQuery} 음식점`,
        CATEGORY_CODES.RESTAURANT,
        page,
        30
      );

      return result.documents;
    } catch (error) {
      console.error('Kakao area search error:', error);
      return [];
    }
  }

  async getCoordinateFromAddress(address: string): Promise<{ x: number; y: number } | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/search/address.json`, {
        params: { query: address },
        headers: {
          'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`,
        },
      });

      if (response.data.documents.length > 0) {
        const addressInfo = response.data.documents[0];
        return {
          x: parseFloat(addressInfo.x),
          y: parseFloat(addressInfo.y),
        };
      }

      return null;
    } catch (error) {
      console.error('Kakao geocoding error:', error);
      return null;
    }
  }

  convertToSyncData(places: KakaoPlace[]): RestaurantSyncData[] {
    return places.map((place) => ({
      kakaoPlaceId: String(place.id),
      name: place.place_name,
      address: place.address_name,
      roadAddress: place.road_address_name || null,
      latitude: parseFloat(place.y),
      longitude: parseFloat(place.x),
      category: place.category_name,
      categoryGroup: place.category_group_name,
      phone: place.phone || null,
      placeUrl: place.place_url || null,
      isOpen: true,
      menuItems: [],
    }));
  }
}

export const kakaoMapService = KakaoMapService.getInstance();
