-- ============================================
-- 한경 음식배달 서비스 - Database Initialization
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Users Table
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    fcm_token TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone);

-- ============================================
-- Restaurants Table
-- ============================================
CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    naver_place_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    road_address TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    phone VARCHAR(20),
    category VARCHAR(100),
    business_status VARCHAR(20),
    image_url TEXT,
    rating DOUBLE PRECISION,
    is_active BOOLEAN DEFAULT true,
    is_deliverable BOOLEAN DEFAULT true,
    delivery_radius DOUBLE PRECISION DEFAULT 3.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_restaurants_naver_id ON restaurants(naver_place_id);
CREATE INDEX idx_restaurants_active_deliverable ON restaurants(is_active, is_deliverable);
CREATE INDEX idx_restaurants_location ON restaurants(latitude, longitude);

-- ============================================
-- Menus Table
-- ============================================
CREATE TABLE menus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    naver_menu_id VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_menus_restaurant_available ON menus(restaurant_id, is_available);

-- ============================================
-- Orders Table
-- ============================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    status VARCHAR(20) DEFAULT 'pending',
    subtotal INTEGER NOT NULL,
    delivery_fee INTEGER NOT NULL,
    total_amount INTEGER NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_latitude DOUBLE PRECISION NOT NULL,
    delivery_longitude DOUBLE PRECISION NOT NULL,
    estimated_pickup_time TIMESTAMP WITH TIME ZONE,
    estimated_delivery_time INTEGER,
    payment_method VARCHAR(20),
    payment_id VARCHAR(100),
    paid_at TIMESTAMP WITH TIME ZONE,
    confirm_token VARCHAR(255) UNIQUE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    picked_up_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancel_reason TEXT,
    customer_memo TEXT,
    restaurant_memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_token ON orders(confirm_token);

-- ============================================
-- OrderItems Table
-- ============================================
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_id UUID REFERENCES menus(id),
    menu_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ============================================
-- Settings Table
-- ============================================
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_settings_key_type ON settings(key, type);

-- ============================================
-- DeliveryZones Table
-- ============================================
CREATE TABLE delivery_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    zone_name VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_km DOUBLE PRECISION NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(restaurant_id, zone_name)
);

CREATE INDEX idx_delivery_zones_restaurant ON delivery_zones(restaurant_id);

-- ============================================
-- Default Settings Data
-- ============================================
INSERT INTO settings (key, value, type, description) VALUES
(
    'business_hours',
    '{"openTime": "09:00", "closeTime": "22:00", "closedDays": ["sunday"], "isHoliday": false, "holidayMessage": null}',
    'business_hours',
    '영업시간 설정'
),
(
    'delivery_config',
    '{"baseFee": 3000, "perKmFee": 500, "maxDistance": 5.0, "freeDeliveryThreshold": 30000, "averageSpeedKmh": 30, "cookingTimeMinutes": 20}',
    'delivery',
    '배달비 설정'
),
(
    'payment_config',
    '{"pg": "kakaopay", "currency": "KRW", "language": "ko"}',
    'payment',
    '결제 PG 설정'
),
(
    'sms_config',
    '{"aligo": {"sender": "02-1234-5678", "template_id": "order_confirm"}}',
    'sms',
    'SMS 발송 설정'
),
(
    'general',
    '{"serviceName": "한경배달", "serviceUrl": "https://hkd.app", "contactPhone": "02-1234-5678"}',
    'general',
    '일반 설정'
);

-- ============================================
-- Sample Restaurant Data (Test)
-- ============================================
INSERT INTO restaurants (naver_place_id, name, address, road_address, latitude, longitude, phone, category, business_status, rating, is_active, is_deliverable, delivery_radius)
VALUES
('12345678', '강남초밥', '서울 강남구 강남대로 123', '서울 강남구 강남대로 123', 37.497942, 127.027621, '02-1234-5678', '일식', 'open', 4.5, true, true, 3.0),
('23456789', '홍대곱창', '서울 마포구 와우산로 45', '서울 마포구 와우산로 45', 37.556317, 126.923058, '02-2345-6789', '고기', 'open', 4.2, true, true, 3.0),
('34567890', '명동쭈꾸미', '서울 중구 명동길 10', '서울 중구 명동길 10', 37.560588, 126.986033, '02-3456-7890', '해산물', 'open', 4.3, true, true, 3.0);

-- Sample menus
INSERT INTO menus (restaurant_id, naver_menu_id, name, description, price, is_available)
SELECT 
    r.id,
    'menu_' || generate_series,
    CASE generate_series
        WHEN 1 THEN '기본 눈꽃초밥 (8조각)'
        WHEN 2 THEN '특상 눈꽃초밥 (12조각)'
        WHEN 3 THEN '연어 슬라이스'
        WHEN 4 THEN '참치（中)'
        WHEN 5 THEN '우니（中）'
    END,
    CASE generate_series
        WHEN 1 THEN '기본 눈꽃초밥 8조각'
        WHEN 2 THEN '특상 눈꽃초밥 12조각'
        WHEN 3 THEN ' свежий 연어 6조각'
        WHEN 4 THEN '참치 6조각'
        WHEN 5 THEN '우니 6조각'
    END,
    CASE generate_series
        WHEN 1 THEN 12000
        WHEN 2 THEN 18000
        WHEN 3 THEN 15000
        WHEN 4 THEN 12000
        WHEN 5 THEN 15000
    END,
    true
FROM restaurants r
WHERE r.name = '강남초밥'
CROSS JOIN generate_series(1, 5);

-- ============================================
-- Function: Generate Order Number
-- ============================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    today DATE := CURRENT_DATE;
    count_today INTEGER;
    order_num VARCHAR(20);
BEGIN
    SELECT COALESCE(COUNT(*), 0) + 1 INTO count_today
    FROM orders
    WHERE DATE(created_at) = today;
    
    order_num := TO_CHAR(today, 'YYYYMMDD') || LPAD(count_today::TEXT, 6, '0');
    
    NEW.order_number := order_num;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate order number
CREATE TRIGGER set_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION generate_order_number();

-- ============================================
-- View: Order Status Summary
-- ============================================
CREATE VIEW order_status_summary AS
SELECT 
    status,
    COUNT(*) as count,
    SUM(total_amount) as total_amount
FROM orders
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY status;
