-- Media Tables for Music and Video Module

-- Media table
CREATE TABLE IF NOT EXISTS media (
    media_id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    media_type VARCHAR(10) CHECK (media_type IN ('audio', 'video')),
    uploader_email VARCHAR(255) REFERENCES users(email),
    file_path TEXT NOT NULL,
    file_size INT NOT NULL,
    artist VARCHAR(255),
    category VARCHAR(100),
    release_date DATE,
    copyright_declared BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    view_count INT DEFAULT 0,
    download_count INT DEFAULT 0,
    monetization_enabled BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Media interactions table (likes, favorites)
CREATE TABLE IF NOT EXISTS media_interactions (
    interaction_id SERIAL PRIMARY KEY,
    media_id VARCHAR(50) REFERENCES media(media_id) ON DELETE CASCADE,
    user_email VARCHAR(255) REFERENCES users(email),
    interaction_type VARCHAR(20) CHECK (interaction_type IN ('LIKE', 'FAVORITE')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(media_id, user_email, interaction_type)
);

-- Media comments table
CREATE TABLE IF NOT EXISTS media_comments (
    comment_id VARCHAR(50) PRIMARY KEY,
    media_id VARCHAR(50) REFERENCES media(media_id) ON DELETE CASCADE,
    user_email VARCHAR(255) REFERENCES users(email),
    comment_text TEXT NOT NULL,
    parent_comment_id VARCHAR(50) REFERENCES media_comments(comment_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comment likes table
CREATE TABLE IF NOT EXISTS comment_likes (
    like_id SERIAL PRIMARY KEY,
    comment_id VARCHAR(50) REFERENCES media_comments(comment_id) ON DELETE CASCADE,
    user_email VARCHAR(255) REFERENCES users(email),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(comment_id, user_email)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id VARCHAR(50) PRIMARY KEY,
    user_email VARCHAR(255) REFERENCES users(email),
    notification_type VARCHAR(50) NOT NULL, -- e.g., 'MEDIA_APPROVED', 'COMMENT_RECEIVED'
    message TEXT NOT NULL,
    related_media_id VARCHAR(50) REFERENCES media(media_id),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);