const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database/db');
const SQLUtils = require('../database/sql_utils');

// 登录
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('Login attempt:', username);
        const user = await SQLUtils.findN('admins', { username });
        console.log('User found:', user);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials / 用户名或密码错误' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials / 用户名或密码错误' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        req.session.isAdmin = true;

        res.json({
            id: user.id,
            username: user.username,
            role: user.role
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 检查登录状态
router.get('/check', (req, res) => {
    if (req.session.userId) {
        res.json({
            isAdmin: true,
            loggedIn: true,
            userId: req.session.userId,
            username: req.session.username,
            role: req.session.role
        });
    } else {
        res.json({ isAdmin: false, loggedIn: false });
    }
});

// 登出
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

module.exports = router;
