-- Initial Seed Data for Cloudflare D1 (Royal Spice Bistro)

-- 1. Restaurant
INSERT OR REPLACE INTO restaurants (
    id, name, owner_name, address, phone, tax_percentage, currency, upi_id, upi_name, upi_passkey, upi_accounts
) VALUES (
    'db4ed920-3d20-420a-9f54-99d3c0b48a08',
    'Royal Spice Bistro',
    'Tarun Karthick',
    '742 Evergreen Promenade, City Center',
    '+91-9876543210',
    5.0,
    '₹',
    'vallipriya1212-1@oksbi',
    'Royal Spice Bistro',
    '1234',
    '[{"id":"acc_1","bank":"State Bank of India (SBI)","upi_id":"vallipriya1212-1@oksbi","upi_name":"Royal Spice Bistro (SBI)","daily_limit":"₹1,00,000 / day","notes":"Primary Account (GPay / PhonePe / Paytm)"},{"id":"acc_2","bank":"HDFC Bank","upi_id":"royalspice.bistro@okhdfcbank","upi_name":"Royal Spice Bistro (HDFC)","daily_limit":"₹2,00,000 / day","notes":"Secondary Backup"},{"id":"acc_3","bank":"ICICI Bank","upi_id":"royalspice@icici","upi_name":"Royal Spice Bistro (ICICI)","daily_limit":"₹2,00,000 / day","notes":"Weekend High-Volume Backup"}]'
);

-- 2. Dining Tables 1 to 5
INSERT OR REPLACE INTO tables (id, number, restaurant_id, qr_code_url) VALUES 
('b6f869e1-d722-440a-8928-a65e1e76ced5', 1, 'db4ed920-3d20-420a-9f54-99d3c0b48a08', '/order?tableNumber=1'),
('a1000000-0000-0000-0000-000000000002', 2, 'db4ed920-3d20-420a-9f54-99d3c0b48a08', '/order?tableNumber=2'),
('a1000000-0000-0000-0000-000000000003', 3, 'db4ed920-3d20-420a-9f54-99d3c0b48a08', '/order?tableNumber=3'),
('a1000000-0000-0000-0000-000000000004', 4, 'db4ed920-3d20-420a-9f54-99d3c0b48a08', '/order?tableNumber=4'),
('a1000000-0000-0000-0000-000000000005', 5, 'db4ed920-3d20-420a-9f54-99d3c0b48a08', '/order?tableNumber=5');

-- 3. Menu Items
INSERT OR REPLACE INTO menu_items (id, restaurant_id, name, description, price, original_price, offer_badge, photo_url, category, is_veg, available) VALUES
('540051c9-89cc-4e5c-aa00-95fae1c04c80', 'db4ed920-3d20-420a-9f54-99d3c0b48a08', 'Fresh Lime Soda', 'Refreshing lime drink sweet & salted', 80.0, 100.0, '20% OFF', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500', 'Beverages', 1, 1),
('2e3d9e19-123a-470c-99c0-38ef7af54b15', 'db4ed920-3d20-420a-9f54-99d3c0b48a08', 'Mango Lassi', 'Thick yoghurt beverage blended with Alphonso mango pulp', 150.0, NULL, NULL, 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500', 'Beverages', 1, 1),
('b72fd47b-923a-48fa-a68d-e7d95de6e2b3', 'db4ed920-3d20-420a-9f54-99d3c0b48a08', 'Butter Naan', 'Fluffy clay-oven flatbread brushed with butter', 50.0, NULL, NULL, 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500', 'Breads', 1, 1),
('9e3a08ad-311a-47e5-8911-cb534b5e0759', 'db4ed920-3d20-420a-9f54-99d3c0b48a08', 'Garlic Naan', 'Topped with roasted garlic and coriander', 65.0, NULL, NULL, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500', 'Breads', 1, 1),
('3daffcc2-0d82-44e2-9103-44f21a85ea5f', 'db4ed920-3d20-420a-9f54-99d3c0b48a08', 'Tandoori Roti', 'Whole wheat traditional clay-oven bread', 30.0, NULL, NULL, 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500', 'Breads', 1, 1),
('5b378d8a-1483-4e84-a9fe-d39b4e5699b3', 'db4ed920-3d20-420a-9f54-99d3c0b48a08', 'Gulab Jamun (2 pcs)', 'Warm milk-solid dumplings soaked in rose cardamom syrup', 90.0, NULL, NULL, 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500', 'Desserts', 1, 1),
('351b775c-04b6-462e-bae2-65d7f4d487b8', 'db4ed920-3d20-420a-9f54-99d3c0b48a08', 'Sizzling Chocolate Brownie', 'Gooey walnut brownie served on a hot sizzler with vanilla ice cream', 160.0, NULL, NULL, 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=500', 'Desserts', 1, 1),
('0923b978-957c-4fc1-9536-fbfa5a01730f', 'db4ed920-3d20-420a-9f54-99d3c0b48a08', 'Butter Chicken', 'Tender chicken pieces cooked in authentic makhani sauce', 340.0, 380.0, '12% OFF', 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500', 'Main Course', 0, 1),
('f9ea14f8-adff-472a-ac04-7256e40ea2e9', 'db4ed920-3d20-420a-9f54-99d3c0b48a08', 'Dal Makhani', 'Slow-cooked black lentils finished with fresh cream and butter', 220.0, NULL, NULL, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500', 'Main Course', 1, 1),
('b3a99aa3-4deb-43b7-864e-a2a92e162bbb', 'db4ed920-3d20-420a-9f54-99d3c0b48a08', 'Paneer Butter Masala', 'Soft paneer cubes simmered in rich creamy tomato gravy', 290.0, 320.0, 'CHEF SPECIAL', 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500', 'Main Course', 1, 1),
('bd726b3a-77cd-497c-8440-5bb45b3499e2', 'db4ed920-3d20-420a-9f54-99d3c0b48a08', 'Chicken 65', 'Spicy, deep-fried chicken cubes tempered with curry leaves', 280.0, NULL, NULL, 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=500', 'Starters', 0, 1),
('ddbdda48-5476-4802-9046-7e520f3e390a', 'db4ed920-3d20-420a-9f54-99d3c0b48a08', 'Crispy Corn Salt & Pepper', 'Sweet golden corn tossed in oriental spices', 180.0, NULL, NULL, 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=500', 'Starters', 1, 1),
('59eb2366-8c87-4990-9cbc-6bf2607ac15a', 'db4ed920-3d20-420a-9f54-99d3c0b48a08', 'Paneer Tikka', 'Tandoor-charred cottage cheese with mint dip', 240.0, NULL, NULL, 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=500', 'Starters', 1, 1);

-- 4. Promo Coupons
INSERT OR REPLACE INTO coupons (id, restaurant_id, code, discount_type, discount_value, min_order_amount, max_discount_amount, is_active) VALUES
('c1000000-0000-0000-0000-000000000001', 'db4ed920-3d20-420a-9f54-99d3c0b48a08', 'WELCOME10', 'PERCENTAGE', 10.0, 300.0, 150.0, 1),
('c1000000-0000-0000-0000-000000000002', 'db4ed920-3d20-420a-9f54-99d3c0b48a08', 'FLAT50', 'FLAT', 50.0, 250.0, NULL, 1);

