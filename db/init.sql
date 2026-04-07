-- server/src/db/init.sql

-- Initial Setup
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users (The Foundation)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('merchant', 'customer')),
    country CHAR(2) NOT NULL CHECK (country IN ('NG', 'GH', 'KE', 'ZA')),
    base_currency CHAR(3) NOT NULL CHECK (base_currency IN ('NGN', 'GHS', 'KES', 'ZAR')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Products (Owned by Merchants)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL,
    currency CHAR(3) NOT NULL,
    category VARCHAR(100),
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Cart (Temporary Customer State)
CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate rows for the same product/user
    CONSTRAINT unique_user_product UNIQUE (user_id, product_id)
);

-- 4. Orders (The Financial Record)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'review_required')) DEFAULT 'pending',
    customer_currency CHAR(3) NOT NULL,
    customer_total DECIMAL(12, 2) NOT NULL,
    exchange_rate_applied DECIMAL(18, 6) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Order Items (The Locked Snapshot)
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    merchant_id UUID NOT NULL REFERENCES users(id),
    quantity INTEGER NOT NULL,
    unit_price_merchant_currency DECIMAL(12, 2) NOT NULL,
    merchant_currency CHAR(3) NOT NULL,
    merchant_payout_amount DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Rate Cache (System Utility)
CREATE TABLE IF NOT EXISTS rate_cache (
    id SERIAL PRIMARY KEY,
    base_currency CHAR(3) NOT NULL,
    rates JSONB NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Always index your foreign keys to make JOIN queries fast -- for performance optimization
CREATE INDEX idx_products_merchant_id ON products(merchant_id);
CREATE INDEX idx_users_role ON users(role);
-- Useful if you frequently filter admins vs merchants in your dashboard.

CREATE INDEX idx_products_category_active ON products(category) WHERE is_active = true;
CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);

-- 4. Orders Table
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
-- DESC because you usually want the NEWEST orders first.

-- 5. Order Items Table
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_merchant_id ON order_items(merchant_id);
-- This helps a merchant see their specific sales history.

-- 6. Rate Cache Table
CREATE INDEX idx_rate_cache_latest ON rate_cache(base_currency, fetched_at DESC);