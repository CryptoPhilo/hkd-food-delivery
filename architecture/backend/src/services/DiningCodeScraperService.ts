import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapedRestaurant {
  id: string;
  name: string;
  address: string;
  roadAddress: string | null;
  latitude: number;
  longitude: number;
  category: string | null;
  phone: string | null;
  menu: ScrapedMenuItem[];
  hasDelivery: boolean;
}

export interface ScrapedMenuItem {
  name: string;
  price: number | null;
  imageUrl: string | null;
}

const DEFAULT_FOOD_IMAGES: Record<string, string> = {
  '갈치': 'https://images.unsplash.com/photo-1580651315530-69c8e0026377?w=300&h=200&fit=crop',
  '고등어': 'https://images.unsplash.com/photo-1580651315530-69c8e0026377?w=300&h=200&fit=crop',
  '성게': 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=300&h=200&fit=crop',
  '전복': 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=300&h=200&fit=crop',
  '해물': 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=300&h=200&fit=crop',
  '새우': 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=300&h=200&fit=crop',
  '멜': 'https://images.unsplash.com/photo-1580651315530-69c8e0026377?w=300&h=200&fit=crop',
  '미역국': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300&h=200&fit=crop',
  '찌개': 'https://images.unsplash.com/photo-1_SenAyTAXg?w=300&h=200&fit=crop',
  '전골': 'https://images.unsplash.com/photo-1_SenAyTAXg?w=300&h=200&fit=crop',
  '국': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300&h=200&fit=crop',
  '탕': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300&h=200&fit=crop',
  '육개장': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300&h=200&fit=crop',
  '해장국': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300&h=200&fit=crop',
  '뚝배기': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300&h=200&fit=crop',
  '구이': 'https://images.unsplash.com/photo-bYcbvS8dzQM?w=300&h=200&fit=crop',
  '삼겹': 'https://images.unsplash.com/photo-bYcbvS8dzQM?w=300&h=200&fit=crop',
  '목살': 'https://images.unsplash.com/photo-bYcbvS8dzQM?w=300&h=200&fit=crop',
  '오겹살': 'https://images.unsplash.com/photo-bYcbvS8dzQM?w=300&h=200&fit=crop',
  '갈비': 'https://images.unsplash.com/photo-bYcbvS8dzQM?w=300&h=200&fit=crop',
  '흑돼지': 'https://images.unsplash.com/photo-bYcbvS8dzQM?w=300&h=200&fit=crop',
  '돼지': 'https://images.unsplash.com/photo-bYcbvS8dzQM?w=300&h=200&fit=crop',
  '조림': 'https://images.unsplash.com/photo-1580651315530-69c8e0026377?w=300&h=200&fit=crop',
  '김치': 'https://images.unsplash.com/photo-1_SenAyTAXg?w=300&h=200&fit=crop',
  '정식': 'https://images.unsplash.com/photo-MGnvEGBdyVE?w=300&h=200&fit=crop',
  '밥': 'https://images.unsplash.com/photo-MGnvEGBdyVE?w=300&h=200&fit=crop',
  '솥밥': 'https://images.unsplash.com/photo-MGnvEGBdyVE?w=300&h=200&fit=crop',
  '뷔페': 'https://images.unsplash.com/photo-kCkv2HTm3Y8?w=300&h=200&fit=crop',
  '런치': 'https://images.unsplash.com/photo-MGnvEGBdyVE?w=300&h=200&fit=crop',
  '국수': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=300&h=200&fit=crop',
  '면': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=300&h=200&fit=crop',
  '비빔': 'https://images.unsplash.com/photo-MGnvEGBdyVE?w=300&h=200&fit=crop',
  '버거': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=200&fit=crop',
  '감자튀김': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300&h=200&fit=crop',
  '튀김': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300&h=200&fit=crop',
  '어니언링': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300&h=200&fit=crop',
  '음료': 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300&h=200&fit=crop',
  '맥주': 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=300&h=200&fit=crop',
  '밀크쉐이크': 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300&h=200&fit=crop',
  '쉐이크': 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300&h=200&fit=crop',
  '탄산': 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300&h=200&fit=crop',
  '쥬스': 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300&h=200&fit=crop',
  '주스': 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300&h=200&fit=crop',
  'default': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&h=200&fit=crop',
};

function getDefaultImageForMenu(menuName: string): string {
  const priorityKeywords = [
    '갈치', '고등어', '성게', '전복', '해물', '새우', '멜',
    '흑돼지', '삼겹', '목살', '오겹살', '갈비', '돼지',
    '버거', '감자튀김', '튀김', '어니언링',
    '밀크쉐이크', '쉐이크',
    '국수', '면', '비빔',
    '육개장', '해장국',
  ];
  
  for (const keyword of priorityKeywords) {
    if (menuName.includes(keyword)) {
      return DEFAULT_FOOD_IMAGES[keyword];
    }
  }
  
  for (const [keyword, imageUrl] of Object.entries(DEFAULT_FOOD_IMAGES)) {
    if (menuName.includes(keyword)) {
      return imageUrl;
    }
  }
  return DEFAULT_FOOD_IMAGES['default'];
}

interface DiningCodeListItem {
  name: string;
  url: string;
  image: string;
  position: number;
}

export class DiningCodeScraperService {
  private static instance: DiningCodeScraperService;
  private baseUrl = 'https://www.diningcode.com';

