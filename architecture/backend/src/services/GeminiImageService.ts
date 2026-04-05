import axios from 'axios';
import logger from '../utils/logger';

// ============================================
// Multi-Provider AI Image Generation Service
// Provider 우선순위:
//   1. Pollinations.ai (무료, API 키 불필요)
//   2. Gemini (free tier, 쿼터 제한)
//   3. Together AI FLUX.1 Schnell (무료 크레딧)
// ============================================

// API 설정
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;

// 사용할 프로바이더 순서 (환경변수로 오버라이드 가능)
const PROVIDER_ORDER = (process.env.IMAGE_PROVIDER_ORDER || 'pollinations,gemini,together')
  .split(',')
  .map((s) => s.trim());

// 한식 카테고리별 스타일 매핑
const CATEGORY_STYLE_MAP: Record<string, string> = {
  한식: `Professional Korean cuisine photography. Plating: traditional Korean stone bowl or ceramic plate,
    garnished with sesame seeds and fresh herbs. Composition: centered dish with negative space,
    showing rich textures. Lighting: warm, diffused studio lighting highlighting colors and steam.`,
  중식: `Professional Chinese cuisine photography. Plating: elegant presentation on white or dark plate,
    oily sheen visible, vibrant colors. Composition: dynamic arrangement showing sauce coating and ingredients.
    Lighting: warm golden lighting emphasizing depth and shadows.`,
  '양식/피자': `Professional Western/pizza cuisine photography. Plating: rustic wooden board or white plate,
    generous portion display. Composition: appetizing angle showing cheese melt and toppings detail.
    Lighting: bright, crisp natural-style lighting with slight shadows.`,
  치킨: `Professional fried chicken photography. Plating: kraft paper or ceramic plate, golden-brown finish visible.
    Composition: layered arrangement showing crispy exterior, sauce drizzle. Lighting: bright studio lighting
    enhancing golden crispy texture.`,
  분식: `Professional Korean street food photography. Plating: casual bowl or tray, generous portion,
    colorful toppings visible. Composition: appetizing overhead or 45-degree angle.
    Lighting: warm, bright lighting showing sauce and texture.`,
  '고기/구이': `Professional grilled meat photography. Plating: black slate plate or Korean BBQ grill presentation,
    charred marks visible. Composition: close-up showing juicy interior and sear marks.
    Lighting: warm studio lighting with dramatic shadows.`,
  횟집: `Professional sushi/seafood photography. Plating: minimalist black or white plate,
    artistic arrangement. Composition: elegant spacing between items, ice/water droplets visible.
    Lighting: cool-toned professional studio lighting with clarity.`,
  카페: `Professional café photography. Plating: white cup/glass, latte art or vibrant drink color,
    pastry alongside. Composition: lifestyle angle with ambient elements (coffee beans, napkin).
    Lighting: soft natural window lighting, warm and inviting.`,
};

