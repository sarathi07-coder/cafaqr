-- Cloudflare D1 (SQLite) Schema for cafaqr Restaurant System

-- 1. Restaurants Table
CREATE TABLE IF NOT EXISTS restaurants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_name TEXT,
    address TEXT,
    phone TEXT,
    tax_percentage REAL DEFAULT 5.0,
    currency TEXT DEFAULT '₹',
    upi_id TEXT DEFAULT 'vallipriya1212-1@oksbi',
    upi_name TEXT DEFAULT 'Royal Spice Bistro',
    upi_passkey TEXT DEFAULT '1234',
    upi_accounts TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
);

-- 2. Dining Tables
CREATE TABLE IF NOT EXISTS tables (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL UNIQUE,
    restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE,
    qr_code_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 3. Customers
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    consent_given INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 4. Multi-Customer Independent Table Sessions
CREATE TABLE IF NOT EXISTS customer_sessions (
    id TEXT PRIMARY KEY,
    session_token TEXT UNIQUE NOT NULL,
    table_id TEXT REFERENCES tables(id) ON DELETE CASCADE,
    restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    session_label TEXT NOT NULL DEFAULT 'Customer 1',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    last_active TEXT DEFAULT (datetime('now'))
);

-- 5. Menu Items (Dishes & Drinks)
CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    original_price REAL,
    offer_badge TEXT,
    photo_url TEXT,
    category TEXT DEFAULT 'Main Course',
    is_veg INTEGER DEFAULT 1,
    available INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 6. Table Orders
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id TEXT REFERENCES tables(id) ON DELETE SET NULL,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    session_id TEXT REFERENCES customer_sessions(id) ON DELETE SET NULL,
    session_token TEXT,
    session_label TEXT,
    status TEXT CHECK(status IN ('PENDING','PREPARING','READY','SERVED','PAID','CANCELLED')) NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    tax_percentage REAL DEFAULT 5.0,
    tax_amount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    payment_method TEXT DEFAULT 'CASH',
    coupon_code TEXT,
    discount_amount REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 7. Ordered Items Breakdown
CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id TEXT REFERENCES menu_items(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_at_order REAL NOT NULL,
    status TEXT CHECK(status IN ('PENDING','PREPARING','READY','SERVED')) NOT NULL DEFAULT 'PENDING',
    special_instructions TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 8. Customer Feedback & Ratings (5-Star Reviews)
CREATE TABLE IF NOT EXISTS order_feedback (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comments TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 9. Table Waiter Assistance / Service Calls
CREATE TABLE IF NOT EXISTS service_requests (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id TEXT REFERENCES tables(id) ON DELETE CASCADE,
    session_token TEXT,
    session_label TEXT,
    customer_name TEXT,
    request_type TEXT NOT NULL,
    status TEXT CHECK(status IN ('PENDING', 'ATTENDED', 'RESOLVED')) NOT NULL DEFAULT 'PENDING',
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT
);

-- 10. Promotional Coupons & Discounts
CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    discount_type TEXT CHECK(discount_type IN ('PERCENTAGE', 'FLAT')) NOT NULL,
    discount_value REAL NOT NULL,
    min_order_amount REAL DEFAULT 0,
    max_discount_amount REAL,
    valid_until TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    CONSTRAINT unique_restaurant_coupon UNIQUE (restaurant_id, code)
);

-- High-Performance Composite Indexes
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table_status ON orders(table_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(session_token);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_table ON customer_sessions(table_id, is_active);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_token ON customer_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);
CREATE INDEX IF NOT EXISTS idx_feedback_restaurant ON order_feedback(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_table ON service_requests(table_id);
CREATE INDEX IF NOT EXISTS idx_coupons_restaurant ON coupons(restaurant_id);

