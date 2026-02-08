const express = require('express');
const router = express.Router();
const db = require('../database/db');
const SQLUtils = require('../database/sql_utils');
const { requireBoss, auditLog } = require('../middleware/auth');

// GET /api/product-templates - 获取所有产品模板
router.get('/', async (req, res) => {
    try {
        const templates = await SQLUtils.findAll('product_templates', { is_active: 1 }, 'category, product_name');
        res.json(templates || []);
    } catch (error) {
        console.error('Error fetching product templates:', error);
        res.status(500).json({ error: 'Failed to fetch product templates' });
    }
});

// GET /api/product-templates/categories - 获取所有分类
router.get('/categories', async (req, res) => {
    try {
        const categories = await db.all(
            `SELECT DISTINCT category as category
             FROM product_templates 
             WHERE is_active = 1 AND category IS NOT NULL 
             ORDER BY category`
        );

        res.json((categories || []).map(row => row.category));
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// GET /api/product-templates/by-name/:name - 获取特定产品名称的所有模板
router.get('/by-name/:name', async (req, res) => {
    try {
        const templates = await SQLUtils.findAll('product_templates', {
            product_name: req.params.name,
            is_active: 1
        }, 'category');

        res.json(templates || []);
    } catch (error) {
        console.error('Error fetching templates by name:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

// GET /api/product-templates/product-names - 获取所有产品名称（去重）
router.get('/product-names', async (req, res) => {
    try {
        const names = await db.all(
            `SELECT DISTINCT product_name as product_name
             FROM product_templates 
             WHERE is_active = 1 
             ORDER BY product_name`
        );

        res.json((names || []).map(row => row.product_name));
    } catch (error) {
        console.error('Error fetching product names:', error);
        res.status(500).json({ error: 'Failed to fetch product names' });
    }
});

// POST /api/product-templates - 创建新模板（仅老板）
router.post('/', requireBoss, auditLog('CREATE', 'product_template'), async (req, res) => {
    const { product_name, category, default_unit } = req.body;

    if (!product_name || !category) {
        return res.status(400).json({ error: 'Product name and category are required' });
    }

    try {
        const result = await SQLUtils.insert('product_templates', {
            product_name: product_name,
            category: category,
            default_unit: default_unit || 'piece',
        });

        res.json({
            message: 'Product template created successfully',
            id: result.id
        });
    } catch (error) {
        console.error('Error creating product template:', error);
        if (error.message.includes('UNIQUE constraint')) {
            res.status(400).json({ error: 'This product/category combination already exists' });
        } else {
            res.status(500).json({ error: 'Failed to create product template' });
        }
    }
});

// PUT /api/product-templates/:id - 更新模板（仅老板）
router.put('/:id', requireBoss, auditLog('UPDATE', 'product_template'), async (req, res) => {
    const { product_name, category, default_unit, is_active } = req.body;

    if (!product_name || !category) {
        return res.status(400).json({ error: 'Product name and category are required' });
    }

    try {
        const data = {
            product_name: product_name,
            category: category,
            default_unit: default_unit || 'piece',
            updated_at: new Date().toISOString()
        };

        if (is_active !== undefined) data.is_active = is_active;

        const result = await SQLUtils.update('product_templates', data, { id: req.params.id });

        if (result.changes === 0) {
            throw new Error('Template not found');
        }

        res.json({ message: 'Product template updated successfully' });
    } catch (error) {
        console.error('Error updating product template:', error);
        if (error.message === 'Template not found') {
            res.status(404).json({ error: 'Template not found' });
        } else if (error.message.includes('UNIQUE constraint')) {
            res.status(400).json({ error: 'This product/category combination already exists' });
        } else {
            res.status(500).json({ error: 'Failed to update product template' });
        }
    }
});

// DELETE /api/product-templates/:id - 删除模板（仅老板）
router.delete('/:id', requireBoss, auditLog('DELETE', 'product_template'), async (req, res) => {
    try {
        // 检查是否有产品使用此模板
        const productsCount = await SQLUtils.count('standard_products', { template_id: req.params.id });

        if (productsCount > 0) {
            return res.status(400).json({
                error: `Cannot delete template: ${productsCount} product(s) are using this template`
            });
        }

        const result = await SQLUtils.delete('product_templates', { id: req.params.id });

        if (result.changes === 0) {
            throw new Error('Template not found');
        }

        res.json({ message: 'Product template deleted successfully' });
    } catch (error) {
        console.error('Error deleting product template:', error);
        if (error.message === 'Template not found') {
            res.status(404).json({ error: 'Template not found' });
        } else {
            res.status(500).json({ error: 'Failed to delete product template' });
        }
    }
});

module.exports = router;
