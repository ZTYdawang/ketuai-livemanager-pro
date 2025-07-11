import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/index.js';

const router = express.Router();

// --- Registration Route ---
router.post('/register', async (req, res) => {
    const { username, email, password, phoneNumber } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Please provide all required fields.' });
    }

    try {
        // 1. Check if user already exists (email, username, or phone number)
        const queryText = 'SELECT * FROM users WHERE email = $1 OR username = $2' + (phoneNumber ? ' OR phone_number = $3' : '');
        const queryParams = phoneNumber ? [email, username, phoneNumber] : [email, username];
        
        const existingUser = await db.query(queryText, queryParams);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ message: '邮箱、用户名或手机号已被占用。' });
        }

        // 2. Hash the password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 3. Insert new user into the database
        const newUser = await db.query(
            'INSERT INTO users (username, email, password_hash, phone_number) VALUES ($1, $2, $3, $4) RETURNING id, username, email, phone_number',
            [username, email, passwordHash, phoneNumber || null]
        );

        res.status(201).json({
            message: 'User registered successfully!',
            user: newUser.rows[0],
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// --- Login Route ---
router.post('/login', async (req, res) => {
    const { account, password } = req.body;

    if (!account || !password) {
        return res.status(400).json({ message: '请输入账户和密码。' });
    }

    try {
        // 1. Determine if account is email or phone number and find user
        const isEmail = account.includes('@');
        const queryText = isEmail 
            ? 'SELECT * FROM users WHERE email = $1'
            : 'SELECT * FROM users WHERE phone_number = $1';
            
        const userResult = await db.query(queryText, [account]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: '无效的凭证。' });
        }
        const user = userResult.rows[0];

        // 2. Compare password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // 3. Generate JWT
        const payload = {
            id: user.id,
            username: user.username,
        };
        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1d' } // Token expires in 1 day
        );

        res.status(200).json({
            message: '登录成功！',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                phoneNumber: user.phone_number
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


export default router; 