-- 복수 식당 주문 그룹화를 위한 delivery_group_id 컬럼 추가
ALTER TABLE orders ADD COLUMN delivery_group_id VARCHAR;
CREATE INDEX idx_orders_delivery_group_id ON orders(delivery_group_id);
