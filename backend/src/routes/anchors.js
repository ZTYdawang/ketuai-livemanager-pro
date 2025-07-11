import express from 'express';
import authMiddleware from '../middleware/auth.js';
import db from '../db/index.js';

const router = express.Router();

// @route   GET api/anchors
// @desc    Get all anchors for the logged-in user
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM anchors WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
        res.json({
            success: true,
            data: rows,
            message: '获取主播列表成功'
        });
    } catch (err) {
        console.error('获取主播列表失败:', err.message);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '获取主播列表失败'
        });
    }
});

// @route   POST api/anchors
// @desc    Add a new anchor for the logged-in user
// @access  Private
router.post('/', authMiddleware, async (req, res) => {
    const { name, avatar, gender, age, rating } = req.body;
    if (!name || !gender || !rating) {
        return res.status(400).json({ 
            success: false,
            error: 'Missing required fields',
            message: '请提供主播姓名、性别和评级' 
        });
    }
    try {
        const { rows } = await db.query(
            'INSERT INTO anchors (user_id, name, avatar, gender, age, rating) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [req.user.id, name, avatar, gender, age, rating]
        );
        res.status(201).json({
            success: true,
            data: rows[0],
            message: '主播创建成功'
        });
    } catch (err) {
        console.error('创建主播失败:', err.message);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '创建主播失败'
        });
    }
});

// @route   PUT api/anchors/:id
// @desc    Update an anchor
// @access  Private
router.put('/:id', authMiddleware, async (req, res) => {
    const { name, avatar, gender, age, rating } = req.body;
    const anchorId = req.params.id;

    try {
        // Check if the anchor belongs to the user
        const anchorCheck = await db.query('SELECT * FROM anchors WHERE id = $1 AND user_id = $2', [anchorId, req.user.id]);
        if (anchorCheck.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Anchor not found or user not authorized',
                message: '主播不存在或无权限操作'
            });
        }

        const { rows } = await db.query(
            'UPDATE anchors SET name = $1, avatar = $2, gender = $3, age = $4, rating = $5 WHERE id = $6 RETURNING *',
            [name, avatar, gender, age, rating, anchorId]
        );
        
        res.json({
            success: true,
            data: rows[0],
            message: '主播信息更新成功'
        });
    } catch (err) {
        console.error('更新主播失败:', err.message);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '更新主播失败'
        });
    }
});


// @route   DELETE api/anchors/:id
// @desc    Delete an anchor
// @access  Private
router.delete('/:id', authMiddleware, async (req, res) => {
    const anchorId = req.params.id;
    try {
        // Check if the anchor belongs to the user
        const anchorCheck = await db.query('SELECT * FROM anchors WHERE id = $1 AND user_id = $2', [anchorId, req.user.id]);
        if (anchorCheck.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Anchor not found or user not authorized',
                message: '主播不存在或无权限操作'
            });
        }
        
        await db.query('DELETE FROM anchors WHERE id = $1', [anchorId]);
        
        res.json({ 
            success: true,
            data: { id: anchorId },
            message: '主播删除成功' 
        });
    } catch (err) {
        console.error('删除主播失败:', err.message);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '删除主播失败'
        });
    }
});

export default router; 