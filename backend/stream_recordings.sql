-- 创建流监控直播间表
CREATE TABLE IF NOT EXISTS stream_monitor_rooms (
    id SERIAL PRIMARY KEY,
    url VARCHAR(500) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    streamer VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'unknown',
    is_recording BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_check VARCHAR(50) DEFAULT '从未检测',
    recording_duration INTEGER DEFAULT 0,
    total_recordings INTEGER DEFAULT 0
);

-- 创建流录制记录表
CREATE TABLE IF NOT EXISTS stream_recordings (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES stream_monitor_rooms(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    filename VARCHAR(255),
    temp_filename VARCHAR(255),
    file_size BIGINT DEFAULT 0,
    duration INTEGER DEFAULT 0,
    quality VARCHAR(20) DEFAULT 'medium',
    audio_only BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'recording',
    error_message TEXT,
    file_path VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_stream_recordings_room_id ON stream_recordings(room_id);
CREATE INDEX IF NOT EXISTS idx_stream_recordings_status ON stream_recordings(status);
CREATE INDEX IF NOT EXISTS idx_stream_recordings_started_at ON stream_recordings(started_at);
CREATE INDEX IF NOT EXISTS idx_stream_monitor_rooms_status ON stream_monitor_rooms(status);
CREATE INDEX IF NOT EXISTS idx_stream_monitor_rooms_is_recording ON stream_monitor_rooms(is_recording);

-- 添加触发器自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为表添加触发器
CREATE TRIGGER update_stream_monitor_rooms_updated_at 
    BEFORE UPDATE ON stream_monitor_rooms 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stream_recordings_updated_at 
    BEFORE UPDATE ON stream_recordings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 