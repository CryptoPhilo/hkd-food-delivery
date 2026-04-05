'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  isActive: boolean;
  requiresAgeVerification: boolean;
  ageRestriction: 'none' | 'teen' | 'adult';
  category?: string;
  barcode?: string;
  stock?: number;
}

interface Store {
  id: string;
  name: string;
  address: string;
  roadAddress?: string;
  phone?: string;
  category?: string;
  businessStatus?: string;
  businessHours?: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  isDeliverable: boolean;
  latitude: number;
  longitude: number;
  storeType: string;
  brandName?: string;
  operatingHours24?: boolean;
  menus: Product[];
}

interface CartItem {
  menuId: string;
  name: string;
  price: number;
  quantity: number;
  restaurantId: string;
  restaurantName: string;
  requiresAgeVerification?: boolean;
  ageRestriction?: string;
}

interface CartData {
  [restaurantId: string]: {
    restaurantName: string;
    items: CartItem[];
  };
}

const PRODUCT_CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: '음료', label: '음료' },
  { key: '과자', label: '과자/스낵' },
  { key: '도시락', label: '도시락/간편식' },
  { key: '유제품', label: '유제품' },
  { key: '라면', label: '라면/면류' },
  { key: '빵', label: '빵/베이커리' },
  { key: '아이스크림', label: '아이스크림' },
  { key: '생활용품', label: '생활용품' },
  { key: '주류', label: '주류' },
];

