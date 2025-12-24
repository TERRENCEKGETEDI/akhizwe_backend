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
INSERT INTO data_bundles (network_id, name, data_size, price) VALUES
((SELECT network_id FROM networks WHERE name = 'MTN'), 'MTN 1GB', '1GB', 50.00),
((SELECT network_id FROM networks WHERE name = 'MTN'), 'MTN 5GB', '5GB', 200.00),
((SELECT network_id FROM networks WHERE name = 'Vodacom'), 'Vodacom 1GB', '1GB', 50.00),
((SELECT network_id FROM networks WHERE name = 'Vodacom'), 'Vodacom 5GB', '5GB', 200.00),
((SELECT network_id FROM networks WHERE name = 'Telkom'), 'Telkom 1GB', '1GB', 50.00),
((SELECT network_id FROM networks WHERE name = 'Telkom'), 'Telkom 5GB', '5GB', 200.00),
((SELECT network_id FROM networks WHERE name = 'Cell C'), 'Cell C 1GB', '1GB', 50.00),
((SELECT network_id FROM networks WHERE name = 'Cell C'), 'Cell C 5GB', '5GB', 200.00)
ON CONFLICT DO NOTHING;