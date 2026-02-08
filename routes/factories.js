const express = require('express');
const router = express.Router();
const db = require('../database/db');
const SQLUtils = require('../database/sql_utils');
const { requireBoss, requireAuth, auditLog } = require('../middleware/auth');

// 所有工厂管理路由都需要老板权限
// All factory management routes require boss access

// 获取所有工厂
router.get('/', requireAuth, async (req, res) => {
    try {
        const factories = await db.all('SELECT * FROM factories ORDER BY is_default DESC, name');
        res.json(factories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取工厂完整信息
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const factory = await db.get('SELECT * FROM factories WHERE id = ?', [req.params.id]);
        if (!factory) {
            return res.status(404).json({ error: 'Factory not found' });
        }

        // 获取所有相关数据
        const [materials, colors, glassTypes, windowTypes, addons, combinationPricing, squareInchPricing, assemblyFees] = await Promise.all([
            db.all('SELECT * FROM materials WHERE factory_id = ? ORDER BY name_zh', [req.params.id]),
            db.all('SELECT * FROM colors WHERE factory_id = ? ORDER BY name_zh', [req.params.id]),
            db.all('SELECT * FROM glass_types WHERE factory_id = ? ORDER BY name_zh', [req.params.id]),
            db.all('SELECT * FROM window_types WHERE factory_id = ? ORDER BY name_zh', [req.params.id]),
            db.all('SELECT * FROM addon_pricing WHERE factory_id = ? ORDER BY display_order, name_zh', [req.params.id]),
            db.all('SELECT * FROM combination_pricing WHERE factory_id = ? ORDER BY min_perimeter', [req.params.id]),
            db.all('SELECT * FROM square_inch_pricing WHERE factory_id = ?', [req.params.id]),
            db.all('SELECT * FROM combination_window_assembly_fees WHERE factory_id = ? ORDER BY sub_window_count', [req.params.id])
        ]);

        res.json({
            ...factory,
            materials,
            colors,
            glassTypes,
            windowTypes,
            addons,
            combinationPricing,
            squareInchPricing,
            assemblyFees
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建新工厂
router.post('/', requireBoss, async (req, res) => {
    try {
        const { name, contact_person, phone, address, is_default, over_length_unit_price, max_perimeter, max_square_inch, min_price, pricing_method } = req.body;

        if (is_default) {
            await db.run('UPDATE factories SET is_default = 0');
        }

        const result = await db.run(
            'INSERT INTO factories (name, contact_person, phone, address, max_perimeter, max_square_inch, min_price, over_length_unit_price, pricing_method, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                name,
                contact_person,
                phone,
                address,
                max_perimeter || 500,
                max_square_inch || 5000,
                min_price || 0,
                over_length_unit_price || 0,
                pricing_method || 'combination',
                is_default ? 1 : 0
            ]
        );

        res.json({ id: result.id, message: 'Factory created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新工厂基本信息
router.put('/:id', requireBoss, async (req, res) => {
    try {
        const { name, contact_person, phone, address, is_default, max_perimeter, max_square_inch, min_price, over_length_unit_price, pricing_method } = req.body;

        if (is_default) {
            await db.run('UPDATE factories SET is_default = 0');
        }

        await db.run(
            'UPDATE factories SET name = ?, contact_person = ?, phone = ?, address = ?, max_perimeter = ?, max_square_inch = ?, min_price = ?, over_length_unit_price = ?, pricing_method = ?, is_default = ? WHERE id = ?',
            [
                name,
                contact_person,
                phone,
                address,
                max_perimeter || 500,
                max_square_inch || 5000,
                min_price || 0,
                over_length_unit_price || 0,
                pricing_method || 'combination',
                is_default ? 1 : 0,
                req.params.id
            ]
        );

        res.json({ message: 'Factory updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除工厂
router.delete('/:id', requireBoss, async (req, res) => {
    try {
        const orders = await db.get('SELECT COUNT(*) as count FROM orders WHERE factory_id = ?', [req.params.id]);
        if (orders.count > 0) {
            return res.status(400).json({ error: 'Cannot delete factory with existing orders' });
        }

        await db.run('DELETE FROM factories WHERE id = ?', [req.params.id]);
        res.json({ message: 'Factory deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== 材质管理 ==========
router.post('/:id/materials', requireBoss, async (req, res) => {
    try {
        const { materials } = req.body;
        const factoryId = req.params.id;

        console.log('Received materials update:', materials);

        // If materials array is undefined or not provided, don't delete anything
        if (!materials || !Array.isArray(materials)) {
            return res.json({ message: 'No materials data provided, skipping update' });
        }

        // Get existing IDs
        const existing = await db.all('SELECT id FROM materials WHERE factory_id = ?', [factoryId]);
        const existingIds = existing.map(e => e.id);

        // Get IDs from request (convert to integers for comparison)
        const requestIds = materials.map(m => m.id).filter(id => id).map(id => parseInt(id));

        console.log('Existing IDs:', existingIds);
        console.log('Request IDs:', requestIds);

        // Determine IDs to delete
        const toDelete = existingIds.filter(id => !requestIds.includes(id));

        console.log('IDs to delete:', toDelete);

        if (toDelete.length > 0) {
            await db.run(`DELETE FROM materials WHERE id IN (${toDelete.join(',')})`);
        }

        for (const mat of materials) {
            if (mat.id) {
                await db.run(
                    'UPDATE materials SET name_zh = ?, name_en = ? WHERE id = ? AND factory_id = ?',
                    [mat.name_zh, mat.name_en, mat.id, factoryId]
                );
            } else {
                await db.run(
                    'INSERT INTO materials (factory_id, name_zh, name_en) VALUES (?, ?, ?)',
                    [factoryId, mat.name_zh, mat.name_en]
                );
            }
        }

        res.json({ message: 'Materials updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== 颜色管理 ==========
router.post('/:id/colors', requireBoss, async (req, res) => {
    try {
        const { colors } = req.body;
        const factoryId = req.params.id;

        const existing = await db.all('SELECT id FROM colors WHERE factory_id = ?', [factoryId]);
        const existingIds = existing.map(e => e.id);
        const requestIds = colors.map(c => c.id).filter(id => id).map(id => parseInt(id));
        const toDelete = existingIds.filter(id => !requestIds.includes(id));

        if (toDelete.length > 0) {
            await db.run(`DELETE FROM colors WHERE id IN (${toDelete.join(',')})`);
        }

        for (const color of colors) {
            if (color.id) {
                await db.run(
                    'UPDATE colors SET name_zh = ?, name_en = ? WHERE id = ? AND factory_id = ?',
                    [color.name_zh, color.name_en, color.id, factoryId]
                );
            } else {
                await db.run(
                    'INSERT INTO colors (factory_id, name_zh, name_en) VALUES (?, ?, ?)',
                    [factoryId, color.name_zh, color.name_en]
                );
            }
        }

        res.json({ message: 'Colors updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== 玻璃类型管理 ==========
router.post('/:id/glass-types', requireBoss, async (req, res) => {
    try {
        const { glassTypes } = req.body;
        const factoryId = req.params.id;

        const existing = await db.all('SELECT id FROM glass_types WHERE factory_id = ?', [factoryId]);
        const existingIds = existing.map(e => e.id);
        const requestIds = glassTypes.map(g => g.id).filter(id => id).map(id => parseInt(id));
        const toDelete = existingIds.filter(id => !requestIds.includes(id));

        if (toDelete.length > 0) {
            await db.run(`DELETE FROM glass_types WHERE id IN (${toDelete.join(',')})`);
        }

        for (const glass of glassTypes) {
            if (glass.id) {
                await db.run(
                    'UPDATE glass_types SET name_zh = ?, name_en = ? WHERE id = ? AND factory_id = ?',
                    [glass.name_zh, glass.name_en, glass.id, factoryId]
                );
            } else {
                await db.run(
                    'INSERT INTO glass_types (factory_id, name_zh, name_en) VALUES (?, ?, ?)',
                    [factoryId, glass.name_zh, glass.name_en]
                );
            }
        }

        res.json({ message: 'Glass types updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== 窗户类型管理 ==========
router.post('/:id/window-types', requireBoss, async (req, res) => {
    try {
        const { windowTypes } = req.body;
        const factoryId = req.params.id;

        const existing = await db.all('SELECT id FROM window_types WHERE factory_id = ?', [factoryId]);
        const existingIds = existing.map(e => e.id);
        const requestIds = windowTypes.map(w => w.id).filter(id => id).map(id => parseInt(id));
        const toDelete = existingIds.filter(id => !requestIds.includes(id));

        if (toDelete.length > 0) {
            await db.run(`DELETE FROM window_types WHERE id IN (${toDelete.join(',')})`);
        }

        for (const type of windowTypes) {
            if (type.id) {
                await db.run(
                    'UPDATE window_types SET name_zh = ?, name_en = ? WHERE id = ? AND factory_id = ?',
                    [type.name_zh, type.name_en, type.id, factoryId]
                );
            } else {
                await db.run(
                    'INSERT INTO window_types (factory_id, name_zh, name_en) VALUES (?, ?, ?)',
                    [factoryId, type.name_zh, type.name_en]
                );
            }
        }

        res.json({ message: 'Window types updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ========== Addon管理 ==========
router.post('/:id/addons', requireBoss, async (req, res) => {
    try {
        const { addons } = req.body;
        const factoryId = req.params.id;

        const existing = await db.all('SELECT id FROM addon_pricing WHERE factory_id = ?', [factoryId]);
        const existingIds = existing.map(e => e.id);
        const requestIds = addons.map(a => a.id).filter(id => id).map(id => parseInt(id));
        const toDelete = existingIds.filter(id => !requestIds.includes(id));

        if (toDelete.length > 0) {
            await db.run(`DELETE FROM addon_pricing WHERE id IN (${toDelete.join(',')})`);
        }

        for (const addon of addons) {
            if (addon.id) {
                await db.run(
                    'UPDATE addon_pricing SET name_zh = ?, name_en = ?, pricing_type = ?, price = ?, display_order = ?, is_active = ? WHERE id = ? AND factory_id = ?',
                    [addon.name_zh, addon.name_en, addon.pricing_type, addon.price, addon.display_order || 0, addon.is_active !== false ? 1 : 0, addon.id, factoryId]
                );
            } else {
                await db.run(
                    'INSERT INTO addon_pricing (factory_id, name_zh, name_en, pricing_type, price, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [factoryId, addon.name_zh, addon.name_en, addon.pricing_type, addon.price, addon.display_order || 0, addon.is_active !== false ? 1 : 0]
                );
            }
        }

        res.json({ message: 'Addons updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== 组合定价管理 ==========
router.post('/:id/combination-pricing', requireBoss, async (req, res) => {
    try {
        const { combinations } = req.body;
        await db.run('DELETE FROM combination_pricing WHERE factory_id = ?', [req.params.id]);

        for (const combo of combinations) {
            await db.run(
                `INSERT INTO combination_pricing 
                (factory_id, material_id, color_id, glass_type_id, window_type_id, min_perimeter, max_perimeter, base_price) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.params.id, combo.material_id, combo.color_id, combo.glass_type_id, combo.window_type_id,
                combo.min_perimeter, combo.max_perimeter || null, combo.base_price]
            );
        }

        res.json({ message: 'Combination pricing updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== 组合窗组装费管理 / Combination Window Assembly Fees ==========
router.post('/:id/assembly-fees', requireBoss, async (req, res) => {
    try {
        const { assemblyFees } = req.body;
        const factoryId = req.params.id;

        console.log('Received assembly fees update:', assemblyFees);

        if (!assemblyFees || !Array.isArray(assemblyFees)) {
            return res.json({ message: 'No assembly fees data provided, skipping update' });
        }

        // Get existing counts
        const existing = await db.all('SELECT sub_window_count FROM combination_window_assembly_fees WHERE factory_id = ?', [factoryId]);
        const existingCounts = existing.map(e => e.sub_window_count);

        // Get counts from request
        const requestCounts = assemblyFees.map(f => f.sub_window_count).filter(count => count);

        // Determine counts to delete
        const toDelete = existingCounts.filter(count => !requestCounts.includes(count));

        if (toDelete.length > 0) {
            await db.run(`DELETE FROM combination_window_assembly_fees WHERE factory_id = ? AND sub_window_count IN (${toDelete.join(',')})`, [factoryId]);
        }

        // Upsert assembly fees
        for (const fee of assemblyFees) {
            if (!fee.sub_window_count || fee.assembly_fee === undefined) continue;

            await db.run(
                `INSERT INTO combination_window_assembly_fees (factory_id, sub_window_count, assembly_fee)
                 VALUES (?, ?, ?)
                 ON CONFLICT(factory_id, sub_window_count) 
                 DO UPDATE SET assembly_fee = excluded.assembly_fee`,
                [factoryId, fee.sub_window_count, fee.assembly_fee]
            );
        }

        res.json({ message: 'Assembly fees updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== 面积定价管理 / Square Inch Pricing ==========
router.post('/:id/square-inch-pricing', requireBoss, async (req, res) => {
    try {
        const { squareInchRules } = req.body;
        await db.run('DELETE FROM square_inch_pricing WHERE factory_id = ?', [req.params.id]);

        for (const rule of squareInchRules) {
            await db.run(
                `INSERT INTO square_inch_pricing 
                (factory_id, material_id, color_id, glass_type_id, window_type_id, price_per_sq_inch) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [req.params.id, rule.material_id, rule.color_id, rule.glass_type_id, rule.window_type_id,
                rule.price_per_sq_inch]
            );
        }

        res.json({ message: 'Square inch pricing updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