export default function StorePage() {
  const params = useParams();
  const storeId = params?.id as string;
  const router = useRouter();
  const t = useTranslations();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartData, setCartData] = useState<CartData>({});
  const [showClosedModal, setShowClosedModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [pendingAgeProduct, setPendingAgeProduct] = useState<Product | null>(null);
  const [ageVerified, setAgeVerified] = useState(false);

  useEffect(() => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    fetchStore();
    loadCart();
    checkAgeVerification();
  }, [storeId]);

  const fetchStore = async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`/api/v1/restaurants/${storeId}`);
      const data = await response.json();
      if (data.success) {
        setStore(data.data);
        checkBusinessHours(data.data);
      } else {
        console.error('Failed to fetch store:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch store:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAgeVerification = () => {
    const verified = localStorage.getItem('ageVerified');
    if (verified) {
      const data = JSON.parse(verified);
      // 인증 유효기간 24시간
      if (data.verifiedAt && Date.now() - data.verifiedAt < 24 * 60 * 60 * 1000) {
        setAgeVerified(true);
      }
    }
  };

  const loadCart = () => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      setCartData(JSON.parse(savedCart));
    }
  };

  const saveCart = (newCart: CartData) => {
    localStorage.setItem('cart', JSON.stringify(newCart));
    setCartData(newCart);
  };

  const getCurrentCartItems = (): CartItem[] => {
    if (!storeId) return [];
    return cartData[storeId]?.items || [];
  };

  const checkBusinessHours = (s: Store): boolean => {
    if (!s.isActive || s.businessStatus === 'closed') {
      setShowClosedModal(true);
      return false;
    }
    if (s.operatingHours24) return true;

    if (s.businessHours) {
      const hours = s.businessHours.split('-');
      if (hours.length === 2) {
        const now = new Date();
        const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const currentTime = kstNow.getHours() * 60 + kstNow.getMinutes();
        const [openHour, openMin] = hours[0].split(':').map(Number);
        const [closeHour, closeMin] = hours[1].split(':').map(Number);
        const openTime = openHour * 60 + openMin;
        const closeTime = closeHour * 60 + closeMin;

        if (closeTime < openTime) {
          if (currentTime >= openTime || currentTime < closeTime) return true;
        } else {
          if (currentTime >= openTime && currentTime < closeTime) return true;
        }
        setShowClosedModal(true);
        return false;
      }
    }
    return true;
  };

  const handleAddToCart = (product: Product) => {
    // 성인 인증 필요 상품 체크
    if (product.requiresAgeVerification && product.ageRestriction === 'adult' && !ageVerified) {
      setPendingAgeProduct(product);
      setShowAgeModal(true);
      return;
    }

    addToCart(product);
  };

  const confirmAge = () => {
    localStorage.setItem('ageVerified', JSON.stringify({ verifiedAt: Date.now() }));
    setAgeVerified(true);
    setShowAgeModal(false);
    if (pendingAgeProduct) {
      addToCart(pendingAgeProduct);
      setPendingAgeProduct(null);
    }
  };

  const addToCart = (product: Product) => {
    // 재고 체크
    if (product.stock !== null && product.stock !== undefined && product.stock <= 0) {
      alert(t('store.outOfStock'));
      return;
    }

    const newCart = { ...cartData };
    if (!newCart[storeId]) {
      newCart[storeId] = { restaurantName: store?.name || '', items: [] };
    }

    const existing = newCart[storeId].items.find((item) => item.menuId === product.id);
    if (existing) {
      // 재고 수량 체크
      if (product.stock !== null && product.stock !== undefined && existing.quantity >= product.stock) {
        alert(t('store.stockLimit', { n: product.stock }));
        return;
      }
      existing.quantity += 1;
    } else {
      newCart[storeId].items.push({
        menuId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        restaurantId: storeId,
        restaurantName: store?.name || '',
        requiresAgeVerification: product.requiresAgeVerification,
        ageRestriction: product.ageRestriction,
      });
    }
    saveCart(newCart);
  };

  const removeFromCart = (menuId: string) => {
    const newCart = { ...cartData };
    if (newCart[storeId]) {
      const existing = newCart[storeId].items.find((item) => item.menuId === menuId);
      if (existing) {
        if (existing.quantity > 1) {
          existing.quantity -= 1;
        } else {
          newCart[storeId].items = newCart[storeId].items.filter((item) => item.menuId !== menuId);
          if (newCart[storeId].items.length === 0) {
            delete newCart[storeId];
          }
        }
      }
    }
    saveCart(newCart);
  };

  const getCartTotal = () => {
    let total = 0;
    for (const rid in cartData) {
      for (const item of cartData[rid].items) {
        total += item.price * item.quantity;
      }
    }
    return total;
  };

  const getCartCount = () => {
    let count = 0;
    for (const rid in cartData) {
      for (const item of cartData[rid].items) {
        count += item.quantity;
      }
    }
    return count;
  };

  const getAgeRestrictionBadge = (product: Product) => {
    if (!product.requiresAgeVerification) return null;
    if (product.ageRestriction === 'adult') {
      return (
        <span className="airbnb-badge bg-red-50 text-airbnb-red">
          19+
        </span>
      );
    }
    if (product.ageRestriction === 'teen') {
      return (
        <span className="airbnb-badge bg-yellow-50 text-airbnb-yellow-text">
          {t('store.teenRestricted')}
        </span>
      );
    }
    return null;
  };

  const getStockBadge = (product: Product) => {
    if (product.stock === null || product.stock === undefined) return null;
    if (product.stock <= 0) {
      return (
        <span className="airbnb-badge bg-gray-200 text-airbnb-gray">
          {t('store.outOfStockShort')}
        </span>
      );
    }
    if (product.stock <= 5) {
      return (
        <span className="airbnb-badge bg-airbnb-yellow-bg text-airbnb-yellow-text">
          {t('store.stockRemaining', { n: product.stock })}
        </span>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-airbnb-red"></div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-airbnb-gray mb-4">{t('restaurant.notFound')}</p>
          <Link href="/" className="text-airbnb-red hover:underline">
            {t('common.backToMain')}
          </Link>
        </div>
      </div>
    );
  }

  const availableProducts = store.menus.filter((m) => m.isAvailable && m.isActive);

  // 카테고리 필터링
  const filteredProducts =
    selectedCategory === 'all'
      ? availableProducts
      : availableProducts.filter((p) => p.category?.includes(selectedCategory));

  // 실제 카테고리 목록 (데이터에 존재하는 것만)
  const existingCategories = Array.from(new Set(availableProducts.map((p) => p.category).filter(Boolean)));

  const translatedCategories = [
    { key: 'all', label: t('store.categories.all') },
    { key: '음료', label: t('store.categories.drinks') },
    { key: '과자', label: t('store.categories.snacks') },
    { key: '도시락', label: t('store.categories.meals') },
    { key: '유제품', label: t('store.categories.dairy') },
    { key: '라면', label: t('store.categories.noodles') },
    { key: '빵', label: t('store.categories.bakery') },
    { key: '아이스크림', label: t('store.categories.iceCream') },
    { key: '생활용품', label: t('store.categories.daily') },
    { key: '주류', label: t('store.categories.alcohol') },
  ];

  const visibleCategories = translatedCategories.filter(
    (c) => c.key === 'all' || existingCategories.some((ec) => ec?.includes(c.key))
  );

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <header className="bg-white border-b border-airbnb-divider sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={() => router.back()} className="airbnb-circle-btn w-9 h-9">
              <svg className="w-6 h-6 text-airbnb-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-airbnb-black tracking-airbnb-snug flex-1 text-center pr-8">{store.name}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4">
        {/* Store Info */}
        <div className="airbnb-card rounded-airbnb-lg p-4 mb-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              {store.brandName && (
                <span className="airbnb-badge bg-airbnb-green-bg text-airbnb-green mb-1">
                  {store.brandName}
                </span>
              )}
              <p className="text-sm text-airbnb-gray mt-1">
                {store.operatingHours24 ? t('common.open24h') : (store.businessHours ? t('common.businessHours', { hours: store.businessHours }) : t('common.businessHoursNotSet'))}
              </p>
              {store.phone && <p className="text-sm text-airbnb-gray">{t('common.phone')}: {store.phone}</p>}
              <p className="text-sm text-airbnb-gray">{store.address}</p>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        {visibleCategories.length > 1 && (
          <div className="mb-4 overflow-x-auto">
            <div className="flex space-x-2 pb-1">
              {visibleCategories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`whitespace-nowrap px-3 py-1.5 text-sm rounded-airbnb-xl transition-colors ${
                    selectedCategory === cat.key
                      ? 'airbnb-pill-active'
                      : 'airbnb-pill-inactive'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Product List */}
        <h2 className="text-lg font-bold text-airbnb-black tracking-airbnb-snug mb-3">
          {t('store.products')} {filteredProducts.length > 0 && `(${filteredProducts.length})`}
        </h2>
        <div className="space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="airbnb-card rounded-airbnb-lg p-8 text-center text-airbnb-gray">
              {selectedCategory === 'all' ? t('store.noProducts') : t('store.noCategoryProducts')}
            </div>
          ) : (
            filteredProducts.map((product) => {
              const cartItem = getCurrentCartItems().find((c) => c.menuId === product.id);
              const isOutOfStock = product.stock !== null && product.stock !== undefined && product.stock <= 0;

              return (
                <div
                  key={product.id}
                  className={`airbnb-card rounded-airbnb-lg p-4 ${isOutOfStock ? 'opacity-60' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    {product.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-20 h-20 object-cover rounded-airbnb-md mr-3 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-semibold text-airbnb-black">{product.name}</h3>
                        {getAgeRestrictionBadge(product)}
                        {getStockBadge(product)}
                      </div>
                      {product.description && (
                        <p className="text-sm text-airbnb-gray mt-1">{product.description}</p>
                      )}
                      {product.category && (
                        <p className="text-xs text-airbnb-gray mt-0.5">{product.category}</p>
                      )}
                      <p className="text-sm font-bold text-airbnb-black tracking-airbnb-snug mt-2">
                        ₩{product.price.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-2">
                      {isOutOfStock ? (
                        <span className="text-sm text-airbnb-gray">{t('store.outOfStockShort')}</span>
                      ) : cartItem ? (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => removeFromCart(product.id)}
                            className="w-8 h-8 rounded-full bg-airbnb-surface text-airbnb-black flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="text-sm font-medium w-4 text-center text-airbnb-black">
                            {cartItem.quantity}
                          </span>
                          <button
                            onClick={() => handleAddToCart(product)}
                            className="w-8 h-8 rounded-full bg-airbnb-black text-white flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddToCart(product)}
                          className="airbnb-btn-primary px-3 py-1.5 text-sm rounded-airbnb-sm"
                        >
                          {t('restaurant.addToCart')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Cart Bottom Bar */}
      {getCartCount() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-airbnb-divider shadow-airbnb-card">
          <div className="max-w-md mx-auto px-4 py-3">
            <Link
              href={`/checkout?restaurant=${storeId}`}
              className="flex items-center justify-between bg-airbnb-red text-white py-3 px-4 rounded-airbnb-sm"
            >
              <div className="flex items-center">
                <span className="bg-white text-airbnb-red text-xs font-bold px-2 py-1 rounded-full mr-2">
                  {getCartCount()}
                </span>
                <span className="font-semibold">{t('common.viewCart')}</span>
              </div>
              <span className="font-bold">₩{getCartTotal().toLocaleString()}</span>
            </Link>
          </div>
        </div>
      )}

      {/* Closed Modal */}
      {showClosedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => router.push('/')}></div>
          <div className="relative bg-white rounded-airbnb-lg shadow-airbnb-card max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-airbnb-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-airbnb-black tracking-airbnb-snug mb-2">{t('common.notDeliveryTime')}</h2>
            <p className="text-airbnb-gray mb-4">
              {t('restaurant.notAccepting', { name: store.name })}
              <br />
              {store.operatingHours24 ? t('common.open24h') : (store.businessHours ? t('common.businessHours', { hours: store.businessHours }) : t('common.businessHoursNotSet'))}
            </p>
            <button
              onClick={() => router.push('/')}
              className="airbnb-btn-primary w-full py-3 rounded-airbnb-sm font-bold"
            >
              {t('common.backToMain')}
            </button>
          </div>
        </div>
      )}

      {/* Age Verification Modal */}
      {showAgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowAgeModal(false)}></div>
          <div className="relative bg-white rounded-airbnb-lg shadow-airbnb-card max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-airbnb-red">19+</span>
            </div>
            <h2 className="text-xl font-bold text-airbnb-black tracking-airbnb-snug mb-2">{t('store.ageVerificationRequired')}</h2>
            <p className="text-airbnb-gray mb-1">
              {t('store.ageVerificationDesc')}
            </p>
            <p className="text-sm text-airbnb-gray mb-4">
              {pendingAgeProduct?.name}
            </p>
            <p className="text-sm text-airbnb-gray mb-4">
              {t('store.ageVerificationQuestion')}
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowAgeModal(false);
                  setPendingAgeProduct(null);
                }}
                className="flex-1 py-3 border border-airbnb-border rounded-airbnb-sm font-bold text-airbnb-black hover:bg-airbnb-surface"
              >
                {t('store.ageNo')}
              </button>
              <button
                onClick={confirmAge}
                className="airbnb-btn-brand flex-1 py-3 rounded-airbnb-sm font-bold"
              >
                {t('store.ageYes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
