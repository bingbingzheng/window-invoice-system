-- 新版数据库结构 - 多维度组合定价
-- New Database Schema - Multi-Dimensional Combination Pricing

-- 客户表 / Customers
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    address TEXT,                           -- 地址
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 工厂表 / Factories
CREATE TABLE IF NOT EXISTS factories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    address TEXT,
    notes TEXT,
    max_perimeter REAL DEFAULT 500,
    max_square_inch REAL DEFAULT 5000,
    min_price REAL DEFAULT 0,
    over_length_unit_price REAL DEFAULT 0,
    -- pricing_method:
    -- combination: 组合定价(按周长) / Combination Pricing (Perimeter)
    -- square_inch: 面积定价(按平方英寸) / Area Pricing (Square Inch)
    -- fixed: 固定定价 / Fixed Pricing
    pricing_method TEXT DEFAULT 'combination' CHECK(pricing_method IN ('combination', 'square_inch', 'fixed')),
    is_default BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 材质表 / Materials
CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    factory_id INTEGER NOT NULL,
    name_en TEXT NOT NULL,
    name_zh TEXT NOT NULL,
    FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE CASCADE
);

-- 颜色表 / Colors
CREATE TABLE IF NOT EXISTS colors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    factory_id INTEGER NOT NULL,
    name_en TEXT NOT NULL,
    name_zh TEXT NOT NULL,
    FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE CASCADE
);

-- 玻璃类型表 / Glass Types
CREATE TABLE IF NOT EXISTS glass_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    factory_id INTEGER NOT NULL,
    name_en TEXT NOT NULL,
    name_zh TEXT NOT NULL,
    FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE CASCADE
);

-- 窗户类型表 / Window Types
CREATE TABLE IF NOT EXISTS window_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    factory_id INTEGER NOT NULL,
    name_en TEXT NOT NULL,
    name_zh TEXT NOT NULL,
    FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE CASCADE
);


-- 组合定价表 / Combination Pricing Table
-- 这是核心表：存储材质+颜色+玻璃+窗户类型+周长范围的组合价格
CREATE TABLE IF NOT EXISTS combination_pricing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    factory_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    color_id INTEGER NOT NULL,
    glass_type_id INTEGER NOT NULL,
    window_type_id INTEGER NOT NULL,
    min_perimeter REAL NOT NULL,
    max_perimeter REAL,
    base_price REAL NOT NULL,
    FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    FOREIGN KEY (color_id) REFERENCES colors(id) ON DELETE CASCADE,
    FOREIGN KEY (glass_type_id) REFERENCES glass_types(id) ON DELETE CASCADE,
    FOREIGN KEY (window_type_id) REFERENCES window_types(id) ON DELETE CASCADE,
    UNIQUE(factory_id, material_id, color_id, glass_type_id, window_type_id, min_perimeter)
);

-- 面积定价表 / Square Inch Pricing Table
-- 用于按面积计价的工厂 (pricing_method = 'square_inch')
CREATE TABLE IF NOT EXISTS square_inch_pricing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    factory_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    color_id INTEGER NOT NULL,
    glass_type_id INTEGER NOT NULL,
    window_type_id INTEGER NOT NULL,
    price_per_sq_inch REAL NOT NULL,    -- 每平方英寸单价
    FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    FOREIGN KEY (color_id) REFERENCES colors(id) ON DELETE CASCADE,
    FOREIGN KEY (glass_type_id) REFERENCES glass_types(id) ON DELETE CASCADE,
    FOREIGN KEY (window_type_id) REFERENCES window_types(id) ON DELETE CASCADE,
    UNIQUE(factory_id, material_id, color_id, glass_type_id, window_type_id)
);

-- Addon定价表 / Addon Pricing Table
-- 灵活的额外选项定价，可以自定义类型和计价方式
CREATE TABLE IF NOT EXISTS addon_pricing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    factory_id INTEGER NOT NULL,
    name_zh TEXT NOT NULL,
    name_en TEXT NOT NULL,
    -- addon_pricing types:
    -- per_quantity: 按数量 / Per Quantity
    -- fixed: 固定价格 / Fixed Price
    -- per_inch: 按周长(英寸) / Per Perimeter Inch
    -- per_sq_ft: 按面积(平方英尺) / Per Square Foot
    -- per_sq_inch: 按面积(平方英寸) / Per Square Inch
    pricing_type TEXT NOT NULL CHECK(pricing_type IN ('per_quantity', 'fixed', 'per_inch', 'per_sq_ft', 'per_sq_inch')),
    price REAL NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    notes TEXT,
    FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE CASCADE
);

-- 组合窗组装费表 / Combination Window Assembly Fees
-- 根据子窗数量收取固定组装费
CREATE TABLE IF NOT EXISTS combination_window_assembly_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    factory_id INTEGER NOT NULL,
    sub_window_count INTEGER NOT NULL,
    assembly_fee REAL NOT NULL,
    FOREIGN KEY (factory_id) REFERENCES factories(id) ON DELETE CASCADE,
    UNIQUE(factory_id, sub_window_count)
);

