-- Reports Table for reported users/content
CREATE TABLE reports (
    report_id VARCHAR(50) PRIMARY KEY,
    reporter_email VARCHAR(255) REFERENCES users(email),
    reported_email VARCHAR(255) REFERENCES users(email),
    media_id VARCHAR(50) REFERENCES media(media_id),
    comment_id VARCHAR(50) REFERENCES media_comments(comment_id),
    report_type VARCHAR(20) CHECK (report_type IN ('USER', 'MEDIA', 'COMMENT')),
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'RESOLVED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);