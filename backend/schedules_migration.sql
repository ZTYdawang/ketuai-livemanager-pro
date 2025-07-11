-- 排班功能数据库迁移脚本
-- 创建排班表及相关索引

-- Create the schedules table (排班表)
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    anchor_id INTEGER NOT NULL REFERENCES anchors(id) ON DELETE CASCADE,
    room_id INTEGER NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time_slot VARCHAR(20) NOT NULL, -- 时段，如 "morning", "afternoon", "evening", "night"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 确保同一主播在同一时间段只能在一个直播间排班
    UNIQUE(anchor_id, date, time_slot)
);

-- 添加排班表的索引以提升性能
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_anchor_id ON schedules(anchor_id);
CREATE INDEX IF NOT EXISTS idx_schedules_room_id ON schedules(room_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);
CREATE INDEX IF NOT EXISTS idx_schedules_date_room ON schedules(date, room_id);

-- 添加更新时间的触发器
CREATE OR REPLACE FUNCTION update_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER IF NOT EXISTS trigger_schedules_updated_at
    BEFORE UPDATE ON schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_schedules_updated_at();

-- 插入一些示例排班数据（如果表为空）
INSERT INTO schedules (user_id, anchor_id, room_id, date, time_slot)
SELECT 1, a.id, lr.id, CURRENT_DATE, 'morning'
FROM anchors a, live_rooms lr 
WHERE a.user_id = 1 AND lr.user_id = 1 
AND NOT EXISTS (SELECT 1 FROM schedules WHERE user_id = 1)
LIMIT 1;

INSERT INTO schedules (user_id, anchor_id, room_id, date, time_slot)
SELECT 1, a.id, lr.id, CURRENT_DATE, 'afternoon'
FROM anchors a, live_rooms lr 
WHERE a.user_id = 1 AND lr.user_id = 1 
AND a.id != (SELECT anchor_id FROM schedules WHERE user_id = 1 AND date = CURRENT_DATE AND time_slot = 'morning' LIMIT 1)
AND NOT EXISTS (SELECT 1 FROM schedules WHERE user_id = 1 AND time_slot = 'afternoon')
LIMIT 1; 