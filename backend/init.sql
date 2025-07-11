-- Create ENUM types for anchor properties
CREATE TYPE IF NOT EXISTS anchor_gender AS ENUM ('male', 'female');
CREATE TYPE IF NOT EXISTS anchor_rating AS ENUM ('top', 'experienced', 'regular', 'probation');

-- Create the users table (needs to exist before anchors/live_rooms)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pre-set admin user for testing
INSERT INTO users (username, email, password_hash)
VALUES ('admin', 'admin@163.com', '$2a$10$62gKvMd.mHzOIj2W195pZOaGFoEUBSIXtmHW2yFVRbm6d3GhpgC6a')
ON CONFLICT (email) DO NOTHING;

-- Create the anchors table
CREATE TABLE IF NOT EXISTS anchors (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    avatar VARCHAR(255),
    gender anchor_gender NOT NULL,
    age INTEGER,
    rating anchor_rating NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the live_rooms table
CREATE TABLE IF NOT EXISTS live_rooms (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for foreign keys to improve performance
CREATE INDEX IF NOT EXISTS idx_anchors_user_id ON anchors(user_id);
CREATE INDEX IF NOT EXISTS idx_live_rooms_user_id ON live_rooms(user_id); 