import express from 'express';
import authMiddleware from '../middleware/auth.js';
import db from '../db/index.js';

const router = express.Router();

// @route   GET api/rooms
// @desc    获取用户的所有直播间，并附带当天排班的主播信息
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.user.id, 10);

        // 1. 获取用户的所有直播间
        const roomsResult = await db.query(
            'SELECT * FROM live_rooms WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        const rooms = roomsResult.rows;

        // 2. 获取当天所有相关的排班信息和主播信息
        // 为了效率，一次性获取所有主播和当天的所有排班
        // 修正：使用服务器本地时区获取当天日期，以匹配前端行为
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;
        
        const schedulesResult = await db.query(
            `SELECT s.*, a.name as anchor_name, a.avatar as anchor_avatar, a.gender as anchor_gender
             FROM schedules s
             LEFT JOIN anchors a ON s.anchor_id = a.id
             WHERE s.user_id = $1 AND s.date = $2`,
            [userId, today]
        );
        const todaySchedules = schedulesResult.rows;

        // 3. 将排班信息整合到直播间数据中
        const roomsWithScheduledAnchors = rooms.map(room => {
            const scheduledAnchors = todaySchedules
                .filter(schedule => {
                    // 增加日志以调试匹配过程
                    const isMatch = String(schedule.room_id) === String(room.id);
                    if (!isMatch) {
                        console.log(`[调试] 不匹配: schedule.room_id=${schedule.room_id}(${typeof schedule.room_id}) vs room.id=${room.id}(${typeof room.id})`);
                    }
                    return isMatch;
                })
                .map(schedule => ({
                    id: schedule.anchor_id,
                    name: schedule.anchor_name,
                    avatar: schedule.anchor_avatar,
                    gender: schedule.anchor_gender,
                    // 附加 time_slot 以便前端分组
                    time_slot: schedule.time_slot 
                }));
            
            return {
                ...room,
                scheduledAnchors // 将排班主播信息附加到每个房间对象
            };
        });

        console.log('[调试] 整合后的房间数据:', JSON.stringify(roomsWithScheduledAnchors, null, 2));

        res.json({
            success: true,
            data: roomsWithScheduledAnchors,
            message: '获取直播间列表成功'
        });

    } catch (err) {
        console.error('获取直播间列表失败:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Server Error',
            message: '获取直播间列表失败' 
        });
    }
});

// @route   POST api/rooms
// @desc    添加新的直播间
// @access  Private
router.post('/', authMiddleware, async (req, res) => {
    const { title, url, streamer, platform, description } = req.body;
    
    if (!title || !url) {
        return res.status(400).json({ 
            success: false,
            message: '请提供标题和URL' 
        });
    }
    
    try {
        const { rows } = await db.query(
            `INSERT INTO live_rooms (user_id, title, url, streamer, platform, description, status, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, 'IDLE', NOW(), NOW()) RETURNING *`,
            [
                req.user.id, 
                title, 
                url, 
                streamer || '未知主播', 
                platform || '其他', 
                description || ''
            ]
        );
        
        res.status(201).json({
            success: true,
            data: rows[0],
            message: '直播间添加成功'
        });
    } catch (err) {
        console.error('添加直播间失败:', err.message);
        res.status(500).json({ 
            success: false,
            message: '添加直播间失败' 
        });
    }
});

// @route   POST api/rooms/batch
// @desc    批量添加直播间
// @access  Private
router.post('/batch', authMiddleware, async (req, res) => {
    const { rooms } = req.body;
    
    if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
        return res.status(400).json({ 
            success: false,
            message: '请提供直播间数组' 
        });
    }
    
    try {
        const insertedRooms = [];
        const errors = [];
        
        for (const room of rooms) {
            try {
                if (!room.title || !room.url) {
                    errors.push({ room, error: '缺少必要字段' });
                    continue;
                }
                
                const { rows } = await db.query(
                    `INSERT INTO live_rooms (user_id, title, url, streamer, platform, description, status, created_at, updated_at) 
                     VALUES ($1, $2, $3, $4, $5, $6, 'IDLE', NOW(), NOW()) RETURNING *`,
                    [
                        req.user.id,
                        room.title,
                        room.url,
                        room.streamer || '未知主播',
                        room.platform || '其他',
                        room.description || ''
                    ]
                );
                insertedRooms.push(rows[0]);
            } catch (insertError) {
                console.error(`批量插入失败 ${room.url}:`, insertError.message);
                errors.push({ room, error: insertError.message });
            }
        }
        
        res.status(201).json({
            success: true,
            data: {
                inserted: insertedRooms,
                errors: errors,
                total: rooms.length,
                success_count: insertedRooms.length,
                error_count: errors.length
            },
            message: `成功添加 ${insertedRooms.length} 个直播间`
        });
        
    } catch (err) {
        console.error('批量添加失败:', err.message);
        res.status(500).json({ 
            success: false,
            message: '批量添加失败' 
        });
    }
});

