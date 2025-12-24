-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    transaction_ref VARCHAR(50) PRIMARY KEY,
    user_email VARCHAR(255) REFERENCES users(email),
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
    transaction_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin Logs Table
CREATE TABLE IF NOT EXISTS admin_logs (
    log_id VARCHAR(50) PRIMARY KEY,
    admin_email VARCHAR(255), -- No foreign key for system logs
    action TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);