  static getInstance(): DiningCodeScraperService {
    if (!DiningCodeScraperService.instance) {
      DiningCodeScraperService.instance = new DiningCodeScraperService();
    }
    return DiningCodeScraperService.instance;
  }

  async scrapeRestaurants(area: string, maxResults: number = 20): Promise<ScrapedRestaurant[]> {
    try {
      const encodedQuery = encodeURIComponent(area);
      const listUrl = `${this.baseUrl}/list.dc?query=${encodedQuery}`;

      const listResponse = await axios.get(listUrl, {
        headers: this.getHeaders(),
        timeout: 15000,
      });

      const restaurants = this.parseListPage(listResponse.data);

      if (restaurants.length === 0) {
        return [];
      }

      const limitedRestaurants = restaurants.slice(0, maxResults);
      const results: ScrapedRestaurant[] = [];

      for (const item of limitedRestaurants) {
        try {
          const detail = await this.scrapeRestaurantDetail(item.url);
          if (detail) {
            results.push(detail);
          }
          await this.delay(300);
        } catch (error) {
          console.error(`Failed to scrape ${item.name}:`, error);
        }
      }

      return results;
    } catch (error: any) {
      console.error('DiningCode scraping error:', error.message);
      throw new Error(`다이닝코드 수집 실패: ${error.message}`);
    }
  }

  private parseListPage(html: string): DiningCodeListItem[] {
    const $ = cheerio.load(html);
    const restaurants: DiningCodeListItem[] = [];

    const scriptTags = $('script[type="application/ld+json"]');
    scriptTags.each((_, element) => {
      try {
        const jsonContent = $(element).html();
        if (!jsonContent) return;

        const data = JSON.parse(jsonContent);
        if (data['@type'] === 'ItemList' && data.itemListElement) {
          for (const item of data.itemListElement) {
            restaurants.push({
              name: item.name,
              url: item.url,
              image: item.image,
              position: item.position,
            });
          }
        }
      } catch (e) {
      }
    });

    return restaurants;
  }

  private async scrapeRestaurantDetail(url: string): Promise<ScrapedRestaurant | null> {
    try {
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        timeout: 10000,
      });

      const html = response.data;
      const $ = cheerio.load(html);
      const ridMatch = url.match(/rid=([^&]+)/);
      const rid = ridMatch ? ridMatch[1] : `dc_${Date.now()}`;

      let name = '';
      let address = '';
      let phone: string | null = null;
      let latitude = 0;
      let longitude = 0;
      let category: string | null = null;
      const menu: ScrapedMenuItem[] = [];

      const latMatch = html.match(/id="hdn_lat"\s+type="hidden"\s+value="([^"]+)"/);
      const lngMatch = html.match(/id="hdn_lng"\s+type="hidden"\s+value="([^"]+)"/);
      if (latMatch) latitude = parseFloat(latMatch[1]) || 0;
      if (lngMatch) longitude = parseFloat(lngMatch[1]) || 0;

      const categoryLinks = $('a[class*="btxt category"]').map((_, el) => $(el).text().trim()).get();
      if (categoryLinks.length > 0) {
        category = categoryLinks.join(', ');
      }

      const scriptTags = $('script[type="application/ld+json"]');
      scriptTags.each((_, element) => {
        try {
          const jsonContent = $(element).html();
          if (!jsonContent) return;
          const data = JSON.parse(jsonContent);

          if (data.name) name = data.name;
          if (data.telephone) phone = data.telephone;

          if (data.address) {
            if (typeof data.address === 'string') {
              address = data.address;
            } else if (data.address.streetAddress) {
              address = data.address.streetAddress;
            }
          }

          if (data.hasMenu?.hasMenuItem) {
            const menuImages = this.extractMenuImages(html);
            let menuIndex = 0;

            for (const item of data.hasMenu.hasMenuItem) {
              if (item.name) {
                let price: number | null = null;
                if (item.offers?.price) {
                  const priceStr = String(item.offers.price).replace(/[^\d]/g, '');
                  if (priceStr) {
                    price = parseInt(priceStr);
                  }
                }

                if (price && price > 0) {
                  const cleanName = item.name.replace(/_[A-Za-z]+$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
                  if (cleanName.length >= 2) {
                    const imageUrl = getDefaultImageForMenu(cleanName);
                    menu.push({ name: cleanName, price, imageUrl });
                    menuIndex++;
                  }
                }
              }
            }
          }
        } catch (e) {
        }
      });

      if (!name) {
        name = $('h1').first().text().trim() || $('title').text().split('-')[0].trim();
      }

      if (!name) return null;

      return {
        id: `dc_${rid}`,
        name,
        address,
        roadAddress: null,
        latitude,
        longitude,
        category,
        phone,
        menu,
        hasDelivery: menu.length > 0,
      };
    } catch (error: any) {
      console.error('Detail scrape error:', error.message);
      return null;
    }
  }

  private extractMenuImages(html: string): string[] {
    const images: string[] = [];
    const pattern = /https:\/\/d12zq4w4guyljn\.cloudfront\.net\/[^"'\s]*_menu[^"'\s]*\.webp/g;
    const matches = html.match(pattern);
    if (matches) {
      const uniqueImages = [...new Set(matches)];
      images.push(...uniqueImages);
    }
    return images;
  }

  private getHeaders() {
    return {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const diningCodeScraperService = DiningCodeScraperService.getInstance();
