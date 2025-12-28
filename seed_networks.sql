-- Seed data for networks table
-- This will insert common South African mobile network operators

INSERT INTO networks (name, enabled) VALUES
    ('MTN', true),
    ('Vodacom', true),
    ('Cell C', true),
    ('Telkom', true),
    ('Rain', true),
    ('Virgin Mobile', false),  -- Example of disabled network
    ('Sentech', false);        -- Example of disabled network

-- Alternative approach: If you want to specify specific values for all columns
-- INSERT INTO networks (name, enabled, created_at) VALUES
--     ('MTN', true, CURRENT_TIMESTAMP),
--     ('Vodacom', true, CURRENT_TIMESTAMP),
--     ('Cell C', true, CURRENT_TIMESTAMP),
--     ('Telkom', true, CURRENT_TIMESTAMP),
--     ('Rain', true, CURRENT_TIMESTAMP);

-- To verify the data was inserted:
-- SELECT * FROM networks ORDER BY network_id;