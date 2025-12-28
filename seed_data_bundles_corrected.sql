-- Step 1: First, let's see what networks actually exist in your database
SELECT 'Step 1: Available Networks' as step;
SELECT * FROM networks ORDER BY network_id;

-- Step 2: Clear any existing data bundles
DELETE FROM data_bundles;

-- Step 3: Insert data bundles using the ACTUAL network IDs from your database
-- Replace the network_id values below with the ones from Step 1

-- Example using network_id from your actual networks table:
-- If your first network is MTN with network_id = 10, change all (1, ...) to (10, ...)
INSERT INTO data_bundles (network_id, name, data_size, price, enabled) VALUES
-- Replace X with your actual first network_id
(X, 'Network 1 500MB Data Bundle', '500MB', 40.00, true),
(X, 'Network 1 1GB Data Bundle', '1GB', 55.00, true),
(X, 'Network 1 2GB Data Bundle', '2GB', 80.00, true),
(X, 'Network 1 5GB Data Bundle', '5GB', 160.00, true),
(X, 'Network 1 10GB Data Bundle', '10GB', 280.00, true),
(X, 'Network 1 20GB Data Bundle', '20GB', 480.00, true);

-- If you have a second network, replace Y with its actual network_id
INSERT INTO data_bundles (network_id, name, data_size, price, enabled) VALUES
(Y, 'Network 2 500MB Data Bundle', '500MB', 50.00, true),
(Y, 'Network 2 1GB Data Bundle', '1GB', 65.00, true),
(Y, 'Network 2 2GB Data Bundle', '2GB', 90.00, true),
(Y, 'Network 2 5GB Data Bundle', '5GB', 180.00, true),
(Y, 'Network 2 10GB Data Bundle', '10GB', 300.00, true),
(Y, 'Network 2 20GB Data Bundle', '20GB', 520.00, true);

-- If you have a third network, replace Z with its actual network_id
INSERT INTO data_bundles (network_id, name, data_size, price, enabled) VALUES
(Z, 'Network 3 500MB Data Bundle', '500MB', 45.00, true),
(Z, 'Network 3 1GB Data Bundle', '1GB', 60.00, true),
(Z, 'Network 3 2GB Data Bundle', '2GB', 85.00, true),
(Z, 'Network 3 5GB Data Bundle', '5GB', 170.00, true),
(Z, 'Network 3 10GB Data Bundle', '10GB', 290.00, true),
(Z, 'Network 3 20GB Data Bundle', '20GB', 500.00, true);

-- Step 4: Verify the insertion
SELECT 'Step 4: Data Bundles Created' as step;
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