-- ============================================================
-- 视图 / Views
-- ============================================================

-- 标准产品视图（包含双语模板信息）
-- 简化查询，前端可以直接使用此视图获取产品的双语名称和类别
CREATE VIEW IF NOT EXISTS v_standard_products AS
SELECT 
    sp.id,
    sp.template_id,
    pt.product_name AS name,
    pt.category AS category,
    pt.default_unit AS unit,
    sp.current_stock,
    sp.min_stock_alert,
    sp.selling_price,
    sp.avg_purchase_price,
    sp.notes,
    sp.is_active,
    sp.created_at,
    sp.updated_at
FROM standard_products sp
JOIN product_templates pt ON sp.template_id = pt.id;

-- 窗户详情视图（包含子窗信息）
-- 简化查询，可以直接获取窗户及其所有子窗的完整信息
CREATE VIEW IF NOT EXISTS v_windows_with_details AS
SELECT 
    w.id AS window_id,
    w.order_id,
    w.item_type,
    w.quantity,
    w.total_price,
    w.assembly_fee,
    w.notes AS window_notes,
    sw.id AS sub_window_id,
    sw.width_inches,
    sw.height_inches,
    sw.perimeter_inches,
    sw.material_id,
    sw.color_id,
    sw.glass_type_id,
    sw.window_type_id,
    sw.price AS sub_window_price
FROM windows w
LEFT JOIN sub_windows sw ON w.id = sw.parent_window_id;

-- 产品模板表 / Product Templates
-- 存储预定义的产品名称和类别组合
CREATE TABLE IF NOT EXISTS product_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT NOT NULL,                 -- 产品名称
    category TEXT NOT NULL,                     -- 分类
    default_unit TEXT DEFAULT 'piece',          -- 默认单位
    is_active BOOLEAN DEFAULT 1,                -- 是否启用
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_name, category)
);

-- 标准产品表 / Standard Products
-- 使用外键关联到产品模板，避免重复存储名称、类别和单位
CREATE TABLE IF NOT EXISTS standard_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL UNIQUE,    -- 关联到产品模板（每个模板只能创建一个产品）
    current_stock INTEGER DEFAULT 0,        -- 当前库存数量
    min_stock_alert INTEGER DEFAULT 10,     -- 最低库存警告
    selling_price REAL DEFAULT 0,           -- 销售价格
    avg_purchase_price REAL DEFAULT 0,      -- 平均采购成本（自动计算）
    notes TEXT,                             -- 备注
    is_active BOOLEAN DEFAULT 1,            -- 是否启用
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES product_templates(id) ON DELETE RESTRICT
);

-- 采购记录表 / Product Purchases
CREATE TABLE IF NOT EXISTS product_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    purchase_date DATE DEFAULT (date('now')),
    quantity INTEGER NOT NULL,              -- 采购数量
    unit_price REAL NOT NULL,               -- 单价
    total_cost REAL NOT NULL,               -- 总成本
    supplier TEXT,                          -- 供应商
    notes TEXT,                             -- 备注
    created_by INTEGER,                     -- 操作人（老板）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES standard_products(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES admins(id)
);

-- 订单产品项表 / Order Standard Items
CREATE TABLE IF NOT EXISTS order_standard_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,              -- 购买数量
    unit_price REAL NOT NULL,               -- 销售单价（记录当时价格）
    total_price REAL NOT NULL,              -- 小计
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES standard_products(id)
);

-- 订单表 / Orders
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    factory_id INTEGER NOT NULL,
    order_date DATE DEFAULT (date('now')),
    -- delivery_type:
    -- pickup: 客户自取 / Customer Pickup
    -- store_delivery: 门店送货 / Store Delivery
    -- factory_delivery: 工厂直发 / Factory Direct Delivery
    delivery_type TEXT DEFAULT 'pickup' CHECK(delivery_type IN ('pickup', 'store_delivery', 'factory_delivery')),
    delivery_address TEXT,
    factory_delivery_date DATE,
    pickup_date DATE,
    sms_sent_date DATETIME,
    
    -- 金额相关 / Pricing
    subtotal REAL DEFAULT 0,           -- 小计（所有窗户和产品的总价，不含税）
    discount_amount REAL DEFAULT 0,         -- 折扣金额
    is_tax_free BOOLEAN DEFAULT 0,          -- 订单是否免税
    tax_rate REAL DEFAULT 0,                -- 税率 (例如 0.08875)
    tax_amount REAL DEFAULT 0,              -- 税额
    total_amount REAL NOT NULL,             -- 总金额 (subtotal - discount + tax)
    deposit_required REAL DEFAULT 0,        -- 应付押金 (例如 total_amount * 0.5)
    
    -- 状态流 / Status Workflow:
    --     'pending',                 // 新订单
    --     'factory_quote_pending',   // 等工厂报价
    --     'factory_quote_received',  // 工厂报价回传，需审核
    --     'factory_confirmed',       // 已确认工厂报价，才能生产
    --     'customer_quote_sent',     // 已给客户报价
    --     'customer_confirmed',      // 客户确认
    --     'in_production',           // 生产中
    --     'in_transit',              // 运输中（直送客户）
    --     'ready_for_pickup',        // 到店可取货
    --     'out_for_delivery',        // 店到客户 / 配送中
    --     'completed',               // 完成
    --     'cancelled'                // 取消
    status TEXT DEFAULT 'pending' CHECK(status IN (
    'pending',                
    'factory_quote_pending',   
    'factory_confirmed',       
    'customer_quote_sent',     
    'customer_confirmed',       
    'in_transit',              
    'ready_for_pickup',        
    'out_for_delivery',        
    'completed',               
    'cancelled'                
    )),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (factory_id) REFERENCES factories(id)
);

