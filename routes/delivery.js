const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth, auditLog } = require('../middleware/auth');

// 获取交付dashboard（可选登录）
router.get('/', requireAuth, async (req, res) => {
    try {
        const today = new Date().toLocaleDateString('sv-SE');

        const orders = await db.all(`
            SELECT o.*, c.name as customer_name, c.phone as customer_phone,
                   f.name as factory_name
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            JOIN factories f ON o.factory_id = f.id
            WHERE (o.factory_delivery_date IS NULL
            OR o.factory_delivery_date <= ?)
            AND (o.status = 'out_for_delivery' or o.status = 'ready_for_pickup' or o.status = 'in_transit' or o.status = 'factory_confirmed')
            ORDER BY o.factory_delivery_date ASC
        `, [today]);
        console.log(orders);
        res.json(orders);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
});

// 更新订单 / Update Orders
router.put('/update', requireAuth, async (req, res) => {
    try {
        const { orderIds, factoryDeliveryDate, status } = req.body;
        const today = new Date().toLocaleDateString('sv-SE');
        // 更新订单状态
        await db.run(`
            UPDATE orders 
            SET factory_delivery_date = ?, status = ?
            WHERE id IN (${orderIds.map(() => '?').join(',')})
        `, [factoryDeliveryDate, status, ...orderIds]);
        // 记录审计日志
        await auditLog(req, 'UPDATE', 'orders', orderIds, 'Orders updated');
        if (status === 'completed') {
            await db.run(`
                UPDATE orders 
                SET pickup_date = ?
                WHERE id IN (${orderIds.map(() => '?').join(',')})
            `, [today, ...orderIds]);
        }
        res.json({ success: true, message: 'Orders updated successfully' });
    } catch (error) {
        console.error('Error updating orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// 标记为已取货 / Mark as Picked Up
router.put('/:id/mark-picked-up', requireAuth, async (req, res) => {
    try {
        const today = new Date().toLocaleDateString('sv-SE');
        const orderId = req.params.id;

        // 更新订单状态为已取货
        await db.run(`
            UPDATE orders 
            SET status = 'completed', pickup_date = ?
            WHERE id = ?
        `, [today, orderId]);

        // 记录审计日志
        await auditLog(req, 'UPDATE', 'order', orderId, 'Order marked as picked up');

        res.json({ success: true, message: 'Order marked as picked up' });
    } catch (error) {
        console.error('Error marking order as picked up:', error);
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;