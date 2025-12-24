-- Tickets table with enhanced schema
-- First check if table exists and alter if needed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') THEN
        CREATE TABLE tickets (
            ticket_id UUID PRIMARY KEY,
            ticket_type VARCHAR(20) NOT NULL CHECK (ticket_type IN ('EVENT', 'GAME', 'TRANSPORT')),
            ticket_subtype VARCHAR(50), -- 'GENERAL_ADMISSION', 'RESERVED_SEATING', 'ONE_WAY', 'RETURN'
            title VARCHAR(255) NOT NULL,
            description TEXT,
            event_date TIMESTAMP NOT NULL,
            end_date TIMESTAMP, -- For multi-day events
            location VARCHAR(255),
            departure_location VARCHAR(255), -- For transport
            arrival_location VARCHAR(255), -- For transport
            departure_time TIME, -- For transport
            arrival_time TIME, -- For transport
            price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
            total_quantity INTEGER NOT NULL CHECK (total_quantity > 0),
            available_quantity INTEGER NOT NULL CHECK (available_quantity >= 0),
            max_per_user INTEGER DEFAULT 1 CHECK (max_per_user > 0),
            sales_start_date TIMESTAMP,
            sales_end_date TIMESTAMP,
            cancellation_policy TEXT,
            refund_policy TEXT,
            status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED', 'EXPIRED')),
            is_featured BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ELSE
        -- Alter existing table
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_subtype VARCHAR(50);
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS departure_location VARCHAR(255);
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS arrival_location VARCHAR(255);
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS departure_time TIME;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS arrival_time TIME;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS max_per_user INTEGER DEFAULT 1;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sales_start_date TIMESTAMP;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sales_end_date TIMESTAMP;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS cancellation_policy TEXT;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS refund_policy TEXT;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Ticket settings table for global configuration
CREATE TABLE IF NOT EXISTS ticket_settings (
    setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'STRING' CHECK (setting_type IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON')),
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO ticket_settings (setting_key, setting_value, setting_type, description) VALUES
('ticket_sales_enabled', 'true', 'BOOLEAN', 'Enable/disable ticket sales globally'),
('max_tickets_per_user', '10', 'NUMBER', 'Maximum tickets per user per event'),
('cancellation_deadline_hours', '24', 'NUMBER', 'Hours before event for cancellation'),
('refund_percentage', '80', 'NUMBER', 'Refund percentage for eligible cancellations'),
('rate_limit_purchases_per_hour', '5', 'NUMBER', 'Max purchases per user per hour'),
('require_pin_for_purchase', 'true', 'BOOLEAN', 'Require PIN/OTP for ticket purchase')
ON CONFLICT (setting_key) DO NOTHING;

-- Ticket purchases table (enhanced)
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS ticket_quantity INTEGER DEFAULT 1;
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2);
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS used_at TIMESTAMP;
ALTER TABLE ticket_purchases ADD COLUMN IF NOT EXISTS validated_by VARCHAR(255);

-- Notifications table
CREATE TABLE IF NOT EXISTS ticket_notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email VARCHAR(255) NOT NULL,
    ticket_id VARCHAR(255), -- Reference to tickets table
    transaction_ref VARCHAR(255),
    notification_type VARCHAR(50) NOT NULL, -- 'PURCHASE_CONFIRMATION', 'EVENT_REMINDER', 'CANCELLATION', 'REFUND'
    message TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED'))
);

-- Ticket reports table for analytics
CREATE TABLE IF NOT EXISTS ticket_reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type VARCHAR(50) NOT NULL, -- 'SALES', 'ATTENDANCE', 'REVENUE'
    report_data JSONB,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_range_start DATE,
    date_range_end DATE
);

-- Indexes for performance (create after table modifications)
-- Note: Run these separately after confirming tables exist
-- CREATE INDEX IF NOT EXISTS idx_tickets_type_date ON tickets(ticket_type, event_date);
-- CREATE INDEX IF NOT EXISTS idx_tickets_location ON tickets(location);
-- CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
-- CREATE INDEX IF NOT EXISTS idx_ticket_purchases_user ON ticket_purchases(transaction_ref);
-- CREATE INDEX IF NOT EXISTS idx_ticket_purchases_status ON ticket_purchases(status);
-- CREATE INDEX IF NOT EXISTS idx_notifications_user_type ON ticket_notifications(user_email, notification_type);