-- SQLite版本的排班功能数据库迁移脚本
-- 创建排班表及相关索引

-- Create the schedules table (排班表)
CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    anchor_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- SQLite中使用TEXT存储日期
    time_slot TEXT NOT NULL, -- 时段，如 "morning", "afternoon", "evening", "night"
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    
    -- 外键约束
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (anchor_id) REFERENCES anchors(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES live_rooms(id) ON DELETE CASCADE,
    
    -- 确保同一主播在同一时间段只能在一个直播间排班
    UNIQUE(anchor_id, date, time_slot)
);

-- 添加排班表的索引以提升性能
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_anchor_id ON schedules(anchor_id);
CREATE INDEX IF NOT EXISTS idx_schedules_room_id ON schedules(room_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);
CREATE INDEX IF NOT EXISTS idx_schedules_date_room ON schedules(date, room_id);

-- SQLite更新时间触发器
CREATE TRIGGER IF NOT EXISTS trigger_schedules_updated_at
    AFTER UPDATE ON schedules
    FOR EACH ROW
BEGIN
    UPDATE schedules SET updated_at = datetime('now', 'localtime') WHERE id = NEW.id;
END; 