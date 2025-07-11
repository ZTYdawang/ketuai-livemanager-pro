import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
    // 开发环境下的快速绕过（临时解决方案）
    if (process.env.NODE_ENV !== 'production') {
        // 如果没有Authorization头，使用模拟用户
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            console.log('🔧 开发模式：使用模拟用户 (id: 1, username: admin)');
            req.user = {
                id: 1,
                username: 'admin'
            };
            return next();
        }
    }

    // Get token from header
    const authHeader = req.header('Authorization');

    // Check if not token
    if (!authHeader) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // The token is expected to be in the format "Bearer <token>"
    const token = authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Token format is invalid, authorization denied' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Add user from payload to the request object
        req.user = decoded;
        
        // 添加调试日志
        console.log('🔐 JWT认证成功 - 用户信息:', {
            id: req.user.id,
            username: req.user.username,
            userId_type: typeof req.user.id
        });
        
        next();
    } catch (e) {
        console.error('🚫 JWT认证失败:', e.message);
        res.status(401).json({ message: 'Token is not valid' });
    }
};

export default authMiddleware; 