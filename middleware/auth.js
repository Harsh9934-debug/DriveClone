const jwt = require('jsonwebtoken');
const UserModel = require('../models/user.model');

// Middleware for optional authentication (user may or may not be logged in)
const auth = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        
        if (!token) {
            // No token, continue without user
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await UserModel.findById(decoded.userId);
        
        if (!user) {
            // Invalid token, clear cookie and continue without user
            res.clearCookie('token');
            return next();
        }

        req.user = user;
        next();
    } catch (error) {
        // If token is invalid, clear cookie and continue without user
        res.clearCookie('token');
        next();
    }
};

// Middleware for required authentication (user must be logged in)
const requireAuth = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Please login to access this resource',
                redirectTo: '/user/login' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await UserModel.findById(decoded.userId);
        
        if (!user) {
            res.clearCookie('token');
            return res.status(401).json({ 
                success: false, 
                message: 'User not found. Please login again.',
                redirectTo: '/user/login' 
            });
        }

        req.user = user;
        next();
    } catch (error) {
        res.clearCookie('token');
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid token. Please login again.',
            redirectTo: '/user/login' 
        });
    }
};

module.exports = { auth, requireAuth };