-- 窗户容器表 / Windows Container
-- 简化为容器，不存储具体尺寸和材质（统一使用 sub_windows）
-- 单窗：包含1个 sub_window
-- 组合窗：包含多个 sub_windows
CREATE TABLE IF NOT EXISTS windows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    window_number INTEGER NOT NULL,
    item_type TEXT DEFAULT 'single_window' CHECK(item_type IN ('single_window', 'combination')),
    quantity INTEGER DEFAULT 1,             -- 数量（通常为1）
    total_price REAL DEFAULT 0,             -- 总价（包含所有子窗和组装费）
    assembly_fee REAL DEFAULT 0,            -- 组装费（仅组合窗）
    notes TEXT,                             -- 备注
    total_width REAL DEFAULT 0,
    total_height REAL DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 子窗表 / Sub-windows
-- 存储所有窗户的实际数据（单窗和组合窗）
-- 单窗：parent_window_id 指向的 windows 记录只有1条 sub_window
-- 组合窗：parent_window_id 指向的 windows 记录有多条 sub_windows
CREATE TABLE IF NOT EXISTS sub_windows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_window_id INTEGER NOT NULL,
    width_inches REAL NOT NULL,
    height_inches REAL NOT NULL,
    perimeter_inches REAL GENERATED ALWAYS AS ((width_inches + height_inches) * 2) STORED,
    square_inch REAL GENERATED ALWAYS AS (width_inches * height_inches) STORED,
    material_id INTEGER,
    color_id INTEGER,
    glass_type_id INTEGER,
    window_type_id INTEGER,
    price REAL DEFAULT 0,
    FOREIGN KEY (parent_window_id) REFERENCES windows(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id),
    FOREIGN KEY (color_id) REFERENCES colors(id),
    FOREIGN KEY (glass_type_id) REFERENCES glass_types(id),
    FOREIGN KEY (window_type_id) REFERENCES window_types(id)
);

-- 子窗额外配置表 / Sub-window Addons
-- 存储每个子窗户选择的具体额外配置
CREATE TABLE IF NOT EXISTS sub_window_addons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sub_window_id INTEGER NOT NULL,
    addon_pricing_id INTEGER NOT NULL,
    quantity REAL DEFAULT 1,                -- 数量 (如果是按个计费)
    price REAL NOT NULL,                    -- 该配置的总价 (单价 * 数量 或 单价 * 尺寸)
    FOREIGN KEY (sub_window_id) REFERENCES sub_windows(id) ON DELETE CASCADE,
    FOREIGN KEY (addon_pricing_id) REFERENCES addon_pricing(id)
);

-- 支付记录表 / Order Payments
CREATE TABLE IF NOT EXISTS order_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    payment_date DATE NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 订单文档表 / Order Documents
CREATE TABLE IF NOT EXISTS order_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    document_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 管理员表 / Admins
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'employee' CHECK(role IN ('employee', 'boss')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引 / Create Indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_factory ON orders(factory_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_windows_order ON windows(order_id);
CREATE INDEX IF NOT EXISTS idx_sub_windows_window ON sub_windows(parent_window_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_combination_pricing_lookup ON combination_pricing(
    factory_id, material_id, color_id, glass_type_id, window_type_id, min_perimeter
);
CREATE INDEX IF NOT EXISTS idx_product_purchases_product ON product_purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_product_purchases_date ON product_purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_order_standard_items_order ON order_standard_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_standard_items_product ON order_standard_items(product_id);
CREATE INDEX IF NOT EXISTS idx_standard_products_template ON standard_products(template_id);
CREATE INDEX IF NOT EXISTS idx_product_templates_name ON product_templates(product_name);
CREATE INDEX IF NOT EXISTS idx_product_templates_category ON product_templates(category);

-- 操作日志表 / Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT NOT NULL,
    action TEXT NOT NULL,           -- 操作类型: CREATE, UPDATE, DELETE, UPLOAD
    entity_type TEXT NOT NULL,      -- 实体类型: customer, factory, order, payment, order_document
    entity_id INTEGER,              -- 实体ID
    details TEXT,                   -- 操作详情 (JSON)
    ip_address TEXT,                -- IP地址
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
