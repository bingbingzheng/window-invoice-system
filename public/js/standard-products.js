// 标准产品管理 / Standard Products Management

const StandardProducts = {
    products: [],
    categories: [],
    templates: [],
    productNames: [],
    currentProduct: null,
    currentTemplate: null,
    isBoss: false,

    // SPA渲染方法 / SPA Render Method
    async render(content) {
        try {
            // 检查登录状态
            const authStatus = await Utils.request('/auth/check');
            this.isBoss = authStatus.role === 'boss';

            // 生成页面HTML
            content.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Standard Products / 标准产品</h2>
                        <div>
                            <select id="category-filter" class="form-select" style="display: inline-block; width: auto; margin-right: 10px;">
                                <option value="">All Categories / 所有分类</option>
                            </select>
                            <button id="low-stock-btn" class="btn btn-warning" style="display: ${this.isBoss ? 'inline-block' : 'none'}">
                                ⚠️ Low Stock / 低库存
                            </button>
                            <button id="add-product-btn" class="btn btn-primary" style="display: ${this.isBoss ? 'inline-block' : 'none'}">
                                ➕ Add Product / 添加产品
                            </button>
                        </div>
                    </div>

                    <div class="table-wrapper">
                        <table class="table">
                        <thead>
                            <tr>
                                <th>Product Name / 产品名称</th>
                                <th>Category / 类别</th>
                                <th>Unit / 单位</th>
                                <th>Stock / 库存</th>
                                ${this.isBoss ? '<th>Avg Cost / 平均成本</th>' : ''}
                                <th>Price / 售价</th>
                                <th>Status / 状态</th>
                                <th>Actions / 操作</th>
                            </tr>
                        </thead>
                        <tbody id="products-tbody">
                            <tr><td colspan="${this.isBoss ? '8' : '7'}" class="text-center">Loading... / 加载中...</td></tr>
                        </tbody>
                    </table>
                    </div>
                </div>

                ${this.isBoss ? `
                <div class="card" style="margin-top: var(--spacing-lg);">
                    <div class="card-header">
                        <h3 class="card-title">Product Templates / 产品模板</h3>
                        <button id="add-template-btn" class="btn btn-primary">
                            ➕ Add Template / 添加模板
                        </button>
                    </div>
                    <div class="table-wrapper">
                        <table class="table">
                        <thead>
                            <tr>
                                <th>Product Name / 产品名称</th>
                                <th>Category / 类别</th>
                                <th>Default Unit / 默认单位</th>
                                <th>Actions / 操作</th>
                            </tr>
                        </thead>
                        <tbody id="templates-tbody">
                            <tr><td colspan="4" class="text-center">Loading... / 加载中...</td></tr>
                        </tbody>
                    </table>
                    </div>
                </div>
                ` : ''}

                ${this.renderModals()}
            `;

            // 初始化
            await this.init();
        } catch (error) {
            content.innerHTML = '<div class="card"><p>Loading failed / 加载失败</p></div>';
            console.error('Error rendering standard products:', error);
        }
    },

    renderModals() {
        return `
            <!-- Product Modal -->
            <div id="product-modal" class="modal-overlay" style="display: none;">
                <div class="modal">
                    <div class="modal-header">
                        <h2 id="product-modal-title" class="modal-title">Add Product / 添加产品</h2>
                        <button class="modal-close" onclick="StandardProducts.closeProductModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="product-form">
                            <input type="hidden" id="product-id">
                            
                            <div class="grid grid-2 gap-1">
                            <div class="form-group">
                                    <label class="form-label">Category / 类别 *</label>
                                    <select id="product-category" class="form-select" required>
                                        <option value="">Select Category / 选择类别</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Product Name / 产品名称 *</label>
                                    <select id="product-name" class="form-select" required>
                                        <option value="">Select Product / 选择产品</option>
                                    </select>
                                </div>

                                
                            </div>

                            <div class="grid grid-2 gap-1">
                                <div class="form-group">
                                    <label class="form-label">Unit / 单位 *</label>
                                    <select id="product-unit" class="form-select" required>
                                        <option value="piece">Piece / 个</option>
                                        <option value="set">Set / 套</option>
                                        <option value="ft">Foot (ft) / 英尺</option>
                                        <option value="sqft">Square Foot (sqft) / 平方英尺</option>
                                        <option value="lb">Pound (lb) / 磅</option>
                                        <option value="gallon">Gallon / 加仑</option>
                                        <option value="box">Box / 箱</option>
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">Selling Price ($) / 售价 *</label>
                                    <input type="number" id="product-price" class="form-input" step="0.01" min="0" required>
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Min Stock Alert / 最小库存提醒</label>
                                <input type="number" id="product-min-stock" class="form-input" value="10" min="0">
                            </div>

                            <div class="form-group" id="product-status-group" style="display: none;">
                                <label class="form-label">
                                    <input type="checkbox" id="product-active" checked>
                                    Active / 启用
                                </label>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Notes / 备注</label>
                                <textarea id="product-notes" class="form-textarea" rows="3"></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="StandardProducts.closeProductModal()">Cancel / 取消</button>
                        <button class="btn btn-primary" onclick="StandardProducts.saveProduct()">Save / 保存</button>
                    </div>
                </div>
            </div>

            <!-- Purchase Modal -->
            <div id="purchase-modal" class="modal-overlay" style="display: none;">
                <div class="modal">
                    <div class="modal-header">
                        <h2 class="modal-title">Record Purchase / 记录采购</h2>
                        <button class="modal-close" onclick="StandardProducts.closePurchaseModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="purchase-product-id">
                        <div id="purchase-product-info"></div>

                        <form id="purchase-form">
                            <div class="grid grid-2 gap-1">
                                <div class="form-group">
                                    <label class="form-label">Quantity / 采购数量 *</label>
                                    <input type="number" id="purchase-quantity" class="form-input" min="1" required>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">Unit Price ($) / 单价 *</label>
                                    <input type="number" id="purchase-price" class="form-input" step="0.01" min="0" required>
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Total / 总价</label>
                                <input type="text" id="purchase-total" class="form-input" readonly>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Purchase Date / 采购日期</label>
                                <input type="date" id="purchase-date" class="form-input">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Supplier / 供应商</label>
                                <input type="text" id="purchase-supplier" class="form-input">
                            </div>

                            <div class="form-group">
                                <label class="form-label">Notes / 备注</label>
                                <textarea id="purchase-notes" class="form-textarea" rows="3"></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="StandardProducts.closePurchaseModal()">Cancel / 取消</button>
                        <button class="btn btn-primary" onclick="StandardProducts.savePurchase()">Save / 保存</button>
                    </div>
                </div>
            </div>

            <!-- History Modal -->
            <div id="history-modal" class="modal-overlay" style="display: none;">
                <div class="modal" style="max-width: 900px;">
                    <div class="modal-header">
                        <h2 class="modal-title">Purchase History / 采购历史</h2>
                        <button class="modal-close" onclick="StandardProducts.closeHistoryModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="history-product-id">
                        <div class="table-wrapper">
                            <table class="table">
                            <thead>
                                <tr>
                                    <th>Date / 日期</th>
                                    <th>Qty / 数量</th>
                                    <th>Price / 单价</th>
                                    <th>Total / 总价</th>
                                    <th>Supplier / 供应商</th>
                                    <th>By / 操作人</th>
                                    <th>Notes / 备注</th>
                                    <th>Actions / 操作</th>
                                </tr>
                            </thead>
                            <tbody id="history-tbody">
                                <tr><td colspan="8" class="text-center">Loading... / 加载中...</td></tr>
                            </tbody>
                        </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="StandardProducts.closeHistoryModal()">Close / 关闭</button>
                    </div>
                </div>
            </div>

            <!-- Template Modal -->
            <div id="template-modal" class="modal-overlay" style="display: none;">
                <div class="modal">
                    <div class="modal-header">
                        <h2 id="template-modal-title" class="modal-title">Add Template / 添加模板</h2>
                        <button class="modal-close" onclick="StandardProducts.closeTemplateModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <form id="template-form">
                            <input type="hidden" id="template-id">
                            
                            <div class="form-group">
                                <label class="form-label">Product Name / 产品名称 *</label>
                                <input type="text" id="template-product-name" class="form-input" required>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Category / 类别 *</label>
                                <input type="text" id="template-category" class="form-input" required>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Default Unit / 默认单位 *</label>
                                <select id="template-unit" class="form-select" required>
                                    <option value="piece">Piece / 个</option>
                                    <option value="set">Set / 套</option>
                                    <option value="ft">Foot (ft) / 英尺</option>
                                    <option value="sqft">Square Foot (sqft) / 平方英尺</option>
                                    <option value="lb">Pound (lb) / 磅</option>
                                    <option value="gallon">Gallon / 加仑</option>
                                    <option value="box">Box / 箱</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="StandardProducts.closeTemplateModal()">Cancel / 取消</button>
                        <button class="btn btn-primary" onclick="StandardProducts.saveTemplate()">Save / 保存</button>
                    </div>
                </div>
            </div>
        `;
    },

    async init() {
        // 加载模板和分类
        await this.loadTemplates();
        await this.loadCategories();
        await this.loadProductNames();

        // 加载产品列表
        await this.loadProducts();

        // 绑定事件
        this.bindEvents();
    },

    bindEvents() {
        // 分类筛选
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                this.loadProducts();
            });
        }

        // 添加产品按钮
        const addBtn = document.getElementById('add-product-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.showProductModal();
            });
        }

        // 低库存按钮
        const lowStockBtn = document.getElementById('low-stock-btn');
        if (lowStockBtn) {
            lowStockBtn.addEventListener('click', () => {
                this.showLowStock();
            });
        }

        // 添加模板按钮
        const addTemplateBtn = document.getElementById('add-template-btn');
        if (addTemplateBtn) {
            addTemplateBtn.addEventListener('click', () => {
                this.showTemplateModal();
            });
        }

        // Category change -> Update product options
        const categorySelect = document.getElementById('product-category');
        if (categorySelect) {
            categorySelect.addEventListener('change', () => {
                this.updateProductOptions();
            });
        }

        // Product Name change -> Update unit
        const productNameSelect = document.getElementById('product-name');
        if (productNameSelect) {
            productNameSelect.addEventListener('change', () => {
                this.updateUnitOption();
            });
        }

        // 采购表单自动计算总价
        const purchaseQty = document.getElementById('purchase-quantity');
        const purchasePrice = document.getElementById('purchase-price');
        if (purchaseQty && purchasePrice) {
            purchaseQty.addEventListener('input', () => this.calculatePurchaseTotal());
            purchasePrice.addEventListener('input', () => this.calculatePurchaseTotal());
        }

        // 设置默认采购日期为今天
        const purchaseDate = document.getElementById('purchase-date');
        if (purchaseDate) {
            purchaseDate.valueAsDate = new Date();
        }
    },

    // ==================== Template Management ====================

    async loadTemplates() {
        if (!this.isBoss) return;

        try {
            this.templates = await Utils.request('/product-templates');
            this.renderTemplates();
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    },

    async loadProductNames() {
        try {
            this.productNames = await Utils.request('/product-templates/product-names');
            this.updateProductNameOptions();
        } catch (error) {
            console.error('Error loading product names:', error);
        }
    },

    async loadCategories() {
        try {
            this.categories = await Utils.request('/product-templates/categories');
            const select = document.getElementById('category-filter');
            if (select) {
                // Clear existing options except first
                while (select.options.length > 1) {
                    select.remove(1);
                }
                // Add categories
                this.categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.textContent = cat;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    },

    updateProductNameOptions() {
        const select = document.getElementById('product-name');
        if (!select) return;

        // Clear existing options except first
        while (select.options.length > 1) {
            select.remove(1);
        }

        // Add product names
        this.productNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    },

    updateProductOptions() {
        const categorySelect = document.getElementById('product-category');
        const nameSelect = document.getElementById('product-name');

        if (!categorySelect || !nameSelect) return;

        const selectedCategory = categorySelect.value;
        const currentName = nameSelect.value;

        // Clear name options
        while (nameSelect.options.length > 1) {
            nameSelect.remove(1);
        }

        if (!selectedCategory) {
            nameSelect.disabled = true;
            return;
        }

        // Filter templates by category
        const matchingTemplates = this.templates.filter(t => t.category === selectedCategory);

        // Get unique product names for this category
        const uniqueNames = [...new Set(matchingTemplates.map(t => t.product_name))];

        uniqueNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            nameSelect.appendChild(option);
        });

        nameSelect.disabled = false;

        // Restore selection if valid, otherwise reset
        if (currentName && uniqueNames.includes(currentName)) {
            nameSelect.value = currentName;
        } else {
            nameSelect.value = "";
        }

        this.updateUnitOption();
    },

    updateUnitOption() {
        const categorySelect = document.getElementById('product-category');
        const nameSelect = document.getElementById('product-name');
        const unitSelect = document.getElementById('product-unit');

        if (!categorySelect || !nameSelect || !unitSelect) return;

        const category = categorySelect.value;
        const name = nameSelect.value;

        // Clear existing options
        while (unitSelect.options.length > 0) {
            unitSelect.remove(0);
        }

        if (category && name) {
            const template = this.templates.find(t => t.category === category && t.product_name === name);
            if (template) {
                // Add option from template
                const option = document.createElement('option');
                option.value = template.default_unit;
                option.textContent = this.formatUnit(template.default_unit);
                unitSelect.appendChild(option);
                unitSelect.value = template.default_unit;
            } else {
                // Fallback option
                this.addDefaultUnitOptions(unitSelect);
            }
        } else {
            // Reset to defaults if no selection
            this.addDefaultUnitOptions(unitSelect);
        }
    },

    formatUnit(unit) {
        const map = {
            'piece': 'Piece / 个',
            'set': 'Set / 套',
            'ft': 'Foot (ft) / 英尺',
            'sqft': 'Square Foot (sqft) / 平方英尺',
            'lb': 'Pound (lb) / 磅',
            'gallon': 'Gallon / 加仑',
            'box': 'Box / 箱'
        };
        return map[unit] || unit;
    },

    addDefaultUnitOptions(select) {
        const units = [
            { v: 'piece', l: 'Piece / 个' },
            { v: 'set', l: 'Set / 套' },
            { v: 'ft', l: 'Foot (ft) / 英尺' },
            { v: 'sqft', l: 'Square Foot (sqft) / 平方英尺' },
            { v: 'lb', l: 'Pound (lb) / 磅' },
            { v: 'gallon', l: 'Gallon / 加仑' },
            { v: 'box', l: 'Box / 箱' }
        ];

        // Add placeholder
        const placeholder = document.createElement('option');
        placeholder.value = "";
        placeholder.textContent = "Select Unit / 选择单位";
        select.appendChild(placeholder);

        units.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.v;
            opt.textContent = u.l;
            select.appendChild(opt);
        });
    },

    renderTemplates() {
        if (!this.isBoss) return;

        const tbody = document.getElementById('templates-tbody');
        if (!tbody) return;

        if (this.templates.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No templates / 暂无模板</td></tr>';
            return;
        }

        tbody.innerHTML = this.templates.map(template => `
            <tr>
                <td data-label="Product Name / 产品名称">${Utils.escapeHtml(template.product_name)}</td>
                <td data-label="Category / 类别">${Utils.escapeHtml(template.category)}</td>
                <td data-label="Default Unit / 默认单位">${Utils.escapeHtml(template.default_unit)}</td>
                <td data-label="Actions / 操作">
                    <button class="btn btn-sm btn-primary" onclick="StandardProducts.editTemplate(${template.id})">
                        ✏️ Edit / 编辑
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="StandardProducts.deleteTemplate(${template.id})">
                        🗑️ Delete / 删除
                    </button>
                </td>
            </tr>
        `).join('');
    },

    showTemplateModal(template = null) {
        this.currentTemplate = template;
        const modal = document.getElementById('template-modal');
        const title = document.getElementById('template-modal-title');

        if (!modal) return;

        if (template) {
            title.textContent = 'Edit Template / 编辑模板';
            document.getElementById('template-id').value = template.id;
            document.getElementById('template-product-name').value = template.product_name;
            document.getElementById('template-category').value = template.category;
            document.getElementById('template-unit').value = template.default_unit;
        } else {
            title.textContent = 'Add Template / 添加模板';
            document.getElementById('template-form').reset();
            document.getElementById('template-id').value = '';
        }

        modal.style.display = 'flex';
    },

    async editTemplate(id) {
        const template = this.templates.find(t => t.id === id);
        if (template) {
            this.showTemplateModal(template);
        }
    },

    async saveTemplate() {
        const id = document.getElementById('template-id').value;
        const data = {
            product_name: document.getElementById('template-product-name').value.trim(),
            category: document.getElementById('template-category').value.trim(),
            default_unit: document.getElementById('template-unit').value
        };

        if (!data.product_name || !data.category) {
            Utils.showNotification('Product name and category are required / 产品名称和类别必填', 'error');
            return;
        }

        try {
            if (id) {
                await Utils.request(`/product-templates/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
                Utils.showNotification('Template updated / 模板已更新', 'success');
            } else {
                await Utils.request('/product-templates', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                Utils.showNotification('Template created / 模板已创建', 'success');
            }

            this.closeTemplateModal();
            await this.loadTemplates();
            await this.loadCategories();
            await this.loadProductNames();
        } catch (error) {
            // Error already shown by Utils.request
        }
    },

    async deleteTemplate(id) {
        if (!confirm('Are you sure you want to delete this template? / 确定要删除此模板吗？')) {
            return;
        }

        try {
            await Utils.request(`/product-templates/${id}`, {
                method: 'DELETE'
            });

            Utils.showNotification('Template deleted / 模板已删除', 'success');
            await this.loadTemplates();
            await this.loadCategories();
            await this.loadProductNames();
        } catch (error) {
            // Error already shown by Utils.request
        }
    },

    closeTemplateModal() {
        const modal = document.getElementById('template-modal');
        if (modal) {
            modal.style.display = 'none';
            const form = document.getElementById('template-form');
            if (form) form.reset();
        }
    },

    // ==================== Product Management ====================

    async loadProducts(category = null) {
        try {
            const categoryFilter = document.getElementById('category-filter');
            const selectedCategory = category || (categoryFilter ? categoryFilter.value : '');
            let url = '/standard-products';
            if (selectedCategory) {
                url += `?category=${encodeURIComponent(selectedCategory)}`;
            }

            this.products = await Utils.request(url);
            this.renderProducts();
        } catch (error) {
            console.error('Error in loadProducts:', error);
            Utils.showNotification('Failed to load products / 加载产品失败: ' + error.message, 'error');
        }
    },

    renderProducts() {
        const tbody = document.getElementById('products-tbody');
        if (!tbody) return;

        const colSpan = this.isBoss ? '8' : '7';

        if (this.products.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center">No products / 暂无产品</td></tr>`;
            return;
        }

        tbody.innerHTML = this.products.map(product => {
            const isLowStock = product.current_stock <= product.min_stock_alert;
            const stockClass = isLowStock ? 'low-stock' : '';
            const statusBadge = product.is_active
                ? '<span class="badge badge-success">Active / 启用</span>'
                : '<span class="badge badge-secondary">Inactive / 禁用</span>';

            return `
                <tr>
                    <td data-label="Product Name / 产品名称">${Utils.escapeHtml(product.name)}</td>
                    <td data-label="Category / 类别">${Utils.escapeHtml(product.category || '-')}</td>
                    <td data-label="Unit / 单位">${Utils.escapeHtml(product.unit)}</td>
                    <td data-label="Stock / 库存" class="${stockClass}">
                        ${product.current_stock}
                        ${isLowStock ? '⚠️' : ''}
                    </td>
                    ${this.isBoss ? `<td data-label="Avg Cost / 平均成本">$${product.avg_purchase_price.toFixed(2)}</td>` : ''}
                    <td data-label="Price / 售价">$${product.selling_price.toFixed(2)}</td>
                    <td data-label="Status / 状态">${statusBadge}</td>
                    <td data-label="Actions / 操作">
                        ${this.isBoss ? `
                            <button class="btn btn-sm btn-success" onclick="StandardProducts.showPurchaseModal(${product.id})">
                                📦 Purchase / 采购
                            </button>
                            <button class="btn btn-sm btn-info" onclick="StandardProducts.showHistory(${product.id})">
                                📊 History / 历史
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="StandardProducts.editProduct(${product.id})">
                                ✏️ Edit / 编辑
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    },

    showProductModal(product = null) {
        this.currentProduct = product;
        const modal = document.getElementById('product-modal');
        const title = document.getElementById('product-modal-title');
        const statusGroup = document.getElementById('product-status-group');

        if (!modal) return;

        if (product) {
            title.textContent = 'Edit Product / 编辑产品';
            document.getElementById('product-id').value = product.id;

            // Populate categories
            const categorySelect = document.getElementById('product-category');
            while (categorySelect.options.length > 1) categorySelect.remove(1);
            this.categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                categorySelect.appendChild(opt);
            });

            // Set Category first
            categorySelect.value = product.category || '';

            // Trigger update for Product Name options
            this.updateProductOptions();

            // Set Product Name
            const nameSelect = document.getElementById('product-name');
            nameSelect.value = product.name;

            // Set other fields
            document.getElementById('product-unit').value = product.unit;
            document.getElementById('product-price').value = product.selling_price;
            document.getElementById('product-min-stock').value = product.min_stock_alert;
            document.getElementById('product-notes').value = product.notes || '';
            document.getElementById('product-active').checked = product.is_active;
            statusGroup.style.display = 'block';
        } else {
            title.textContent = 'Add Product / 添加产品';
            document.getElementById('product-form').reset();
            document.getElementById('product-id').value = '';

            // Populate categories for new product
            const categorySelect = document.getElementById('product-category');
            while (categorySelect.options.length > 1) categorySelect.remove(1);
            this.categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                categorySelect.appendChild(opt);
            });

            this.updateProductOptions(); // Will disable name select if no category
            statusGroup.style.display = 'none';
        }

        modal.style.display = 'flex';
    },

    async editProduct(id) {
        const product = this.products.find(p => p.id === id);
        if (product) {
            this.showProductModal(product);
        }
    },

    async saveProduct() {
        const id = document.getElementById('product-id').value;
        const data = {
            name: document.getElementById('product-name').value,
            category: document.getElementById('product-category').value,
            unit: document.getElementById('product-unit').value,
            selling_price: parseFloat(document.getElementById('product-price').value),
            min_stock_alert: parseInt(document.getElementById('product-min-stock').value),
            notes: document.getElementById('product-notes').value.trim()
        };

        if (!data.name || !data.category) {
            Utils.showNotification('Product name and category are required / 产品名称和类别必填', 'error');
            return;
        }

        if (id) {
            data.is_active = document.getElementById('product-active').checked ? 1 : 0;
        }

        try {
            if (id) {
                await Utils.request(`/standard-products/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
                Utils.showNotification('Product updated / 产品已更新', 'success');
            } else {
                await Utils.request('/standard-products', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                Utils.showNotification('Product created / 产品已创建', 'success');
            }

            this.closeProductModal();
            await this.loadProducts();
        } catch (error) {
            // Error already shown by Utils.request
        }
    },

    closeProductModal() {
        const modal = document.getElementById('product-modal');
        if (modal) {
            modal.style.display = 'none';
            const form = document.getElementById('product-form');
            if (form) form.reset();
        }
    },

    // ==================== Purchase Management ====================

    showPurchaseModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        document.getElementById('purchase-product-id').value = productId;
        document.getElementById('purchase-product-info').innerHTML = `
            <div class="info-card">
                <h3>${Utils.escapeHtml(product.name)}</h3>
                <p>Current Stock / 当前库存: <strong>${product.current_stock}</strong> ${product.unit}</p>
                <p>Avg Cost / 平均成本: <strong>$${product.avg_purchase_price.toFixed(2)}</strong></p>
                <p>Selling Price / 销售价格: <strong>$${product.selling_price.toFixed(2)}</strong></p>
            </div>
        `;

        const form = document.getElementById('purchase-form');
        if (form) form.reset();

        const purchaseDate = document.getElementById('purchase-date');
        if (purchaseDate) purchaseDate.valueAsDate = new Date();

        const modal = document.getElementById('purchase-modal');
        if (modal) modal.style.display = 'flex';
    },

    calculatePurchaseTotal() {
        const quantity = parseFloat(document.getElementById('purchase-quantity').value) || 0;
        const price = parseFloat(document.getElementById('purchase-price').value) || 0;
        const total = quantity * price;
        const totalField = document.getElementById('purchase-total');
        if (totalField) {
            totalField.value = `$${total.toFixed(2)}`;
        }
    },

    async savePurchase() {
        const productId = document.getElementById('purchase-product-id').value;
        const data = {
            quantity: parseInt(document.getElementById('purchase-quantity').value),
            unit_price: parseFloat(document.getElementById('purchase-price').value),
            supplier: document.getElementById('purchase-supplier').value.trim(),
            purchase_date: document.getElementById('purchase-date').value,
            notes: document.getElementById('purchase-notes').value.trim()
        };

        if (!data.quantity || data.quantity <= 0) {
            Utils.showNotification('Please enter valid quantity / 请输入有效数量', 'error');
            return;
        }

        if (!data.unit_price || data.unit_price <= 0) {
            Utils.showNotification('Please enter valid price / 请输入有效单价', 'error');
            return;
        }

        try {
            await Utils.request(`/standard-products/${productId}/purchases`, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            Utils.showNotification('Purchase recorded / 采购记录已保存', 'success');
            this.closePurchaseModal();
            await this.loadProducts();
        } catch (error) {
            // Error already shown by Utils.request
        }
    },

    closePurchaseModal() {
        const modal = document.getElementById('purchase-modal');
        if (modal) {
            modal.style.display = 'none';
            const form = document.getElementById('purchase-form');
            if (form) form.reset();
        }
    },

    async showHistory(productId) {
        try {
            document.getElementById('history-product-id').value = productId;
            const purchases = await Utils.request(`/standard-products/${productId}/purchases`);
            const product = this.products.find(p => p.id === productId);

            const tbody = document.getElementById('history-tbody');
            if (!tbody) return;

            if (purchases.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center">No purchase history / 暂无采购记录</td></tr>';
            } else {
                tbody.innerHTML = purchases.map(p => `
                    <tr>
                        <td data-label="Date / 日期">${p.purchase_date}</td>
                        <td data-label="Qty / 数量">${p.quantity}</td>
                        <td data-label="Price / 单价">$${p.unit_price.toFixed(2)}</td>
                        <td data-label="Total / 总价">$${p.total_cost.toFixed(2)}</td>
                        <td data-label="Supplier / 供应商">${Utils.escapeHtml(p.supplier || '-')}</td>
                        <td data-label="By / 操作人">${Utils.escapeHtml(p.created_by_name || '-')}</td>
                        <td data-label="Notes / 备注">${Utils.escapeHtml(p.notes || '-')}</td>
                        <td data-label="Actions / 操作">
                            <button class="btn btn-sm btn-danger" onclick="StandardProducts.deletePurchase(${productId}, ${p.id})">
                                🗑️ Delete / 删除
                            </button>
                        </td>
                    </tr>
                `).join('');
            }

            const modal = document.getElementById('history-modal');
            if (modal) modal.style.display = 'flex';
        } catch (error) {
            Utils.showNotification('Failed to load history / 加载历史失败', 'error');
        }
    },

    async deletePurchase(productId, purchaseId) {
        if (!confirm('Are you sure you want to delete this purchase record? Stock will be reduced. / 确定要删除此采购记录吗？库存将会减少。')) {
            return;
        }

        try {
            await Utils.request(`/standard-products/${productId}/purchases/${purchaseId}`, {
                method: 'DELETE'
            });

            Utils.showNotification('Purchase deleted / 采购记录已删除', 'success');
            await this.showHistory(productId); // Refresh history
            await this.loadProducts(); // Refresh product list
        } catch (error) {
            // Error already shown by Utils.request
        }
    },

    closeHistoryModal() {
        const modal = document.getElementById('history-modal');
        if (modal) modal.style.display = 'none';
    },

    async showLowStock() {
        try {
            const lowStockProducts = await Utils.request('/standard-products/low-stock');

            if (lowStockProducts.length === 0) {
                Utils.showNotification('No low stock products / 没有低库存产品', 'info');
                return;
            }

            // Display low stock products
            this.products = lowStockProducts;
            this.renderProducts();
            const categoryFilter = document.getElementById('category-filter');
            if (categoryFilter) categoryFilter.value = '';

            Utils.showNotification(`Found ${lowStockProducts.length} low stock products / 发现 ${lowStockProducts.length} 个低库存产品`, 'warning');
        } catch (error) {
            Utils.showNotification('Failed to load / 加载失败', 'error');
        }
    }
};
