const express = require('express');
const router = express.Router();
const db = require('../database/db');
const SQLUtils = require('../database/sql_utils');
const { requireAuth, optionalAuth, auditLog } = require('../middleware/auth');

// 获取所有客户（可选登录）
router.get('/', requireAuth, async (req, res) => {
    try {
        const customers = await SQLUtils.findAll('customers', {}, 'created_at DESC');
        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取单个客户详情（可选登录）
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const customer = await SQLUtils.findN('customers', { id: req.params.id });
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        res.json(customer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 通过电话查找或创建客户 / Find or Create by Phone（需要登录）
router.post('/find-or-create', requireAuth, auditLog('CREATE', 'customer'), async (req, res) => {
    try {
        const { phone, name, address } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required / 电话号码必填' });
        }

        // 先查找是否存在
        let customer = await SQLUtils.findN('customers', { phone });

        if (customer) {
            // 如果存在，返回现有客户
            return res.json({ customer, isNew: false });
        }

        // 不存在则创建新客户
        if (!name) {
            return res.status(400).json({ error: 'Name is required for new customer / 新客户需要姓名' });
        }

        const result = await SQLUtils.insert('customers', { name, phone, address });
        customer = await SQLUtils.findN('customers', { id: result.id });
        res.status(201).json({ customer, isNew: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取客户的订单历史（可选登录）
router.get('/:id/orders', requireAuth, async (req, res) => {
    try {
        const orders = await db.all(
            `SELECT o.*, f.name as factory_name 
             FROM orders o 
             JOIN factories f ON o.factory_id = f.id 
             WHERE o.customer_id = ? 
             ORDER BY o.order_date DESC`,
            [req.params.id]
        );
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建新客户（需要登录）
router.post('/', requireAuth, auditLog('CREATE', 'customer'), async (req, res) => {
    try {
        const { name, phone, address } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Customer name is required' });
        }

        const result = await SQLUtils.insert('customers', { name, phone, address });
        const customer = await SQLUtils.findN('customers', { id: result.id });
        res.status(201).json(customer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新客户信息（需要登录）
router.put('/:id', requireAuth, auditLog('UPDATE', 'customer'), async (req, res) => {
    try {
        const { name, phone, address } = req.body;

        const result = await SQLUtils.update('customers', { name, phone, address }, { id: req.params.id });

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const customer = await SQLUtils.findN('customers', { id: req.params.id });
        res.json(customer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除客户（仅当没有订单时，需要登录）
router.delete('/:id', requireAuth, auditLog('DELETE', 'customer'), async (req, res) => {
    try {
        // 检查是否有关联订单
        const ordersCount = await SQLUtils.count('orders', { customer_id: req.params.id });

        if (ordersCount > 0) {
            return res.status(400).json({
                error: 'Cannot delete customer with existing orders'
            });
        }

        const result = await SQLUtils.delete('customers', { id: req.params.id });

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
