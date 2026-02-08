const express = require('express');
const router = express.Router();
const db = require('../database/db');
const SQLUtils = require('../database/sql_utils');
const { requireAuth, requireBoss, optionalAuth, auditLog } = require('../middleware/auth');

// ==================== 产品管理 ====================

// 获取所有产品
router.get('/', optionalAuth, async (req, res) => {
    try {
        const { category, is_active } = req.query;
        const where = {};

        if (category) where.category = category;
        if (is_active !== undefined) where.is_active = parseInt(is_active);

        const products = await SQLUtils.findAll('v_standard_products', where, 'category, name');
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取低库存产品（库存预警）
router.get('/low-stock', requireBoss, async (req, res) => {
    try {
        const products = await db.all(`
            SELECT * FROM v_standard_products 
            WHERE current_stock <= min_stock_alert 
              AND is_active = 1
            ORDER BY current_stock ASC
        `);
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取产品分类列表
router.get('/categories', optionalAuth, async (req, res) => {
    try {
        const categories = await db.all(`
            SELECT DISTINCT category 
            FROM v_standard_products 
            WHERE category IS NOT NULL AND category != ''
            ORDER BY category
        `);
        res.json(categories.map(c => c.category));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取单个产品详情
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const product = await SQLUtils.findN('v_standard_products', { id: req.params.id });

        if (!product) {
            return res.status(404).json({ error: 'Product not found / 产品未找到' });
        }

        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建新产品（仅老板）
router.post('/', requireBoss, auditLog('CREATE', 'standard_product'), async (req, res) => {
    try {
        const { name, category, unit, selling_price, min_stock_alert, notes } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Product name is required / 产品名称必填' });
        }

        // 1. 查找或创建模板
        // 注意：这里简化处理，假设前端传来的 name 是中文名。实际应支持双语。
        let template = await SQLUtils.findN('product_templates', { product_name: name });

        if (!template) {
            // 如果模板不存在，创建新模板
            const templateResult = await SQLUtils.insert('product_templates', {
                product_name: name,
                category: category,
                default_unit: unit || 'piece',
            });
            template = { id: templateResult.id };
        }

        // 2. 创建产品
        const result = await SQLUtils.insert('standard_products', {
            template_id: template.id,
            selling_price: selling_price || 0,
            min_stock_alert: min_stock_alert || 10,
            notes: notes
        });

        const product = await SQLUtils.findN('v_standard_products', { id: result.id });
        res.status(201).json(product);
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Product already exists for this template / 该模板已存在产品' });
        }
        res.status(500).json({ error: error.message });
    }
});

// 更新产品信息（仅老板）
router.put('/:id', requireBoss, auditLog('UPDATE', 'standard_product'), async (req, res) => {
    try {
        const { selling_price, min_stock_alert, notes, is_active } = req.body;

        // 注意：我们只更新 standard_products 表的字段，不更新模板信息
        // 如果需要更新名称/类别，应该去更新模板（但这里为了简化，暂不支持通过产品接口更新模板）

        const result = await SQLUtils.update('standard_products', {
            selling_price,
            min_stock_alert,
            notes,
            is_active,
            updated_at: new Date().toISOString()
        }, { id: req.params.id });

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Product not found / 产品未找到' });
        }

        const product = await SQLUtils.findN('v_standard_products', { id: req.params.id });
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除/禁用产品（仅老板）
router.delete('/:id', requireBoss, auditLog('DELETE', 'standard_product'), async (req, res) => {
    try {
        // 检查是否有关联的订单项
        const orderItemsCount = await SQLUtils.count('order_standard_items', { product_id: req.params.id });

        if (orderItemsCount > 0) {
            // 如果有订单使用，只禁用不删除
            await SQLUtils.update('standard_products', { is_active: 0 }, { id: req.params.id });
            return res.json({ message: 'Product disabled (has order history) / 产品已禁用（存在订单历史）' });
        }

        // 没有订单历史，可以删除
        const result = await SQLUtils.delete('standard_products', { id: req.params.id });

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Product not found / 产品未找到' });
        }

        res.json({ message: 'Product deleted successfully / 产品已删除' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== 采购管理 ====================

// 记录新采购（仅老板）
router.post('/:id/purchases', requireBoss, auditLog('CREATE', 'product_purchase'), async (req, res) => {
    try {
        const { quantity, unit_price, supplier, notes, purchase_date } = req.body;
        const product_id = req.params.id;

        if (!quantity || quantity <= 0) return res.status(400).json({ error: 'Invalid quantity / 数量无效' });
        if (!unit_price || unit_price < 0) return res.status(400).json({ error: 'Invalid unit price / 单价无效' });

        const product = await SQLUtils.findN('standard_products', { id: product_id });
        if (!product) return res.status(404).json({ error: 'Product not found / 产品未找到' });

        const total_cost = quantity * unit_price;
        const old_stock = product.current_stock;
        const old_avg_price = product.avg_purchase_price;
        const new_stock = old_stock + quantity;
        const new_avg_price = ((old_avg_price * old_stock) + total_cost) / new_stock;

        await db.beginTransaction();

        try {
            const purchaseResult = await SQLUtils.insert('product_purchases', {
                product_id,
                purchase_date: purchase_date || new Date().toISOString().split('T')[0],
                quantity,
                unit_price,
                total_cost,
                supplier,
                notes,
                created_by: req.session.userId
            });

            await SQLUtils.update('standard_products', {
                current_stock: new_stock,
                avg_purchase_price: new_avg_price,
                updated_at: new Date().toISOString()
            }, { id: product_id });

            await db.commit();

            const purchase = await SQLUtils.findN('product_purchases', { id: purchaseResult.id });
            res.status(201).json(purchase);
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取产品的采购历史（仅老板）
router.get('/:id/purchases', requireBoss, async (req, res) => {
    try {
        const purchases = await db.all(`
            SELECT pp.*, a.username as created_by_name
            FROM product_purchases pp
            LEFT JOIN admins a ON pp.created_by = a.id
            WHERE pp.product_id = ?
            ORDER BY pp.purchase_date DESC, pp.created_at DESC
        `, [req.params.id]);

        res.json(purchases);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取所有采购记录（仅老板）
router.get('/purchases/all', requireBoss, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        let query = `
            SELECT pp.*, pt.product_name as product_name, pt.category as category, a.username as created_by_name
            FROM product_purchases pp
            JOIN standard_products sp ON pp.product_id = sp.id
            JOIN product_templates pt ON sp.template_id = pt.id
            LEFT JOIN admins a ON pp.created_by = a.id
            WHERE 1=1
        `;
        const params = [];

        if (start_date) {
            query += ' AND pp.purchase_date >= ?';
            params.push(start_date);
        }

        if (end_date) {
            query += ' AND pp.purchase_date <= ?';
            params.push(end_date);
        }

        query += ' ORDER BY pp.purchase_date DESC, pp.created_at DESC';

        const purchases = await db.all(query, params);
        res.json(purchases);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除采购记录（仅老板）
router.delete('/:productId/purchases/:purchaseId', requireBoss, auditLog('DELETE', 'product_purchase'), async (req, res) => {
    try {
        const { productId, purchaseId } = req.params;

        const purchase = await SQLUtils.findN('product_purchases', { id: purchaseId, product_id: productId });
        if (!purchase) return res.status(404).json({ error: 'Purchase record not found / 采购记录未找到' });

        const product = await SQLUtils.findN('standard_products', { id: productId });
        if (!product) return res.status(404).json({ error: 'Product not found / 产品未找到' });

        if (product.current_stock < purchase.quantity) {
            return res.status(400).json({ error: 'Insufficient stock to reverse this purchase / 库存不足，无法删除此采购记录' });
        }

        const old_stock = product.current_stock;
        const old_avg_price = product.avg_purchase_price;
        const new_stock = old_stock - purchase.quantity;

        let new_avg_price = old_avg_price;
        if (new_stock > 0) {
            const total_value = old_avg_price * old_stock;
            const purchase_value = purchase.total_cost;
            new_avg_price = (total_value - purchase_value) / new_stock;
        } else {
            new_avg_price = 0;
        }

        await db.beginTransaction();

        try {
            await SQLUtils.delete('product_purchases', { id: purchaseId });

            await SQLUtils.update('standard_products', {
                current_stock: new_stock,
                avg_purchase_price: new_avg_price,
                updated_at: new Date().toISOString()
            }, { id: productId });

            await db.commit();

            res.json({ message: 'Purchase record deleted successfully / 采购记录已删除' });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
