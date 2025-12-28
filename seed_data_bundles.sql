-- Seed data for data_bundles table
-- This script will populate the data_bundles table with sample data

-- First, let's see what networks we have available
SELECT 'Available Networks:' as info;
SELECT * FROM networks ORDER BY network_id;

-- Clear existing data bundles (if any)
DELETE FROM data_bundles;

-- Insert seed data for each network
-- You'll need to run this for each network_id that exists
-- Adjust the network_id values based on your actual network data

-- For MTN (assuming network_id = 1, adjust if different)
INSERT INTO data_bundles (network_id, name, data_size, price, enabled) VALUES
(1, 'MTN 500MB Data Bundle', '500MB', 40.00, true),
(1, 'MTN 1GB Data Bundle', '1GB', 55.00, true),
(1, 'MTN 2GB Data Bundle', '2GB', 80.00, true),
(1, 'MTN 5GB Data Bundle', '5GB', 160.00, true),
(1, 'MTN 10GB Data Bundle', '10GB', 280.00, true),
(1, 'MTN 20GB Data Bundle', '20GB', 480.00, true);

-- For Vodacom (assuming network_id = 2, adjust if different)
INSERT INTO data_bundles (network_id, name, data_size, price, enabled) VALUES
(2, 'Vodacom 500MB Data Bundle', '500MB', 50.00, true),
(2, 'Vodacom 1GB Data Bundle', '1GB', 65.00, true),
(2, 'Vodacom 2GB Data Bundle', '2GB', 90.00, true),
(2, 'Vodacom 5GB Data Bundle', '5GB', 180.00, true),
(2, 'Vodacom 10GB Data Bundle', '10GB', 300.00, true),
(2, 'Vodacom 20GB Data Bundle', '20GB', 520.00, true);

-- For Cell C (assuming network_id = 3, adjust if different)
INSERT INTO data_bundles (network_id, name, data_size, price, enabled) VALUES
(3, 'Cell C 500MB Data Bundle', '500MB', 45.00, true),
(3, 'Cell C 1GB Data Bundle', '1GB', 60.00, true),
(3, 'Cell C 2GB Data Bundle', '2GB', 85.00, true),
(3, 'Cell C 5GB Data Bundle', '5GB', 170.00, true),
(3, 'Cell C 10GB Data Bundle', '10GB', 290.00, true),
(3, 'Cell C 20GB Data Bundle', '20GB', 500.00, true);

-- Verify the insertion
SELECT 'Data Bundles Created:' as info;
SELECT 
    db.bundle_id,
    n.name as network_name,
    db.name as bundle_name,
    db.data_size,
    db.price,
    db.enabled,
    db.created_at
FROM data_bundles db
JOIN networks n ON db.network_id = n.network_id
ORDER BY db.network_id, db.price;

-- Show summary
SELECT 
    'Total data bundles created: ' || COUNT(*) as summary
FROM data_bundles;