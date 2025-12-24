-- Airtime & Data Tables

-- Networks table
CREATE TABLE IF NOT EXISTS networks (
    network_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data bundles table
CREATE TABLE IF NOT EXISTS data_bundles (
    bundle_id SERIAL PRIMARY KEY,
    network_id INTEGER REFERENCES networks(network_id),
    name VARCHAR(100) NOT NULL,
    data_size VARCHAR(50) NOT NULL, -- e.g., '1GB', '5GB'
    price DECIMAL(10,2) NOT NULL,
    validity_days INTEGER DEFAULT 30,
    regional_availability TEXT DEFAULT 'National', -- e.g., 'National', 'Gauteng', 'Western Cape'
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Airtime bundles table
CREATE TABLE IF NOT EXISTS airtime_bundles (
    bundle_id SERIAL PRIMARY KEY,
    network_id INTEGER REFERENCES networks(network_id),
    name VARCHAR(100) NOT NULL,
    minutes INTEGER NOT NULL, -- e.g., 100, 500, unlimited
    price DECIMAL(10,2) NOT NULL,
    validity_days INTEGER DEFAULT 30,
    regional_availability TEXT DEFAULT 'National',
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Combined plans table (data + airtime)
CREATE TABLE IF NOT EXISTS combined_plans (
    plan_id SERIAL PRIMARY KEY,
    network_id INTEGER REFERENCES networks(network_id),
    name VARCHAR(100) NOT NULL,
    data_size VARCHAR(50), -- e.g., '1GB', '5GB'
    minutes INTEGER, -- e.g., 100, 500, unlimited
    price DECIMAL(10,2) NOT NULL,
    validity_days INTEGER DEFAULT 30,
    regional_availability TEXT DEFAULT 'National',
    discount_percentage DECIMAL(5,2) DEFAULT 0, -- promotional discount
    add_ons TEXT, -- e.g., 'Free WhatsApp, Free Facebook'
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Airtime denominations (simple config, can be hardcoded or table)
-- For now, we'll use a simple array in code, but could be a table

-- Airtime data transactions table (extends the existing usage)
CREATE TABLE IF NOT EXISTS airtime_data (
    id SERIAL PRIMARY KEY,
    transaction_ref VARCHAR(50) REFERENCES transactions(transaction_ref),
    network VARCHAR(50) NOT NULL,
    bundle_type VARCHAR(20) CHECK (bundle_type IN ('AIRTIME', 'DATA')),
    phone_number VARCHAR(15) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    bundle_id INTEGER REFERENCES data_bundles(bundle_id), -- NULL for airtime
    recipient_email VARCHAR(255), -- For sending/gifting
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Advances table for airtime loans
CREATE TABLE IF NOT EXISTS advances (
    advance_id SERIAL PRIMARY KEY,
    transaction_ref VARCHAR(50) REFERENCES transactions(transaction_ref),
    user_email VARCHAR(255) REFERENCES users(email),
    amount DECIMAL(10,2) NOT NULL,
    service_fee DECIMAL(10,2) DEFAULT 0,
    repaid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default networks
INSERT INTO networks (name) VALUES ('MTN'), ('Vodacom'), ('Telkom'), ('Cell C'), ('Rain')
ON CONFLICT (name) DO NOTHING;

-- Insert sample data bundles
INSERT INTO data_bundles (network_id, name, data_size, price, validity_days, regional_availability) VALUES
((SELECT network_id FROM networks WHERE name = 'MTN'), 'MTN 1GB', '1GB', 50.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'MTN'), 'MTN 5GB', '5GB', 200.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'MTN'), 'MTN 10GB', '10GB', 350.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'MTN'), 'MTN Unlimited', 'Unlimited', 500.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Vodacom'), 'Vodacom 1GB', '1GB', 50.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Vodacom'), 'Vodacom 5GB', '5GB', 200.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Vodacom'), 'Vodacom 10GB', '10GB', 350.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Vodacom'), 'Vodacom Unlimited', 'Unlimited', 500.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Telkom'), 'Telkom 1GB', '1GB', 50.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Telkom'), 'Telkom 5GB', '5GB', 200.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Telkom'), 'Telkom 10GB', '10GB', 350.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Telkom'), 'Telkom Unlimited', 'Unlimited', 500.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Cell C'), 'Cell C 1GB', '1GB', 50.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Cell C'), 'Cell C 5GB', '5GB', 200.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Cell C'), 'Cell C 10GB', '10GB', 350.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Cell C'), 'Cell C Unlimited', 'Unlimited', 500.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Rain'), 'Rain 1GB', '1GB', 45.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Rain'), 'Rain 5GB', '5GB', 180.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Rain'), 'Rain 10GB', '10GB', 320.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Rain'), 'Rain Unlimited', 'Unlimited', 450.00, 30, 'National')
ON CONFLICT DO NOTHING;

