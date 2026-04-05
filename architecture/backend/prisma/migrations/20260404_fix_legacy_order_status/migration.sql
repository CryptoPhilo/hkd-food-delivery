-- 관리자 라우트의 STATUS_TRANSITIONS 불일치로 인해 잘못된 상태값으로 저장된 레거시 주문 데이터 수정
-- 'confirmed' → 'order_confirmed', 'picking_up' → 'picked_up', 'delivered' → 'completed'

UPDATE orders SET status = 'order_confirmed' WHERE status = 'confirmed';
UPDATE orders SET status = 'picked_up' WHERE status = 'picking_up';
UPDATE orders SET status = 'completed' WHERE status = 'delivered';
