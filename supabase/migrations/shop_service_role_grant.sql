-- purchase-shop-item Edge Function (service_role) が shop_items/shop_purchases を操作できるよう権限付与
GRANT SELECT, INSERT, UPDATE, DELETE ON shop_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON shop_purchases TO service_role;
