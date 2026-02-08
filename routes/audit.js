const express = require('express');
const router = express.Router();
const db = require('../database/db');
const SQLUtils = require('../database/sql_utils');
const { requireBoss } = require('../middleware/auth');

// 获取操作日志（仅老板可见）
router.get('/', requireBoss, async (req, res) => {
    try {
        const { entity_type, entity_id, user_id, start_date, end_date, keyword, limit = 100, offset = 0 } = req.query;

        let query = 'SELECT * FROM audit_logs WHERE 1=1';
        const params = [];

        if (entity_type) {
            query += ' AND entity_type = ?';
            params.push(entity_type);
        }

        if (entity_id) {
            query += ' AND entity_id = ?';
            params.push(entity_id);
        }

        if (user_id) {
            query += ' AND user_id = ?';
            params.push(user_id);
        }

        // 日期过滤
        if (start_date) {
            query += ' AND DATE(created_at) >= DATE(?)';
            params.push(start_date);
        }

        if (end_date) {
            query += ' AND DATE(created_at) <= DATE(?)';
            params.push(end_date);
        }
        // 搜索关键词
        if (keyword) {
            if (entity_type == 'all') {
                query += ' AND (username LIKE ? OR action LIKE ? OR entity_type LIKE ? OR entity_id LIKE ?)';
                params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
            } else {
                query += ' AND (entity_type LIKE ? AND (entity_id LIKE ? OR username LIKE ? OR action LIKE ? OR details LIKE ?))';
                params.push(entity_type, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
            }
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const logs = await db.all(query, params);

        // 获取总数
        let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
        const countParams = [];

        if (entity_type) {
            countQuery += ' AND entity_type = ?';
            countParams.push(entity_type);
        }

        if (entity_id) {
            countQuery += ' AND entity_id = ?';
            countParams.push(entity_id);
        }

        if (user_id) {
            countQuery += ' AND user_id = ?';
            countParams.push(user_id);
        }

        if (start_date) {
            countQuery += ' AND DATE(created_at) >= DATE(?)';
            countParams.push(start_date);
        }

        if (end_date) {
            countQuery += ' AND DATE(created_at) <= DATE(?)';
            countParams.push(end_date);
        }

        const { total } = await db.get(countQuery, countParams);

        res.json({
            logs,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取特定实体的操作历史
router.get('/entity/:type/:id', requireBoss, async (req, res) => {
    try {
        const { type, id } = req.params;

        const logs = await db.all(`
            SELECT * FROM audit_logs 
            WHERE entity_type = ? AND entity_id = ?
            ORDER BY created_at DESC
        `, [type, id]);

        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