// @route   PUT api/rooms/:id
// @desc    更新直播间信息
// @access  Private
router.put('/:id', authMiddleware, async (req, res) => {
    const roomId = req.params.id;
    const { title, url, streamer, description } = req.body;
    
    try {
        const roomCheck = await db.query(
            'SELECT * FROM live_rooms WHERE id = $1 AND user_id = $2', 
            [roomId, req.user.id]
        );
        
        if (roomCheck.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: '直播间不存在或无权限' 
            });
        }
        
        const { rows } = await db.query(
            `UPDATE live_rooms 
             SET title = $1, 
                 url = $2,
                 streamer = $3,
                 description = $4,
                 updated_at = NOW()
             WHERE id = $5 AND user_id = $6
             RETURNING *`,
            [title, url, streamer, description, roomId, req.user.id]
        );
        
        res.json({
            success: true,
            data: rows[0],
            message: '直播间更新成功'
        });
    } catch (err) {
        console.error('更新直播间失败:', err.message);
        res.status(500).json({ 
            success: false,
            message: '更新直播间失败' 
        });
    }
});

// @route   PUT api/rooms/:id/monitor
// @desc    更新直播间的监控状态
// @access  Private
router.put('/:id/monitor', authMiddleware, async (req, res) => {
    const roomId = req.params.id;
    const { is_monitored } = req.body;

    if (typeof is_monitored !== 'boolean' && typeof is_monitored !== 'number') {
        return res.status(400).json({ 
            success: false,
            message: '请提供有效的监控状态 (0 或 1)' 
        });
    }

    try {
        const roomCheck = await db.query(
            'SELECT id FROM live_rooms WHERE id = $1 AND user_id = $2', 
            [roomId, req.user.id]
        );
        
        if (roomCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: '直播间不存在或无权限' });
        }

        const { rows } = await db.query(
            'UPDATE live_rooms SET is_monitored = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [is_monitored ? 1 : 0, roomId]
        );

        res.json({
            success: true,
            data: rows[0],
            message: `监控状态已更新为 ${is_monitored}`
        });
    } catch (err) {
        console.error('更新监控状态失败:', err.message);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// @route   DELETE api/rooms/:id
// @desc    删除直播间
// @access  Private
router.delete('/:id', authMiddleware, async (req, res) => {
    const roomId = req.params.id;
    
    try {
        // 检查房间是否属于用户
        const roomCheck = await db.query(
            'SELECT * FROM live_rooms WHERE id = $1 AND user_id = $2', 
            [roomId, req.user.id]
        );
        
        if (roomCheck.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Not found',
                message: '直播间不存在或无权限' 
            });
        }
        
        await db.query(
            'DELETE FROM live_rooms WHERE id = $1 AND user_id = $2',
            [roomId, req.user.id]
        );
        
        res.json({
            success: true,
            message: '直播间删除成功'
        });
    } catch (err) {
        console.error('删除直播间失败:', err.message);
        res.status(500).json({ 
            success: false,
            error: 'Server Error',
            message: '删除直播间失败' 
        });
    }
});

// @route   GET api/rooms/:id
// @desc    获取单个直播间详情
// @access  Private
router.get('/:id', authMiddleware, async (req, res) => {
    const roomId = req.params.id;
    
    try {
        const { rows } = await db.query(
            'SELECT * FROM live_rooms WHERE id = $1 AND user_id = $2', 
            [roomId, req.user.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Not found',
                message: '直播间不存在或无权限' 
            });
        }
        
        res.json({
            success: true,
            data: {
                ...rows[0],
                boundAnchors: rows[0].bound_anchors ? JSON.parse(rows[0].bound_anchors) : []
            }
        });
    } catch (err) {
        console.error('获取直播间详情失败:', err.message);
        res.status(500).json({ 
            success: false,
            error: 'Server Error',
            message: '获取直播间详情失败' 
        });
    }
});

export default router; 