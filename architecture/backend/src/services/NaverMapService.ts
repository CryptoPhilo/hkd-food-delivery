import axios from 'axios';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';

export interface NaverPlace {
  id: string;
  name: string;
  address: string;
  roadAddress: string | null;
  mapx: string;
  mapy: string;
  category: string;
}

export interface NaverSearchResult {
  items: NaverPlace[];
  total: number;
}

export interface RestaurantSyncData {
  naverPlaceId: string;
  name: string;
  address: string;
  roadAddress: string | null;
  latitude: number;
  longitude: number;
  category: string | null;
  phone: string | null;
  isOpen: boolean;
}

export class NaverMapService {
  private static instance: NaverMapService;
  private baseUrl = 'https://openapi.naver.com/v1';

  static getInstance(): NaverMapService {
    if (!NaverMapService.instance) {
      NaverMapService.instance = new NaverMapService();
    }
    return NaverMapService.instance;
  }

  async searchPlaces(
    query: string,
    display: number = 10
  ): Promise<NaverSearchResult> {
    try {
      const response = await axios.get(`${this.baseUrl}/search/local.json`, {
        params: {
          query,
          display,
          start: 1,
          sort: 'sim',
        },
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        },
      });

      return {
        items: response.data.items.map((item: any) => ({
          id: `${item.mapx}_${item.mapy}_${item.title.replace(/<[^>]*>/g, '')}`,
          name: item.title.replace(/<[^>]*>/g, ''),
          address: item.address,
          roadAddress: item.roadAddress || null,
          mapx: item.mapx,
          mapy: item.mapy,
          category: item.category,
        })),
        total: response.data.total,
      };
    } catch (error: any) {
      console.error('Naver API search error:', error.response?.data || error.message);
      throw new Error('Failed to search places from Naver');
    }
  }

  convertToSyncData(place: NaverPlace): RestaurantSyncData {
    return {
      naverPlaceId: place.id,
      name: place.name,
      address: place.address,
      roadAddress: place.roadAddress,
      latitude: parseInt(place.mapy) / 10000000,
      longitude: parseInt(place.mapx) / 10000000,
      category: place.category || null,
      phone: null,
      isOpen: true,
    };
  }

  async searchOpenRestaurantsInArea(
    latitude: number,
    longitude: number,
    radiusKm: number = 3.0,
    query: string = '음식점'
  ): Promise<NaverPlace[]> {
    const searchRadius = Math.ceil(radiusKm * 1000);
    
    try {
      const response = await axios.get(`${this.baseUrl}/search/local.json`, {
        params: {
          query,
          display: 30,
          radius: searchRadius,
          sort: 'dist',
        },
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        },
      });

      const places = response.data.items.map((item: any) => ({
        id: `${item.mapx}_${item.mapy}_${item.title.replace(/<[^>]*>/g, '')}`,
        name: item.title.replace(/<[^>]*>/g, ''),
        address: item.address,
        roadAddress: item.roadAddress || null,
        mapx: item.mapx,
        mapy: item.mapy,
        category: item.category,
      }));

      const validPlaces = places.filter((place: NaverPlace) => {
        const placeLat = parseInt(place.mapy) / 10000000;
        const placeLng = parseInt(place.mapx) / 10000000;
        const distance = this.calculateDistance(latitude, longitude, placeLat, placeLng);
        return distance <= radiusKm;
      });

      return validPlaces;
    } catch (error) {
      console.error('Naver area search error:', error);
      return [];
    }
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const naverMapService = NaverMapService.getInstance();