-- Insert sample airtime bundles
INSERT INTO airtime_bundles (network_id, name, minutes, price, validity_days, regional_availability) VALUES
((SELECT network_id FROM networks WHERE name = 'MTN'), 'MTN 100 Minutes', 100, 25.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'MTN'), 'MTN 500 Minutes', 500, 100.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'MTN'), 'MTN Unlimited Calls', NULL, 150.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Vodacom'), 'Vodacom 100 Minutes', 100, 25.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Vodacom'), 'Vodacom 500 Minutes', 500, 100.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Vodacom'), 'Vodacom Unlimited Calls', NULL, 150.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Telkom'), 'Telkom 100 Minutes', 100, 25.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Telkom'), 'Telkom 500 Minutes', 500, 100.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Telkom'), 'Telkom Unlimited Calls', NULL, 150.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Cell C'), 'Cell C 100 Minutes', 100, 25.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Cell C'), 'Cell C 500 Minutes', 500, 100.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Cell C'), 'Cell C Unlimited Calls', NULL, 150.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Rain'), 'Rain 100 Minutes', 100, 20.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Rain'), 'Rain 500 Minutes', 500, 90.00, 30, 'National'),
((SELECT network_id FROM networks WHERE name = 'Rain'), 'Rain Unlimited Calls', NULL, 140.00, 30, 'National')
ON CONFLICT DO NOTHING;

-- Insert sample combined plans
INSERT INTO combined_plans (network_id, name, data_size, minutes, price, validity_days, regional_availability, discount_percentage, add_ons) VALUES
((SELECT network_id FROM networks WHERE name = 'MTN'), 'MTN Combo 1GB + 100 Min', '1GB', 100, 65.00, 30, 'National', 10.0, 'Free WhatsApp'),
((SELECT network_id FROM networks WHERE name = 'MTN'), 'MTN Combo 5GB + 500 Min', '5GB', 500, 250.00, 30, 'National', 15.0, 'Free WhatsApp, Free Facebook'),
((SELECT network_id FROM networks WHERE name = 'MTN'), 'MTN Combo Unlimited + Unlimited', 'Unlimited', NULL, 600.00, 30, 'National', 20.0, 'Free WhatsApp, Free Facebook, Free Instagram'),
((SELECT network_id FROM networks WHERE name = 'Vodacom'), 'Vodacom Combo 1GB + 100 Min', '1GB', 100, 65.00, 30, 'National', 10.0, 'Free WhatsApp'),
((SELECT network_id FROM networks WHERE name = 'Vodacom'), 'Vodacom Combo 5GB + 500 Min', '5GB', 500, 250.00, 30, 'National', 15.0, 'Free WhatsApp, Free Facebook'),
((SELECT network_id FROM networks WHERE name = 'Vodacom'), 'Vodacom Combo Unlimited + Unlimited', 'Unlimited', NULL, 600.00, 30, 'National', 20.0, 'Free WhatsApp, Free Facebook, Free Instagram'),
((SELECT network_id FROM networks WHERE name = 'Telkom'), 'Telkom Combo 1GB + 100 Min', '1GB', 100, 65.00, 30, 'National', 10.0, 'Free WhatsApp'),
((SELECT network_id FROM networks WHERE name = 'Telkom'), 'Telkom Combo 5GB + 500 Min', '5GB', 500, 250.00, 30, 'National', 15.0, 'Free WhatsApp, Free Facebook'),
((SELECT network_id FROM networks WHERE name = 'Telkom'), 'Telkom Combo Unlimited + Unlimited', 'Unlimited', NULL, 600.00, 30, 'National', 20.0, 'Free WhatsApp, Free Facebook, Free Instagram'),
((SELECT network_id FROM networks WHERE name = 'Cell C'), 'Cell C Combo 1GB + 100 Min', '1GB', 100, 65.00, 30, 'National', 10.0, 'Free WhatsApp'),
((SELECT network_id FROM networks WHERE name = 'Cell C'), 'Cell C Combo 5GB + 500 Min', '5GB', 500, 250.00, 30, 'National', 15.0, 'Free WhatsApp, Free Facebook'),
((SELECT network_id FROM networks WHERE name = 'Cell C'), 'Cell C Combo Unlimited + Unlimited', 'Unlimited', NULL, 600.00, 30, 'National', 20.0, 'Free WhatsApp, Free Facebook, Free Instagram'),
((SELECT network_id FROM networks WHERE name = 'Rain'), 'Rain Combo 1GB + 100 Min', '1GB', 100, 60.00, 30, 'National', 10.0, 'Free WhatsApp'),
((SELECT network_id FROM networks WHERE name = 'Rain'), 'Rain Combo 5GB + 500 Min', '5GB', 500, 230.00, 30, 'National', 15.0, 'Free WhatsApp, Free Facebook'),
((SELECT network_id FROM networks WHERE name = 'Rain'), 'Rain Combo Unlimited + Unlimited', 'Unlimited', NULL, 550.00, 30, 'National', 20.0, 'Free WhatsApp, Free Facebook, Free Instagram')
ON CONFLICT DO NOTHING;