// 한식 메뉴 키워드별 프롬프트 매핑
const MENU_KEYWORD_PROMPTS: Array<[RegExp, string]> = [
  // 찌개/국 류
  [/김치찌개/i, '매운 한국식 김치찌개, 끓는 국물, 돼지고기, 두부, 김'],
  [/된장찌개/i, '따뜻한 된장찌개, 두부, 홍고추, 파, 된장 맛이 진함'],
  [/부대찌개/i, '한국식 부대찌개, 소시지, 스팸, 콩나물, 매운 국물'],
  [/거북선찌개|해물찌개/i, '해물 듬뿍 들어간 거북선찌개, 새우, 홍합, 오징어'],
  [/육개장/i, '맵고 맛있는 육개장, 쇠고기 채, 고추 향, 콩나물'],
  [/순두부찌개/i, '부드러운 순두부찌개, 계란, 해산물, 깊은 맛'],
  [/청국장/i, '진한 청국장, 콩 풍미, 고기, 파, 된장 향'],

  // 밥 류
  [/비빔밥/i, '한국식 비빔밥, 쌀밥, 다양한 채소, 고추장, 계란, 참기름'],
  [/돌솥비빔밥/i, '뜨거운 돌솥비빔밥, 갓지은 밥, 채소, 고추장, 계란'],
  [/김밥/i, '싱싱한 김밥, 여러 줄, 단면 보이기, 참깨 뿌려짐'],
  [/주먹밥/i, '삼각 주먹밥, 여러 개, 다양한 속'],
  [/오므라이스/i, '계란으로 감싼 오므라이스, 토마토소스, 황금색 계란'],
  [/볶음밥/i, '촉촉한 한식 볶음밥, 계란, 야채, 소시지'],

  // 면 류
  [
    /비빔국수/i,
    'Korean spicy cold noodles (bibim-guksu) with thin wheat noodles tossed in gochujang sauce, topped with julienned cucumber, sliced boiled egg, and sesame seeds',
  ],
  [/라면/i, '끓는 한국식 라면, 계란, 파, 어묵, 육수'],
  [/우동/i, '쫄깃한 우동, 국물 또는 비빔, 계란, 파'],
  [/국수/i, '시원한 국수, 육수, 계란, 오이, 고추장'],
  [/짜장면/i, '검은색 짜장면, 춘양, 계란, 소시지, 단호박'],
  [/짬뽕/i, '빨간 짬뽕, 매콤한 국물, 해산물, 야채'],
  [/마라탕/i, '마라향 진한 탕, 다양한 재료, 빨간 국물'],

  // 분식 류
  [/떡볶이/i, '매콤한 떡볶이, 빨간 고추장 양념, 떡, 어묵, 계란'],
  [/순대/i, '돼지 순대, 소금에 찍어 먹기, 쌀, 돼지고기'],
  [/오뎅|어묵/i, '가래떡 오뎅, 국물, 파, 고추, 따뜻한 국물'],
  [/핫도그|튀김/i, '바삭한 튀김, 황금색, 양념 또는 소금'],
  [/계란말이/i, '계란말이, 노릇한 색, 자른 단면, 초장'],
  [/만두/i, '찐 만두, 흰 겉, 잘린 단면, 초장'],

  // 고기 류
  [/불고기/i, '양념 불고기, 마리네이드, 양파, 당근, 육즙'],
  [/삼겹살|돼지고기/i, '구운 삼겹살, 구이판, 어두운 외부, 육즙, 상추 쌈'],
  [
    /항정살/i,
    'Korean grilled pork jowl (hangjeongsal) - thick slices of marbled pork neck meat on a charcoal grill with grill marks, golden-brown crispy edges',
  ],
  [/갈비/i, '소 갈비, 양념, 구워진 자국, 육즙 흘러내림'],
  [
    /흑돼지/i,
    'Jeju black pork (heukdwaeji) - premium dark-colored pork cuts with beautiful marbling on a traditional Korean BBQ grill',
  ],

  // 해산물 류
  [/회|사시미/i, '싱싱한 회, 다양한 생선, 얼음, 와사비, 간장'],
  [/연어/i, '연어 회, 분홍색, 얇게 썬 것, 와사비, 초장'],
  [/새우튀김/i, '바삭한 새우튀김, 황금색, 통통한 새우, 가루 묻음'],

  // 양식
  [/스테이크/i, '프리미엄 스테이크, 검은색 겉, 분홍색 내부, 육즙'],
  [/파스타/i, '크림 파스타, 파르메산 가루, 파슬리, 윤기나는 소스'],
  [/피자/i, '피자, 치즈 멜트, 토핑, 갓 구운, 바삭한 가장자리'],
  [/버거/i, '햄버거, 다층 구조, 치즈, 패티, 신선한 채소'],

  // 카페
  [
    /아메리카노/i,
    'A hot cup of Americano coffee, dark brown color, white ceramic cup, steam rising',
  ],
  [/카페라떼|라떼/i, 'A creamy cafe latte with beautiful latte art in a white ceramic cup'],
  [/카푸치노/i, 'A cappuccino with thick foam and cocoa powder dusting on top'],

  // 기본 스타일 (명시되지 않은 항목)
  [/.*/, '한국식 음식, 맛있는 프레젠테이션, 따뜻한 조명, 프로페셔널한 사진'],
];

/**
 * 메뉴명과 카테고리를 기반으로 AI 이미지 생성 프롬프트 구성
 */
export function buildFoodImagePrompt(menuName: string, category?: string | null): string {
  try {
    let dishDescription = '';
    for (const [regex, description] of MENU_KEYWORD_PROMPTS) {
      if (regex.test(menuName)) {
        dishDescription = description;
        break;
      }
    }

    const categoryStyle =
      category && CATEGORY_STYLE_MAP[category]
        ? CATEGORY_STYLE_MAP[category]
        : CATEGORY_STYLE_MAP['한식'];

    const prompt = `
Create a professional food photograph of Korean cuisine with these specifications:

Dish: ${menuName}
${dishDescription ? `Appearance: ${dishDescription}` : ''}

Photography Style:
${categoryStyle}

Quality Requirements:
- 8K resolution, ultra-sharp detail
- Food appears fresh, appetizing, and professionally presented
- Rich colors and accurate color reproduction
- No watermarks, logos, or text
- Professional restaurant-quality presentation

Format: PNG image, square aspect ratio (1:1)
    `.trim();

    logger.debug(`Built prompt for menu "${menuName}" in category "${category || 'default'}"`, {
      prompt,
    });
    return prompt;
  } catch (error) {
    logger.error('Error building food image prompt', { menuName, category, error });
    throw error;
  }
}

/**
 * 간결한 영문 프롬프트 생성 (Pollinations/Together 용)
 * - 짧고 영문 기반으로 더 좋은 결과
 */
function buildShortEnglishPrompt(menuName: string, category?: string | null): string {
  let dishDesc = '';
  for (const [regex, description] of MENU_KEYWORD_PROMPTS) {
    if (regex.test(menuName)) {
      dishDesc = description;
      break;
    }
  }

  // 영문 키워드가 이미 포함되어 있으면 그대로, 아니면 메뉴명 추가
  const hasEnglish = /[a-zA-Z]/.test(dishDesc);
  const dishPart = hasEnglish ? dishDesc : `Korean dish called "${menuName}", ${dishDesc}`;

  return `Professional food photography of ${dishPart}. Shot from 45-degree angle, shallow depth of field, warm lighting, appetizing presentation, high resolution, no text or watermarks, restaurant-quality plating.`;
}

