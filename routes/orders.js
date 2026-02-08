const express = require('express');
const router = express.Router();
const db = require('../database/db');
const SQLUtils = require('../database/sql_utils');
const { requireAuth, optionalAuth, auditLog } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// 确保orders目录存在
const ORDERS_DIR = path.join(__dirname, '../orders');
if (!fs.existsSync(ORDERS_DIR)) {
    fs.mkdirSync(ORDERS_DIR, { recursive: true });
}
// 确保uploads目录存在
const UPLOADS_DIR = path.join(ORDERS_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
// 确保invoices目录存在
const INVOICES_DIR = path.join(ORDERS_DIR, 'invoices');
if (!fs.existsSync(INVOICES_DIR)) {
    fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

// 获取所有订单（可选登录）
router.get('/', requireAuth, async (req, res) => {
    try {
        const { status, customer_id } = req.query;
        let sql = `
            SELECT o.*, c.name as customer_name, c.phone as customer_phone,
                   f.name as factory_name,
                   COALESCE(SUM(p.amount), 0) as paid_amount
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            JOIN factories f ON o.factory_id = f.id
            LEFT JOIN order_payments p ON o.id = p.order_id
        `;

        const conditions = [];
        const params = [];

        if (status) {
            conditions.push('o.status = ?');
            params.push(status);
        }

        if (customer_id) {
            conditions.push('o.customer_id = ?');
            params.push(customer_id);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' GROUP BY o.id ORDER BY o.order_date DESC';

        const orders = await db.all(sql, params);

        orders.forEach(order => {
            order.remaining_amount = order.total_amount - order.paid_amount;
        });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// 获取订单详情（可选登录）
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const orderData = await getOrderById(req.params.id);
        if (!orderData) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(orderData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function getOrderById(id) {
    const order = await db.get(`
            SELECT o.*, c.name as customer_name, c.phone as customer_phone, 
                   c.address as customer_address, o.delivery_type as delivery_type, 
                   o.delivery_address as delivery_address, o.is_tax_free, f.name as factory_name, o.status as status,
                   f.pricing_method
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            JOIN factories f ON o.factory_id = f.id
            WHERE o.id = ?
        `, [id]);

    if (!order) {
        return null;
    }

    // 获取窗户信息 (使用新视图)
    // Group by window to handle structure: Window -> [SubWindows]
    const windowsRows = await db.all(`
            SELECT 
                w.id AS window_id, w.order_id, w.window_number, w.item_type, w.quantity, 
                w.total_price, w.assembly_fee, w.notes AS window_notes, w.total_width, w.total_height,
                sw.id AS sub_window_id, sw.width_inches, sw.height_inches, sw.perimeter_inches,
                sw.material_id, sw.color_id, sw.glass_type_id, sw.window_type_id, sw.price AS sub_window_price,
                m.name_zh AS material_name_zh, m.name_en AS material_name_en,
                c.name_zh AS color_name_zh, c.name_en AS color_name_en,
                g.name_zh AS glass_name_zh, g.name_en AS glass_name_en,
                wt.name_zh AS window_type_name_zh, wt.name_en AS window_type_name_en
            FROM windows w
            LEFT JOIN sub_windows sw ON w.id = sw.parent_window_id
            LEFT JOIN materials m ON sw.material_id = m.id
            LEFT JOIN colors c ON sw.color_id = c.id
            LEFT JOIN glass_types g ON sw.glass_type_id = g.id
            LEFT JOIN window_types wt ON sw.window_type_id = wt.id
            WHERE w.order_id = ?
            ORDER BY w.window_number, sw.id
        `, [id]);

    // Transform flat rows into structured object
    const windowsMap = new Map();

    for (const row of windowsRows) {
        if (!windowsMap.has(row.window_id)) {
            windowsMap.set(row.window_id, {
                id: row.window_id,
                window_number: row.window_number,
                item_type: row.item_type,
                quantity: row.quantity,
                total_price: row.total_price,
                assembly_fee: row.assembly_fee,
                notes: row.window_notes,
                sub_windows: []
            });
        }

        const window = windowsMap.get(row.window_id);

        // Add sub-window details
        if (row.sub_window_id) {
            // Fetch addons for this sub-window
            const addons = await db.all(`
                    SELECT swa.*, ap.name_zh, ap.name_en, ap.pricing_type
                    FROM sub_window_addons swa
                    JOIN addon_pricing ap ON swa.addon_pricing_id = ap.id
                    WHERE swa.sub_window_id = ?
                `, [row.sub_window_id]);

            window.sub_windows.push({
                id: row.sub_window_id,
                width_inches: row.width_inches,
                height_inches: row.height_inches,
                price: row.sub_window_price,
                material_name_zh: row.material_name_zh,
                material_name_en: row.material_name_en,
                color_name_zh: row.color_name_zh,
                color_name_en: row.color_name_en,
                glass_name_zh: row.glass_name_zh,
                glass_name_en: row.glass_name_en,
                window_type_name_zh: row.window_type_name_zh,
                window_type_name_en: row.window_type_name_en,
                addons: addons // Attach addons
            });
        }
    }

    const windows = Array.from(windowsMap.values());

    // 获取标准产品项目
    const standard_items = await db.all(`
            SELECT osi.*, pt.product_name, pt.category, pt.default_unit
            FROM order_standard_items osi
            JOIN standard_products sp ON osi.product_id = sp.id
            JOIN product_templates pt ON sp.template_id = pt.id
            WHERE osi.order_id = ?
        `, [id]);

    // 获取支付记录
    const payments = await db.all(
        'SELECT * FROM order_payments WHERE order_id = ? ORDER BY payment_date DESC',
        [id]
    );

    const paid_amount = payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining_amount = order.total_amount - paid_amount;
    const deposit_required = order.deposit_required || 0;

    return {
        ...order,
        windows,
        standard_items,
        payments,
        paid_amount,
        remaining_amount,
        deposit_required
    };
}

// 创建订单（新定价逻辑 & 新数据库结构）
router.post('/', requireAuth, auditLog('CREATE', 'order'), async (req, res) => {
    try {
        let {
            customer_id, factory_id, notes, items, standard_items,
            customer_name, customer_phone, customer_address, customer_type,
            discount_amount = 0, tax_rate = 0, is_tax_free = false,
            factory_delivery_date, delivery_type, delivery_address, pickup_date, deposit_required = 0,
            subtotal, tax_amount, total_amount
        } = req.body;

        console.log('POST /orders body:', req.body);

        if (!factory_id) {
            return res.status(400).json({ error: 'Missing factory_id' });
        }

        // Ensure at least one item type is present
        if ((!items || items.length === 0) && (!standard_items || standard_items.length === 0)) {
            return res.status(400).json({ error: 'Order must contain at least one window or standard product' });
        }

        // Handle new customer creation if needed
        let final_customer_id = customer_id;
        if (customer_type === 'new') {
            if (!customer_name || !customer_phone) {
                return res.status(400).json({ error: 'Missing new customer info' });
            }
            // Check if customer exists
            const existing = await db.get('SELECT id FROM customers WHERE phone = ?', [customer_phone]);
            if (existing) {
                final_customer_id = existing.id;
            } else {
                const result = await db.run(
                    'INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)',
                    [customer_name, customer_phone, customer_address]
                );
                final_customer_id = result.id;
            }
        } else {
            if (!final_customer_id) {
                return res.status(400).json({ error: 'Missing customer_id' });
            }
        }

        await db.run('BEGIN TRANSACTION');

        try {
            const orderNumber = 'PO-' + new Date()
                .toLocaleString('sv-SE')   // 格式：YYYY-MM-DD HH:mm:ss
                .replace(/[- :]/g, '')    // 去掉 - 空格 :
                .slice(2);

            // 1. Create Order Record (Initial)
            const result = await db.run(`
                INSERT INTO orders (
                    order_number, customer_id, factory_id, order_date, 
                    factory_delivery_date, delivery_type, delivery_address, 
                    notes, status,
                    subtotal, discount_amount, 
                    is_tax_free, tax_rate, tax_amount, total_amount, deposit_required
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                orderNumber, final_customer_id, factory_id,
                new Date().toLocaleDateString('sv-SE'),
                factory_delivery_date || null,
                delivery_type || 'pickup',
                delivery_address || null,
                notes,
                'pending',
                subtotal || 0,
                discount_amount || 0,
                is_tax_free ? 1 : 0,
                tax_rate || 0,
                tax_amount || 0,
                total_amount || 0,
                deposit_required || 0
            ]);

            const order_id = result.id;

            // Get addons for pricing
            const addons = await db.all(
                'SELECT * FROM addon_pricing WHERE factory_id = ? AND is_active = 1',
                [factory_id]
            );
            if (items && items.length > 0) {
                for (let i = 0; i < items.length; i++) {
                    const win = items[i];
                    const quantity = win.quantity || 1;

                    // Determine item type
                    const itemType = win.sub_windows && win.sub_windows.length > 1 ? 'combination' : 'single_window';

                    // Insert Window Container
                    const windowResult = await db.run(`
                        INSERT INTO windows (
                            order_id, window_number, item_type, quantity, total_price, assembly_fee, notes, total_width, total_height
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [order_id, i + 1, itemType, quantity, win.total_price, win.assembly_fee, win.notes, win.total_width, win.total_height]);

                    const parentWindowId = windowResult.id;

                    // Process Sub-windows

                    for (const sub of win.sub_windows) {

                        // Insert Sub-window first to get ID
                        const subWindowResult = await db.run(`
                            INSERT INTO sub_windows (
                                parent_window_id, width_inches, height_inches,
                                material_id, color_id, glass_type_id, window_type_id,
                                price
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            parentWindowId, sub.width_inches, sub.height_inches,
                            sub.material_id, sub.color_id, sub.glass_type_id, sub.window_type_id,
                            sub.unit_price
                        ]);

                        const subWindowId = subWindowResult.id;

                        // Addons Calculation (applied to sub-window)
                        if (sub.addons && sub.addons.length > 0) {
                            for (const addonSelection of sub.addons) {
                                const addon = addons.find(a => a.id === addonSelection.addon_id);
                                if (!addon) continue;

                                let addon_cost = 0;
                                const perimeter = (parseFloat(sub.width_inches) + parseFloat(sub.height_inches)) * 2;
                                const area_sq_inch = parseFloat(sub.width_inches) * parseFloat(sub.height_inches);
                                const area_sq_ft = area_sq_inch / 144;

                                if (addon.pricing_type === 'fixed') {
                                    addon_cost = addon.price;
                                } else if (addon.pricing_type === 'per_quantity') {
                                    addon_cost = addon.price * (addonSelection.quantity || 1);
                                } else if (addon.pricing_type === 'per_inch') {
                                    addon_cost = addon.price * perimeter;
                                } else if (addon.pricing_type === 'per_sq_ft') {
                                    addon_cost = addon.price * area_sq_ft;
                                } else if (addon.pricing_type === 'per_sq_inch') {
                                    addon_cost = addon.price * area_sq_inch;
                                }

                                // Insert into sub_window_addons
                                await db.run(`
                                    INSERT INTO sub_window_addons (
                                        sub_window_id, addon_pricing_id, quantity, price
                                    ) VALUES (?, ?, ?, ?)
                                `, [
                                    subWindowId, addon.id, addonSelection.quantity || 1, addon_cost
                                ]);
                            }
                        }

                    }
                }
            }

            // 3. Process Standard Products (if any)
            if (standard_items && standard_items.length > 0) {
                for (const item of standard_items) {
                    const product = await db.get(
                        'SELECT * FROM standard_products WHERE id = ? AND is_active = 1',
                        [item.product_id]
                    );

                    if (!product) {
                        throw new Error(`Product ID ${item.product_id} not found or inactive`);
                    }

                    const quantity = parseInt(item.quantity) || 0;
                    if (quantity <= 0) throw new Error(`Invalid quantity for product ${product.id}`);

                    if (product.current_stock < quantity) {
                        throw new Error(`Insufficient stock for product ID ${product.id}. Available: ${product.current_stock}`);
                    }

                    const unit_price = product.selling_price;
                    const total_price = unit_price * quantity;

                    // Insert Order Standard Item
                    await db.run(`
                        INSERT INTO order_standard_items 
                        (order_id, product_id, quantity, unit_price, total_price, notes)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [order_id, item.product_id, quantity, unit_price, total_price, item.notes]);

                    // Update Stock
                    await db.run(`
                        UPDATE standard_products 
                        SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [quantity, item.product_id]);

                    subtotal += total_price;
                }
            }

            await db.run('COMMIT');

            res.json({ message: 'Order created successfully', order_id });
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 添加支付记录
router.post('/:id/payments', requireAuth, auditLog('CREATE', 'payment'), async (req, res) => {
    try {
        const { payment_date, amount, payment_method, notes } = req.body;

        await db.run('BEGIN TRANSACTION');
        try {
            await db.run(`
                INSERT INTO order_payments (order_id, payment_date, amount, payment_method, notes)
                VALUES (?, ?, ?, ?, ?)
            `, [req.params.id, payment_date, amount, payment_method, notes]);

            // 如果有收费，status = customer_confirmed
            await db.run(
                'UPDATE orders SET status = ? WHERE id = ? AND status = ?',
                ['customer_confirmed', req.params.id, 'pending']
            );

            await db.run('COMMIT');
            res.json({ message: 'Payment added successfully and status updated if pending' });
        } catch (innerError) {
            await db.run('ROLLBACK');
            throw innerError;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新订单详情
router.put('/:id', requireAuth, auditLog('UPDATE', 'order'), async (req, res) => {
    try {
        const { status, delivery_type, delivery_address, factory_delivery_date, notes } = req.body;
        const updates = [];
        const params = [];

        const validStatuses = [
            'pending', 'factory_quote_pending', 'factory_quote_received', 'factory_confirmed',
            'customer_quote_sent', 'customer_confirmed', 'in_production', 'in_transit',
            'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled'
        ];

        if (status) {
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }
            updates.push('status = ?');
            params.push(status);
            if (status === 'completed') {
                updates.push('pickup_date = ?');
                params.push(new Date().toLocaleDateString('sv-SE'));
            }
        }
        if (delivery_type) {
            updates.push('delivery_type = ?');
            params.push(delivery_type);
        }
        if (delivery_address !== undefined) {
            updates.push('delivery_address = ?');
            params.push(delivery_address);
        }
        if (factory_delivery_date !== undefined) {
            updates.push('factory_delivery_date = ?');
            params.push(factory_delivery_date);
        }
        if (notes !== undefined) {
            updates.push('notes = ?');
            params.push(notes);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(req.params.id);
        await db.run(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, params);
        res.json({ success: true, message: 'Order updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新订单状态
router.patch('/:id/status', requireAuth, auditLog('UPDATE', 'order'), async (req, res) => {
    try {
        const { status } = req.body;

        const validStatuses = [
            'pending', 'factory_quote_pending', 'factory_quote_received', 'factory_confirmed',
            'customer_quote_sent', 'customer_confirmed', 'in_production', 'in_transit',
            'ready_for_pickup', 'out_for_delivery', 'completed', 'cancelled'
        ];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const updates = ['status = ?'];
        const params = [status];

        // Update timestamp based on status
        if (status === 'completed') {
            updates.push('completed_at = CURRENT_TIMESTAMP');
        } else if (status === 'picked_up') { // Legacy support or if we add picked_up status back
            updates.push('pickup_date = CURRENT_DATE');
        }

        // Add ID to params
        params.push(req.params.id);

        await db.run(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, params);

        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 生成PDF发票（简化版）
router.get('/:id/invoice', requireAuth, async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await getOrderById(orderId);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const windows = order.windows;
        const standard_items = order.standard_items;
        const payments = order.payments;

        const doc = new PDFDocument({ margin: 40, bufferPages: true }); // Enable bufferPages for footer numbering
        const filename = `invoice-${order.order_number}.pdf`;
        const filepath = path.join(INVOICES_DIR, filename);

        // Font setup for Chinese support (macOS paths)
        const fontPaths = [
            '/System/Library/Fonts/Supplemental/Songti.ttc',
            '/Library/Fonts/Arial Unicode.ttf',
            '/System/Library/Fonts/STHeiti Light.ttc',
            '/System/Library/Fonts/PingFang.ttc',
        ];

        let fontLoaded = false;
        for (const fPath of fontPaths) {
            if (fs.existsSync(fPath)) {
                try {
                    doc.font(fPath);
                    fontLoaded = true;
                    break;
                } catch (e) {
                    console.error(`Failed to load font ${fPath}:`, e.message);
                }
            }
        }

        // --- PDF Helper Functions ---
        const drawHeader = (d) => {
            const currentY = d.y;
            d.fontSize(10).text('Company Name 公司名称', 40, currentY);
            d.fontSize(10).text('Address 地址', 40, currentY + 10);
            d.fontSize(10).text('Phone 电话', 40, currentY + 20);
            d.fontSize(10).text('Email 邮箱', 40, currentY + 30);
            d.moveDown(0.2);
        };

        // Handle page headers automatically (except first page which we draw manually after setup)
        doc.on('pageAdded', () => {
            drawHeader(doc);
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        doc.pipe(fs.createWriteStream(filepath));
        doc.pipe(res);

        // Start Content
        drawHeader(doc);

        // --- SECTION 1: ORDER & CUSTOMER INFO ---
        const infoStartY = doc.y;
        doc.fontSize(10);
        // Column 1: Order Info
        doc.text(`Order Number / 订单号: ${order.order_number}`, 50, infoStartY + 20);
        doc.text(`Order Date / 下单日期: ${order.order_date}`);
        doc.text(`Delivery / 交付方式: ${{ 'pickup': '自取 (Pickup)', 'store_delivery': '门店送货 (Store Delivery)', 'factory_delivery': '工厂直发 (Factory Direct)' }[order.delivery_type] || order.delivery_type}`);

        // Column 2: Customer Info
        const col2X = 350;
        doc.text(`Customer / 客户姓名: ${order.customer_name}`, col2X, infoStartY + 20);
        doc.text(`Phone / 电话: ${order.customer_phone || 'N/A'}`, col2X);
        doc.text(`Address / 地址: ${order.delivery_address || order.customer_address || 'N/A'}`, col2X, doc.y, { width: 250 });

        if (order.notes) {
            doc.moveDown(0.5);
            doc.fontSize(9).fillColor('#666').text(`Notes / 备注: ${order.notes}`, 50);
            doc.fillColor('black');
        }

        doc.moveDown(2);

        // --- SECTION 2: PRODUCT DETAILS ---
        // Table Constants
        const tableTop = doc.y;
        const colWidths = { no: 30, size: 130, desc: 190, qty: 35, price: 65, total: 75 };
        const colX = {
            no: 40,
            size: 40 + colWidths.no,
            desc: 40 + colWidths.no + colWidths.size,
            qty: 40 + colWidths.no + colWidths.size + colWidths.desc,
            price: 40 + colWidths.no + colWidths.size + colWidths.desc + colWidths.qty,
            total: 40 + colWidths.no + colWidths.size + colWidths.desc + colWidths.qty + colWidths.price
        };

        const drawRow = (d, y, item, isHeader = false) => {
            const fontUsed = isHeader ? 10 : 9;
            d.fontSize(fontUsed);
            if (isHeader) d.fillColor('black');

            d.text(item.no || '', colX.no, y, { width: colWidths.no });
            d.text(item.size || '', colX.size, y, { width: colWidths.size });
            d.text(item.desc || '', colX.desc, y, { width: colWidths.desc });
            d.text(item.qty || '', colX.qty, y, { width: colWidths.qty, align: 'center' });
            d.text(item.price || '', colX.price, y, { width: colWidths.price, align: 'right' });
            d.text(item.total || '', colX.total, y, { width: colWidths.total, align: 'right' });
        };

        // Draw Table Header
        drawRow(doc, tableTop + 5, {
            no: '#',
            size: 'W 宽 x H 高 (Inches)',
            desc: 'Description / 描述',
            qty: 'Qty',
            price: 'Unit Price',
            total: 'Total'
        }, true);
        doc.fillColor('black').moveDown(1.5);
        doc.lineTo(565, doc.y).lineWidth(0.5).stroke('#eee');

        let rowCount = 1;

        // Windows Items
        if (windows.length > 0) {
            for (let win of windows) {
                if (win.sub_windows.length > 1) {
                    // --- Combination Window Case ---
                    if (doc.y > 650) doc.addPage();

                    const totalWidth = win.sub_windows.reduce((sum, s) => sum + (s.width_inches || 0), 0);
                    const maxHeight = Math.max(...win.sub_windows.map(s => s.height_inches || 0));

                    // 1. Draw Summary Row
                    const summaryY = doc.y;
                    drawRow(doc, summaryY, {
                        no: `${win.window_number}`,
                        size: `Total: ${totalWidth.toFixed(2)}" x ${maxHeight.toFixed(2)}"`,
                        desc: `${win.sub_windows.length} windows (组合窗)`,
                        qty: win.quantity.toString(),
                        price: `$${(win.total_price / win.quantity).toFixed(2)}`,
                        total: `$${win.total_price.toFixed(2)}`
                    });
                    doc.moveDown(2.5);

                    // 2. Draw Sub-window Details
                    for (let sub of win.sub_windows) {
                        if (doc.y > 720) doc.addPage();

                        const f = (zh, en) => (zh && en) ? `${zh} (${en})` : (zh || en || 'N/A');
                        const detailDesc = `${f(sub.material_name_zh, sub.material_name_en)}\n${f(sub.color_name_zh, sub.color_name_en)}\n${f(sub.glass_name_zh, sub.glass_name_en)}\n${f(sub.window_type_name_zh, sub.window_type_name_en)}`;
                        const addonsText = sub.addons && sub.addons.length > 0
                            ? "Add-ons: " + sub.addons.map(a => `${a.name_zh}(x${a.quantity})`).join(', ')
                            : '';

                        const detailY = doc.y;
                        drawRow(doc, detailY, {
                            size: `  ${sub.width_inches}" x ${sub.height_inches}"`,
                            desc: detailDesc + (addonsText ? '\n' + addonsText : '')
                        });

                        const linesCount = (detailDesc + (addonsText ? '\n' + addonsText : '')).split('\n').length;
                        doc.moveDown(linesCount + 0.5);
                    }
                } else {
                    // --- Single Window Case ---
                    for (let sub of win.sub_windows) {
                        if (doc.y > 680) doc.addPage();

                        const f = (zh, en) => (zh && en) ? `${zh} (${en})` : (zh || en || 'N/A');
                        const specStr = `${f(sub.material_name_zh, sub.material_name_en)}\n${f(sub.color_name_zh, sub.color_name_en)}\n${f(sub.glass_name_zh, sub.glass_name_en)}\n${f(sub.window_type_name_zh, sub.window_type_name_en)}`;
                        const addonsText = sub.addons.map(a => `${a.name_zh}(${a.name_en}) (x${a.quantity})`).join(', ');

                        const startY = doc.y;
                        drawRow(doc, startY, {
                            no: `Win #${win.window_number}`,
                            size: `${sub.width_inches}" x ${sub.height_inches}"`,
                            desc: specStr + (addonsText ? '\nAdd-ons: ' + addonsText : ''),
                            qty: win.quantity.toString(),
                            price: `$${(win.total_price / win.quantity).toFixed(2)}`,
                            total: `$${win.total_price.toFixed(2)}`
                        });

                        const linesCount = (specStr + (addonsText ? '\nAdd-ons: ' + addonsText : '')).split('\n').length;
                        doc.moveDown(Math.max(linesCount, 2) + 0.5);
                    }
                }
                doc.moveTo(40, doc.y).lineTo(565, doc.y).lineWidth(0.5).stroke('#eee');
                doc.moveDown(0.5);
            }
        }
        rowCount = rowCount + windows.length;
        // Standard Items
        if (standard_items.length > 0) {
            for (let item of standard_items) {
                if (doc.y > 700) doc.addPage();

                const startY = doc.y;
                drawRow(doc, startY, {
                    no: rowCount.toString(),
                    desc: `${item.product_name}(${item.category || ''}) \n ${item.notes || ''}`,
                    qty: item.quantity.toString() + ' ' + item.default_unit,
                    price: `$${item.unit_price.toFixed(2)}`,
                    total: `$${item.total_price.toFixed(2)}`
                });

                doc.moveDown(2.5);
                doc.moveTo(40, doc.y).lineTo(565, doc.y).lineWidth(0.5).stroke('#eee');
                doc.moveDown(0.5);
                rowCount++;
            }
        }

        doc.moveDown(2);

        // --- SECTION 3: FINANCIAL SUMMARY ---
        if (doc.y > 650) doc.addPage();

        const formatCurrency = (val) => `$${(val || 0).toFixed(2)} `;

        doc.fontSize(10);
        doc.text(`Subtotal / 小计: `, 350, doc.y, { continued: true }).text(formatCurrency(order.subtotal), { align: 'right' });
        doc.text(`Discount / 折扣: `, 350, doc.y, { continued: true }).text(` - ${formatCurrency(order.discount_amount)} `, { align: 'right' });
        doc.text(`Tax / 税费 (${(order.tax_rate * 100).toFixed(2)}%): `, 350, doc.y, { continued: true }).text(formatCurrency(order.tax_amount), { align: 'right' });
        doc.text(`TOTAL / 总计: `, 350, doc.y + 5, { continued: true, bold: true }).text(formatCurrency(order.total_amount), { align: 'right' });

        // Payment info (mini version)
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Paid / 已付: ${formatCurrency(totalPaid)} `, 350, doc.y, { align: 'right' });
        doc.text(`Balance / 余额: ${formatCurrency(order.total_amount - totalPaid)} `, { align: 'right' });

        doc.moveDown(2);

        // --- SECTION 4: TERMS & SIGNATURE ---
        if (doc.y > 600) doc.addPage();
        doc.fontSize(10).text('Thank you for choosing our services! / 感谢您的光顾！', 50, doc.y, { align: 'center' });
        doc.moveDown(0.5);
        doc.text('IMPORTANT: Customized products are non-refundable and non-exchangeable.', 50, doc.y, { align: 'center', bold: true });
        doc.text('重要提示：订制产品一旦下单生产，不退不换。', 50, doc.y, { align: 'center', bold: true });

        doc.moveDown(2);
        const signatureY = doc.y;
        doc.text('Customer Signature / 客户签名:', 60, signatureY);
        doc.moveTo(220, signatureY + 12).lineTo(400, signatureY + 12).stroke();
        doc.text('Date / 日期:', 420, signatureY);
        doc.moveTo(460, signatureY + 12).lineTo(540, signatureY + 12).stroke();

        doc.end();
        console.log(filename)
        // Save document record and Audit log
        await Promise.all([
            db.run(`
                INSERT INTO order_documents(order_id, document_type, file_path)
VALUES(?, 'invoice', ?)
    `, [orderId, filepath]),
            auditLog(req, 'GENERATE_INVOICE', 'order', orderId, { filename })
        ]);

    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

// ==================== 订单标准产品集成 ====================

// 获取订单的标准产品
router.get('/:id/standard-items', optionalAuth, async (req, res) => {
    try {
        const items = await db.all(`
            SELECT osi.*, sp.name as product_name, sp.category, sp.unit
            FROM order_standard_items osi
            JOIN standard_products sp ON osi.product_id = sp.id
            WHERE osi.order_id = ?
    ORDER BY osi.created_at
        `, [req.params.id]);

        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 在订单中添加标准产品
router.post('/:id/standard-items', requireAuth, auditLog('CREATE', 'order_standard_item'), async (req, res) => {
    try {
        const { product_id, quantity, notes } = req.body;
        const order_id = req.params.id;

        if (!product_id || !quantity || quantity <= 0) {
            return res.status(400).json({ error: 'Invalid product or quantity / 产品或数量无效' });
        }

        // 获取产品信息
        const product = await db.get(
            'SELECT * FROM standard_products WHERE id = ? AND is_active = 1',
            [product_id]
        );

        if (!product) {
            return res.status(404).json({ error: 'Product not found or inactive / 产品未找到或已禁用' });
        }

        // 检查库存
        if (product.current_stock < quantity) {
            return res.status(400).json({
                error: `Insufficient stock.Available: ${product.current_stock} / 库存不足，可用: ${product.current_stock}`
            });
        }

        const unit_price = product.selling_price;
        const total_price = unit_price * quantity;

        // 开始事务
        await db.run('BEGIN TRANSACTION');

        try {
            // 添加订单项
            const itemResult = await db.run(`
                INSERT INTO order_standard_items 
                (order_id, product_id, quantity, unit_price, total_price, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [order_id, product_id, quantity, unit_price, total_price, notes]);

            // 减少库存
            await db.run(`
                UPDATE standard_products 
                SET current_stock = current_stock - ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [quantity, product_id]);

            // 更新订单总金额
            await db.run(`
                UPDATE orders 
                SET total_amount = total_amount + ?
                WHERE id = ?
            `, [total_price, order_id]);

            await db.run('COMMIT');

            // 获取创建的订单项
            const item = await db.get(`
                SELECT osi.*, sp.name as product_name, sp.category, sp.unit
                FROM order_standard_items osi
                JOIN standard_products sp ON osi.product_id = sp.id
                WHERE osi.id = ?
            `, [itemResult.id]);

            res.status(201).json(item);
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除订单中的标准产品
router.delete('/:orderId/standard-items/:itemId', requireAuth, auditLog('DELETE', 'order_standard_item'), async (req, res) => {
    try {
        const { orderId, itemId } = req.params;

        // 获取订单项信息
        const item = await db.get(
            'SELECT * FROM order_standard_items WHERE id = ? AND order_id = ?',
            [itemId, orderId]
        );

        if (!item) {
            return res.status(404).json({ error: 'Order item not found / 订单项未找到' });
        }

        // 开始事务
        await db.run('BEGIN TRANSACTION');

        try {
            // 删除订单项
            await db.run(
                'DELETE FROM order_standard_items WHERE id = ?',
                [itemId]
            );

            // 恢复库存
            await db.run(`
                UPDATE standard_products 
                SET current_stock = current_stock + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [item.quantity, item.product_id]);

            // 更新订单总金额
            await db.run(`
                UPDATE orders 
                SET total_amount = total_amount - ?
                WHERE id = ?
            `, [item.total_price, orderId]);

            await db.run('COMMIT');

            res.json({ message: 'Item removed and stock restored / 已删除并恢复库存' });
        } catch (error) {
            await db.run('ROLLBACK');
            throw error;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});




module.exports = router;
