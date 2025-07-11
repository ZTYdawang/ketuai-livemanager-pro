-- 流监控房间表
CREATE TABLE IF NOT EXISTS stream_monitor_rooms (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    streamer VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'unknown' CHECK (status IN ('live', 'offline', 'unknown')),
    is_recording BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_check TEXT DEFAULT '从未检测',
    recording_duration INTEGER DEFAULT 0,
    total_recordings INTEGER DEFAULT 0
);

-- 录制记录表
CREATE TABLE IF NOT EXISTS stream_recordings (
    id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES stream_monitor_rooms(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    filename TEXT,
    file_size BIGINT,
    duration INTEGER, -- 录制时长（秒）
    quality VARCHAR(20) DEFAULT 'medium' CHECK (quality IN ('high', 'medium', 'low')),
    audio_only BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'recording' CHECK (status IN ('recording', 'completed', 'failed'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_stream_monitor_rooms_status ON stream_monitor_rooms(status);
CREATE INDEX IF NOT EXISTS idx_stream_monitor_rooms_updated_at ON stream_monitor_rooms(updated_at);
CREATE INDEX IF NOT EXISTS idx_stream_recordings_room_id ON stream_recordings(room_id);
CREATE INDEX IF NOT EXISTS idx_stream_recordings_started_at ON stream_recordings(started_at);

-- 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_stream_monitor_rooms_updated_at ON stream_monitor_rooms;
CREATE TRIGGER update_stream_monitor_rooms_updated_at
    BEFORE UPDATE ON stream_monitor_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 