// ============================================
// Provider 1: Pollinations.ai (무료, API 키 불필요)
// ============================================
async function callPollinationsAPI(prompt: string): Promise<Buffer> {
  try {
    logger.info('[Pollinations] Generating image...');

    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&model=flux&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 120000, // 2분 (이미지 생성 시간 고려)
      maxRedirects: 5,
      headers: {
        Accept: 'image/*',
      },
    });

    if (!response.data || response.data.length < 1000) {
      throw new Error(`Invalid image response: ${response.data?.length || 0} bytes`);
    }

    logger.info(
      `[Pollinations] Image generated successfully (${(response.data.length / 1024).toFixed(1)}KB)`,
    );
    return Buffer.from(response.data);
  } catch (error: any) {
    logger.error('[Pollinations] Failed', { error: error.message });
    throw error;
  }
}

// ============================================
// Provider 2: Gemini (generateContent with IMAGE modality)
// ============================================
async function callGeminiAPI(prompt: string): Promise<Buffer> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    logger.info('[Gemini] Generating image...');

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `Generate a photorealistic food image: ${prompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000,
      },
    );

    const parts = response.data?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const buffer = Buffer.from(part.inlineData.data, 'base64');
        logger.info(
          `[Gemini] Image generated successfully (${(buffer.length / 1024).toFixed(1)}KB)`,
        );
        return buffer;
      }
    }

    throw new Error('No image data in Gemini response');
  } catch (error: any) {
    const status = error.response?.status;
    if (status === 429) {
      logger.warn('[Gemini] Rate limit exceeded (429)');
    } else {
      logger.error('[Gemini] Failed', { status, error: error.message });
    }
    throw error;
  }
}

// ============================================
// Provider 3: Together AI FLUX.1 Schnell
// ============================================
async function callTogetherAPI(prompt: string): Promise<Buffer> {
  try {
    if (!TOGETHER_API_KEY) {
      throw new Error('TOGETHER_API_KEY is not configured');
    }

    logger.info('[Together] Generating image with FLUX.1 Schnell...');

    const response = await axios.post(
      'https://api.together.xyz/v1/images/generations',
      {
        model: 'black-forest-labs/FLUX.1-schnell-Free',
        prompt: prompt,
        width: 512,
        height: 512,
        steps: 4,
        n: 1,
        response_format: 'b64_json',
      },
      {
        headers: {
          Authorization: `Bearer ${TOGETHER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      },
    );

    const b64 = response.data?.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error('No image data in Together AI response');
    }

    const buffer = Buffer.from(b64, 'base64');
    logger.info(`[Together] Image generated successfully (${(buffer.length / 1024).toFixed(1)}KB)`);
    return buffer;
  } catch (error: any) {
    const status = error.response?.status;
    logger.error('[Together] Failed', { status, error: error.message });
    throw error;
  }
}

// ============================================
// Provider 매핑
// ============================================
const PROVIDERS: Record<
  string,
  {
    name: string;
    call: (prompt: string) => Promise<Buffer>;
    useShortPrompt: boolean;
  }
> = {
  pollinations: { name: 'Pollinations.ai', call: callPollinationsAPI, useShortPrompt: true },
  gemini: { name: 'Gemini', call: callGeminiAPI, useShortPrompt: false },
  together: { name: 'Together AI', call: callTogetherAPI, useShortPrompt: true },
};

/**
 * 음식 이미지 생성 (다중 프로바이더 폴백 체인)
 */
export async function generateFoodImage(
  menuName: string,
  category?: string | null,
): Promise<Buffer> {
  logger.info(
    `[AIImage] Generating food image for: ${menuName} (category: ${category || 'default'})`,
  );

  const fullPrompt = buildFoodImagePrompt(menuName, category);
  const shortPrompt = buildShortEnglishPrompt(menuName, category);

  const errors: string[] = [];

  for (const providerKey of PROVIDER_ORDER) {
    const provider = PROVIDERS[providerKey];
    if (!provider) {
      logger.warn(`[AIImage] Unknown provider: ${providerKey}, skipping`);
      continue;
    }

    try {
      const prompt = provider.useShortPrompt ? shortPrompt : fullPrompt;
      const buffer = await provider.call(prompt);

      if (buffer && buffer.length > 1000) {
        logger.info(
          `[AIImage] Success with provider: ${provider.name} (${(buffer.length / 1024).toFixed(1)}KB)`,
        );
        return buffer;
      }
    } catch (error: any) {
      const msg = `${provider.name}: ${error.message}`;
      errors.push(msg);
      logger.warn(`[AIImage] Provider ${provider.name} failed, trying next...`, {
        error: error.message,
      });
    }
  }

  // 모든 프로바이더 실패
  const errorSummary = errors.join(' | ');
  logger.error(`[AIImage] All providers failed for "${menuName}"`, { errors: errorSummary });
  throw new Error(`All image providers failed: ${errorSummary}`);
}
