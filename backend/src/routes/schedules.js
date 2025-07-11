import express from 'express';
import authMiddleware from '../middleware/auth.js';
import db from '../db/index.js';

const router = express.Router();

// @route   GET api/schedules
// @desc    获取指定日期的排班数据
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { date, roomId } = req.query;
        console.log('📝 GET /api/schedules - 用户ID:', req.user.id, '日期:', date, '直播间ID:', roomId);
        
        let query = 'SELECT * FROM schedules WHERE user_id = $1';
        let params = [req.user.id];
        
        if (date) {
            query += ' AND date = $2';
            params.push(date);
        }
        
        if (roomId) {
            query += ' AND room_id = $3';
            params.push(roomId);
        }
        
        const { rows } = await db.query(query, params);
        
        res.json({
            success: true,
            data: rows,
            message: '获取排班数据成功'
        });
    } catch (err) {
        console.error('获取排班数据失败:', err.message);
        res.status(500).json({ 
            success: false, 
            error: 'Server Error',
            message: '获取排班数据失败' 
        });
    }
});

// @route   POST api/schedules
// @desc    创建或更新排班
// @access  Private
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { anchorId, date, timeSlot, roomId } = req.body;
        
        if (!anchorId || !date || !timeSlot || !roomId) {
            return res.status(400).json({ 
                success: false,
                error: 'Missing required fields',
                message: '请提供主播ID、日期、时段和直播间ID' 
            });
        }
        
        console.log('📝 POST /api/schedules - 排班数据:', { anchorId, date, timeSlot, roomId });
        
        // 检查是否已存在相同的排班（同一主播、同一日期、同一时段、同一直播间）
        const existingSchedule = await db.query(
            'SELECT * FROM schedules WHERE anchor_id = $1 AND date = $2 AND time_slot = $3 AND room_id = $4',
            [anchorId, date, timeSlot, roomId]
        );
        
        if (existingSchedule.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Schedule conflict',
                message: '该主播在此时段已有排班安排'
            });
        }
        
        // 检查主播在同一时段是否已有其他直播间的排班
        const conflictSchedule = await db.query(
            'SELECT * FROM schedules WHERE anchor_id = $1 AND date = $2 AND time_slot = $3',
            [anchorId, date, timeSlot]
        );
        
        if (conflictSchedule.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Time slot conflict',
                message: '该主播在此时段已在其他直播间有排班安排'
            });
        }
        
        // 创建新排班
        const { rows } = await db.query(
            `INSERT INTO schedules (user_id, anchor_id, date, time_slot, room_id) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [req.user.id, anchorId, date, timeSlot, roomId]
        );
        
        console.log('✅ POST /api/schedules - 创建成功:', rows[0]);
        
        res.status(201).json({
            success: true,
            data: rows[0],
            message: '排班创建成功'
        });
    } catch (err) {
        console.error('创建排班失败:', err.message);
        res.status(500).json({ 
            success: false,
            error: 'Server Error',
            message: '创建排班失败' 
        });
    }
});

// @route   DELETE api/schedules
// @desc    删除指定排班
// @access  Private
router.delete('/', authMiddleware, async (req, res) => {
    try {
        const { anchorId, date, timeSlot, roomId } = req.body;
        
        if (!anchorId || !date || !timeSlot) {
            return res.status(400).json({ 
                success: false,
                error: 'Missing required fields',
                message: '请提供主播ID、日期和时段' 
            });
        }
        
        console.log('📝 DELETE /api/schedules - 删除参数:', { anchorId, date, timeSlot, roomId });
        
        let query = 'DELETE FROM schedules WHERE anchor_id = $1 AND date = $2 AND time_slot = $3';
        let params = [anchorId, date, timeSlot];
        
        if (roomId) {
            query += ' AND room_id = $4';
            params.push(roomId);
        }
        
        const result = await db.query(query, params);
        
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Schedule not found',
                message: '未找到指定的排班记录'
            });
        }
        
        console.log('✅ DELETE /api/schedules - 删除成功');
        
        res.json({
            success: true,
            message: '排班删除成功'
        });
    } catch (err) {
        console.error('删除排班失败:', err.message);
        res.status(500).json({ 
            success: false,
            error: 'Server Error',
            message: '删除排班失败' 
        });
    }
});

// @route   GET api/schedules/conflicts
// @desc    检查排班冲突
// @access  Private
router.get('/conflicts', authMiddleware, async (req, res) => {
    try {
        const { anchorId, date, timeSlot } = req.query;
        
        if (!anchorId || !date || !timeSlot) {
            return res.status(400).json({ 
                success: false,
                error: 'Missing required fields',
                message: '请提供主播ID、日期和时段' 
            });
        }
        
        const { rows } = await db.query(
            'SELECT * FROM schedules WHERE anchor_id = $1 AND date = $2 AND time_slot = $3',
            [anchorId, date, timeSlot]
        );
        
        res.json({
            success: true,
            hasConflict: rows.length > 0,
            conflicts: rows,
            message: rows.length > 0 ? '检测到排班冲突' : '无排班冲突'
        });
    } catch (err) {
        console.error('检查排班冲突失败:', err.message);
        res.status(500).json({ 
            success: false,
            error: 'Server Error',
            message: '检查排班冲突失败' 
        });
    }
});

export default router; 