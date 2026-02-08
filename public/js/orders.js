// 订单管理模块
const Orders = {
    currentOrder: null,
    currentFactory: null,
    factoryData: null,
    addonData: [],

    // State for order creation
    standardProducts: [],
    standardItems: [], // Items to be added to order
    windows: [], // Window items

    orders: [],

    async render(content) {
        try {
            const orders = await Utils.request('/orders');
            AppState.orders = orders;
            console.log(orders);
            content.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Order Management / 订单管理</h2>
                        <div class="form-group">
                            <label class="form-label">Keyword / 搜索关键词</label>
                            <input type="text" id="keyword" class="form-input" value="${AppState.keyword}" onchange="Orders.filterOrders()" default="">
                        </div>
                        <button class="btn btn-primary" onclick="Orders.showCreateModal()">
                            <span>➕</span> Create Order / 创建订单
                        </button>
                    </div>
                    
                    <div class="table-wrapper">
                        <table class="table">
                        <thead>
                            <tr>
                                <th>Order # / 订单号</th>
                                <th>Customer / 客户</th>
                                <th>Date / 日期</th>
                                <th>Total / 总金额</th>
                                <th>Remaining / 剩余</th>
                                <th>Status / 状态</th>
                                <th>Actions / 操作</th>
                            </tr>
                        </thead>
                        <tbody id="order-table-body">
                            
                        </tbody>
                    </table>
                    </div>
                </div>
            `;
            Orders.renderOrders(orders);
        } catch (error) {
            console.error(error);
            content.innerHTML = '<div class="card"><p>Failed to load orders / 加载订单失败</p></div>';
        }
    },
    async filterOrders() {
        const keyword = document.getElementById('keyword').value.toLowerCase();
        AppState.keyword = keyword;
        const filteredOrders = AppState.orders.filter(order => {
            return order.order_number?.toLowerCase().includes(keyword) ||
                order.customer_name?.toLowerCase().includes(keyword) ||
                order.customer_phone?.toLowerCase().includes(keyword);
        });
        console.log(filteredOrders);
        if (filteredOrders.length === 0 && keyword !== '') {
            Utils.showNotification('No orders found / 没有找到订单', 'warning');
            Orders.renderOrders([]);
            return;
        } else {
            Orders.renderOrders(filteredOrders);
        }
    },

    async renderOrders(orders) {
        const tbody = document.getElementById('order-table-body');
        tbody.innerHTML = orders.map(order => `
            <tr>
                <td data-label="Order # / 订单号"><strong>${order.order_number}</strong></td>
                <td data-label="Customer / 客户">${order.customer_name}</td>
                <td data-label="Date / 日期">${Utils.formatDate(order.order_date)}</td>
                <td data-label="Total / 总金额">${Utils.formatCurrency(order.total_amount)}</td>
                <td data-label="Remaining / 剩余"><strong>${Utils.formatCurrency(order.remaining_amount)}</strong></td>
                <td data-label="Status / 状态"><span class="badge badge-${order.status}">${order.status}</span></td>
                <td data-label="Actions / 操作">
                    <button class="btn btn-sm btn-secondary" onclick="Orders.viewDetails(${order.id})">Details / 详情</button>
                </td>
            </tr>
        `).join('');
    },
    // Create Order
    async showCreateModal() {
        // Reset state
        Orders.standardItems = [];
        Orders.windows = []; // Start empty, user adds explicitly

        const [customers, factories, standardProducts] = await Promise.all([
            Utils.request('/customers'),
            Utils.request('/factories'),
            Utils.request('/standard-products')
        ]);

        Orders.allCustomers = customers || [];

        Orders.standardProducts = standardProducts.filter(p => p.is_active);

        const defaultFactory = factories.find(f => f.is_default) || factories[0];

        // Load addons for default factory
        if (defaultFactory) {
            Orders.currentFactory = defaultFactory;
            try {
                Orders.factoryData = await Utils.request(`/factories/${defaultFactory.id}`);
            } catch (e) { console.error('Failed to load factory data', e); }
        }

        const content = `
            <form id="order-form">
                <div class="grid grid-2 gap-1">
                    <div class="form-group" style="position: relative;">
                        <label class="form-label">Phone / 电话 *</label>
                        <input type="tel" name="customer_phone" class="form-input" placeholder="Enter Phone" 
                               oninput="Orders.handleCustomerLookup(this)" autocomplete="off" required>
                        <div id="customer-suggestions" class="autocomplete-dropdown" style="display:none;">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Name / 姓名 *</label>
                        <input type="text" name="customer_name" class="form-input" placeholder="Customer Name" 
                               oninput="Orders.handleCustomerLookup(this)" autocomplete="off" required>
                    </div>
                </div>
                
                <input type="hidden" name="customer_id">
                <input type="hidden" name="customer_type" value="new"> 

                <div class="form-group">
                    <label class="form-label">Factory / 工厂 *</label>
                    <select name="factory_id" class="form-select" required onchange="Orders.onFactoryChange(this)">
                        ${factories.map(f => `<option value="${f.id}" ${f.id === defaultFactory?.id ? 'selected' : ''}>${f.name}${f.is_default ? ' (Default)' : ''}</option>`).join('')}
                    </select>
                </div>
                

                <div class="card mt-1">
                    <div class="card-header">
                        <h3 class="card-title">Order Items / 订单项</h3>
                    </div>
                    
                    <!-- Type Selection Tabs -->
                    <div class="tabs">
                        <button type="button" class="tab active" onclick="Orders.switchTab('windows')">Custom Windows / 定制窗户</button>
                        <button type="button" class="tab" onclick="Orders.switchTab('standard')">Standard Products / 标准产品</button>
                    </div>

                    <!-- Windows Section -->
                    <div id="tab-windows" class="tab-content active" style="padding: 10px; border: 1px solid var(--border-color); border-top: none;">
                        <button type="button" class="btn btn-secondary w-100 mb-1" onclick="Orders.addWindowCard()">
                            + Add New Window / 添加新窗户
                        </button>
                        <div id="windows-container">
                            <!-- Windows will be rendered here -->
                        </div>
                    </div>

                    <!-- Standard Products Section -->
                    <div id="tab-standard" class="tab-content" style="display: none; padding: 10px; border: 1px solid var(--border-color); border-top: none;">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Product / 产品</th>
                                    <th>Price / 单价</th>
                                    <th>Qty / 数量</th>
                                    <th>Subtotal / 小计</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody id="standard-items-tbody">
                                <!-- Standard items rows -->
                            </tbody>
                        </table>
                        <button type="button" class="btn btn-secondary w-100 mt-1" onclick="Orders.addStandardProductRow()">
                             + Add Product / 添加产品
                        </button>
                    </div>

                    <!-- Order Summary -->
                    <div class="summary-card">
                        <div class="summary-row">
                            <span>Subtotal / 小计:</span>
                            <span id="order-subtotal" class="font-bold">$0.00</span>
                        </div>
                        <div class="summary-row">
                            <span>Discount / 折扣:</span>
                            <div class="flex gap-1" style="width: 200px;">
                                <input type="number" name="discount_amount" class="form-input text-right" 
                                       placeholder="Amount" onchange="Orders.calculateOrderTotal()">
                            </div>
                        </div>
                        <div class="summary-row">
                             <span>Tax / 税费 (<span id="tax-rate-display">8.875%</span>):</span>
                             <div class="flex gap-1 items-center" style="width: 200px; justify-content: flex-end;">
                                <label>
                                    <input 
                                        type="checkbox" 
                                        name="is_tax_free" 
                                        id="is_tax_free" 
                                        onchange="Orders.calculateOrderTotal()"
                                    >
                                    Wholesale
                                </label>
                                <span id="order-tax">$0.00</span>
                             </div>
                        </div>
                        <div class="summary-row">
                            <span>Total / 总计:</span>
                            <span id="order-total">$0.00</span>
                        </div>
                    </div>

                    <div class="form-group mt-1">
                        <label class="form-label">Notes / 备注</label>
                        <textarea name="notes" class="form-textarea" rows="3"></textarea>
                    </div>
                </div>
                <div class="grid grid-2 gap-1">
                    <div class="form-group">
                        <label class="form-label">Delivery Type / 交付方式</label>
                        <select name="delivery_type" class="form-select" onchange="Orders.handleDeliveryTypeChange(this.value)">
                            <option value="pickup">Pick Up / 客户自取</option>
                            <option value="store_delivery">Store Delivery / 门店送货</option>
                            <option value="factory_delivery">Factory Delivery / 工厂直发</option>
                        </select>
                        <div id="delivery-address-container" style="display: none; margin-top: 10px;">
                            <label class="form-label">Delivery Address / 送货地址</label>
                            <input type="text" name="delivery_address" class="form-input" placeholder="Enter delivery address...">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Deposit Required / 应付押金 ($)</label>
                        <input type="number" name="deposit_required" class="form-input" step="0.01" value="0">
                    </div>
                </div>
            </form>
        `;
        const footer = `
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">取消 / Cancel</button>
                <button class="btn btn-primary" onclick="Orders.submitOrder()">创建订单 Create Order</button>
            `;

        Utils.createModal('创建订单 Create Order', content, footer, 'modal-lg');

        // Initialize state
        Orders.renderWindows();
        Orders.renderStandardItems();
        Orders.calculateOrderTotal();
    },




    handleCustomerLookup(input) {
        const query = input.value.trim().toLowerCase();
        const suggestionsEl = document.getElementById('customer-suggestions');

        // Ensure dropdown follows the input being typed in
        if (suggestionsEl && input.parentNode) {
            input.parentNode.style.position = 'relative';
            input.parentNode.appendChild(suggestionsEl);
        }

        // Reset to "new" whenever user types, unless they subsequently click a suggestion
        const form = input.closest('form');
        if (form) {
            const idInput = form.querySelector('input[name="customer_id"]');
            const typeInput = form.querySelector('input[name="customer_type"]');
            if (idInput) idInput.value = '';
            if (typeInput) typeInput.value = 'new';
        }

        if (query.length < 1) {
            suggestionsEl.style.display = 'none';
            return;
        }

        // Filter customers by phone or name
        const matches = Orders.allCustomers.filter(c =>
            (c.phone && c.phone.toLowerCase().includes(query)) ||
            (c.name && c.name.toLowerCase().includes(query))
        );

        if (matches.length > 0) {
            suggestionsEl.innerHTML = matches.slice(0, 10).map(c => `
                <div class="autocomplete-item" onclick="Orders.selectCustomer(${c.id})">
                    <span class="customer-name">${c.name}</span>
                    <span class="customer-phone">${c.phone}</span>
                </div>
            `).join('');
            suggestionsEl.style.display = 'block';
        } else {
            suggestionsEl.style.display = 'none';
        }
    },

    selectCustomer(id) {
        const customer = Orders.allCustomers.find(c => c.id === id);
        if (!customer) return;

        // Set Hidden Values
        document.querySelector('input[name="customer_id"]').value = customer.id;
        document.querySelector('input[name="customer_type"]').value = 'existing';

        // Fill Visible Inputs
        document.querySelector('input[name="customer_phone"]').value = customer.phone;
        document.querySelector('input[name="customer_name"]').value = customer.name;

        // Hide Suggestions
        document.getElementById('customer-suggestions').style.display = 'none';

        // Trigger Tax Logic
        Orders.onCustomerSelect(customer);
    },

    onCustomerSelect(customer) {
        const isTaxFree = customer.is_tax_free === 1;
        const taxFreeCheckbox = document.getElementById('is_tax_free');
        if (taxFreeCheckbox) {
            taxFreeCheckbox.checked = isTaxFree;
            Orders.calculateOrderTotal();
        }
    },
    // --- Factory Logic ---
    async onFactoryChange(select) {
        const factoryId = select.value;
        if (factoryId) {
            try {

                Orders.factoryData = await Utils.request(`/factories/${factoryId}`);
                Orders.currentFactory = { id: factoryId }; // Simplified
                // Re-render windows to update addons
                Orders.renderWindows();
            } catch (e) {
                console.error(e);
            }
        }
    },
    // --- Tab Switching Logic ---
    switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

        const index = tabName === 'windows' ? 0 : 1;
        document.querySelectorAll('.tab')[index].classList.add('active');
        document.getElementById(`tab-${tabName}`).style.display = 'block';
    },
    // --- Customer Lookup Logic ---
    handleDeliveryTypeChange(value) {
        const container = document.getElementById('delivery-address-container');
        if (container) {
            container.style.display = (value === 'store_delivery' || value === 'factory_delivery') ? 'block' : 'none';
        }
    },
    // --- Window Logic ---

    addWindowCard() { // add a new window
        const fd = Orders.factoryData || {};
        Orders.windows.push({
            sub_windows: [{
                width_inches: 0,
                height_inches: 0,
                material_id: fd.materials?.[0]?.id || 1,
                color_id: fd.colors?.[0]?.id || 1,
                glass_type_id: fd.glassTypes?.[0]?.id || 1,
                window_type_id: fd.windowTypes?.[0]?.id || 1,
                addons: [],
                unit_price: 0,
            }],
            quantity: 1,
            notes: '',
            item_type: 'single_window',
            unit_price: 0,
            total_price: 0,
            total_height: 0,
            total_width: 0,
        });
        Orders.renderWindows();
        Orders.calculateOrderTotal();
    },

    removeWindowCard(index) { // remove entire window
        Orders.windows.splice(index, 1);
        Orders.renderWindows();
        Orders.calculateOrderTotal();
    },
    addSubWindow(winIndex) {
        const fd = Orders.factoryData || {};
        const lastSub = Orders.windows[winIndex].sub_windows[Orders.windows[winIndex].sub_windows.length - 1];

        Orders.windows[winIndex].sub_windows.push({
            width_inches: lastSub?.width_inches || 0,
            height_inches: lastSub?.height_inches || 0,
            material_id: lastSub?.material_id || fd.materials?.[0]?.id || 1,
            color_id: lastSub?.color_id || fd.colors?.[0]?.id || 1,
            glass_type_id: lastSub?.glass_type_id || fd.glassTypes?.[0]?.id || 1,
            window_type_id: lastSub?.window_type_id || fd.windowTypes?.[0]?.id || 1,
            addons: lastSub?.addons ? lastSub.addons.map(a => ({ ...a })) : []
        });
        Orders.renderWindows();
        Orders.calculateOrderTotal();
    },

    removeSubWindow(winIndex, subIndex) {
        if (Orders.windows[winIndex].sub_windows.length <= 1) {
            removeWindowCard(winIndex);
            return;
        }
        Orders.windows[winIndex].sub_windows.splice(subIndex, 1);
        Orders.renderWindows()
        Orders.calculateOrderTotal();
    },


    renderWindows() {
        const container = document.getElementById('windows-container');
        if (!container) return;

        container.innerHTML = Orders.windows.map((win, index) => Orders.getWindowCardHtml(win, index)).join('');

        // Restore values/bindings if needed, but simple re-render is easier for now.
        // Ideally we shouldn't re-render everything on input, but for MVP it's fine.
        // Wait, input focus loss! We should update state on input change, and only re-render structure changes.
        // For now, I will bind onchange events to update state without re-render unless necessary.
    },

    getWindowCardHtml(win, index) {
        return `
            <div class="card mb-1" id="window-card-${index}">
                <div class="flex-between mb-1">
                    <h4>Window #${index + 1}</h4>
                    <button type="button" class="btn btn-sm btn-danger" onclick="Orders.removeWindowCard(${index})">Remove / 删除</button>
                </div>

                <div class="form-group">
                    <label class="form-label">Notes / 备注</label>
                    <input type="text" class="form-input" value="${win.notes || ''}" onchange="Orders.updateWindow(${index}, 'notes', this.value)">
                </div>

                <div class="sub-windows-container" id="sub-windows-${index}">
                    ${win.sub_windows.map((sub, subIndex) => Orders.getSubWindowHtml(index, subIndex, sub)).join('')}
                </div>


                <button type="button" class="btn btn-sm btn-secondary mt-1" onclick="Orders.addSubWindow(${index})">
                    + Add Sub-Window (Combination) / 添加组合子窗
                </button>
                
                <div class="pricing-row-grid">
                     <div>
                         <label>Quantity / 数量:</label>
                         <input type="number" class="form-input" value="${win.quantity || 1}" min="1" onchange="Orders.updateWindow(${index}, 'quantity', this.value)">
                     </div>
                     ${win.sub_windows.length > 1 ? `
                        <div>
                            <label>Total Width / 总宽:</label>
                            <span id="window-total-width-${index}">0"</span>
                        </div>
                        <div>
                            <label>Total Height / 总高:</label>
                            <span id="window-total-height-${index}">0"</span>
                        </div>
                     ` : ''}
                     <div>
                         <label>Unit Price / 单价:</label>
                         <span class="window-price" id="window-price-${index}">$0.00</span>
                     </div>
                     <div>
                         <label>Subtotal / 小计:</label>
                         <span class="window-subtotal" id="window-subtotal-${index}">$0.00</span>
                     </div>
                </div>
            </div>
        `;
    },

    getSubWindowHtml(winIndex, subIndex, sub) {
        // Generate Addon Options
        const addonsHtml = (Orders.factoryData?.addons || []).map(addon => {
            const isChecked = (sub.addons || []).some(a => a.addon_id === addon.id);
            const qty = (sub.addons || []).find(a => a.addon_id === addon.id)?.quantity || 1;

            return `
            <label class="addon-tag ${isChecked ? 'selected' : ''}">
                <input type="checkbox" 
                       ${isChecked ? 'checked' : ''} 
                       onchange="Orders.toggleAddon(${winIndex}, ${subIndex}, ${addon.id}, this.checked)">
                <div class="flex-1" style="flex: 1;">
                    <div style="font-size: 0.9rem; font-weight: 500;">${addon.name_zh}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">$${addon.price}/${addon.pricing_type}</div>
                </div>
                ${addon.pricing_type === 'per_quantity' && isChecked ?
                    `<input type="number" class="form-input" style="width: 60px; height: 32px; font-size: 0.85rem;" 
                        value="${qty}" min="1" 
                        onclick="event.stopPropagation()"
                        onchange="Orders.updateAddonQty(${winIndex}, ${subIndex}, ${addon.id}, this.value)">`
                    : ''}
            </label>`;
        }).join('');

        // Build selectors for material/color etc from factoryData
        // Backend returns camelCase for these lists
        const materials = Orders.factoryData?.materials || [];
        const colors = Orders.factoryData?.colors || [];
        const glassTypes = Orders.factoryData?.glassTypes || [];
        const windowTypes = Orders.factoryData?.windowTypes || [];

        return `
            <div class="grid grid-1 gap-1 p-1 bg-secondary rounded mb-1 border">
                ${Orders.windows[winIndex].sub_windows.length > 1 ?
                `<div class="flex justify-end mb-1">
                    <button type="button" class="btn btn-sm btn-danger" style="padding: 2px 8px; font-size: 0.8em;" onclick="Orders.removeSubWindow(${winIndex}, ${subIndex})">Remove Sub / 移除子窗</button>
                 </div>`
                : ''}
                
                <div class="grid grid-2 gap-1">
                     <div class="form-group">
                        <label class="form-label">Width / 宽 (inch)</label>
                        <div class="flex gap-1">
                            <input type="number" step="1" class="form-input" value="${Math.floor(sub.width_inches || 0)}" min="0"
                                   onchange="Orders.updateSubDim(${winIndex}, ${subIndex}, 'width_int', this.value)">
                            <select class="form-select" style="width: 80px;" onchange="Orders.updateSubDim(${winIndex}, ${subIndex}, 'width_frac', this.value)">
                                <option value="0" ${sub.width_inches % 1 === 0 ? 'selected' : ''}>0</option>
                                <option value="0.125" ${sub.width_inches % 1 === 0.125 ? 'selected' : ''}>1/8</option>
                                <option value="0.25" ${sub.width_inches % 1 === 0.25 ? 'selected' : ''}>1/4</option>
                                <option value="0.375" ${sub.width_inches % 1 === 0.375 ? 'selected' : ''}>3/8</option>
                                <option value="0.5" ${sub.width_inches % 1 === 0.5 ? 'selected' : ''}>1/2</option>
                                <option value="0.625" ${sub.width_inches % 1 === 0.625 ? 'selected' : ''}>5/8</option>
                                <option value="0.75" ${sub.width_inches % 1 === 0.75 ? 'selected' : ''}>3/4</option>
                                <option value="0.875" ${sub.width_inches % 1 === 0.875 ? 'selected' : ''}>7/8</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Height / 高 (inch)</label>
                         <div class="flex gap-1">
                            <input type="number" step="1" class="form-input" value="${Math.floor(sub.height_inches || 0)}" min="0"
                                   onchange="Orders.updateSubDim(${winIndex}, ${subIndex}, 'height_int', this.value)">
                            <select class="form-select" style="width: 80px;" onchange="Orders.updateSubDim(${winIndex}, ${subIndex}, 'height_frac', this.value)">
                                <option value="0" ${sub.height_inches % 1 === 0 ? 'selected' : ''}>0</option>
                                <option value="0.125" ${sub.height_inches % 1 === 0.125 ? 'selected' : ''}>1/8</option>
                                <option value="0.25" ${sub.height_inches % 1 === 0.25 ? 'selected' : ''}>1/4</option>
                                <option value="0.375" ${sub.height_inches % 1 === 0.375 ? 'selected' : ''}>3/8</option>
                                <option value="0.5" ${sub.height_inches % 1 === 0.5 ? 'selected' : ''}>1/2</option>
                                <option value="0.625" ${sub.height_inches % 1 === 0.625 ? 'selected' : ''}>5/8</option>
                                <option value="0.75" ${sub.height_inches % 1 === 0.75 ? 'selected' : ''}>3/4</option>
                                <option value="0.875" ${sub.height_inches % 1 === 0.875 ? 'selected' : ''}>7/8</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="grid grid-2 gap-1">
                     <div class="form-group">
                        <label class="form-label">Type / 类型</label>
                        <select class="form-select" onchange="Orders.updateSubProp(${winIndex}, ${subIndex}, 'window_type_id', this.value)">
                            ${windowTypes.map(t => `<option value="${t.id}" ${t.id == sub.window_type_id ? 'selected' : ''}>${t.name_zh} (${t.name_en})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Glass / 玻璃</label>
                        <select class="form-select" onchange="Orders.updateSubProp(${winIndex}, ${subIndex}, 'glass_type_id', this.value)">
                             ${glassTypes.map(t => `<option value="${t.id}" ${t.id == sub.glass_type_id ? 'selected' : ''}>${t.name_zh} (${t.name_en})</option>`).join('')}
                        </select>
                    </div>
                     <div class="form-group">
                        <label class="form-label">Material / 材质</label>
                        <select class="form-select" onchange="Orders.updateSubProp(${winIndex}, ${subIndex}, 'material_id', this.value)">
                             ${materials.map(t => `<option value="${t.id}" ${t.id == sub.material_id ? 'selected' : ''}>${t.name_zh} (${t.name_en})</option>`).join('')}
                        </select>
                    </div>
                     <div class="form-group">
                        <label class="form-label">Color / 颜色</label>
                        <select class="form-select" onchange="Orders.updateSubProp(${winIndex}, ${subIndex}, 'color_id', this.value)">
                             ${colors.map(t => `<option value="${t.id}" ${t.id == sub.color_id ? 'selected' : ''}>${t.name_zh} (${t.name_en})</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Addons / 附加项目</label>
                    <div class="addon-grid">
                        ${addonsHtml}
                    </div>
                </div>
            </div>
        `;
    },



    updateSubDim(winIndex, subIndex, field, value) {
        const sub = Orders.windows[winIndex].sub_windows[subIndex];
        const currentW = sub.width_inches || 0;
        const currentH = sub.height_inches || 0;

        const wInt = Math.floor(currentW);
        const wFrac = currentW % 1;
        const hInt = Math.floor(currentH);
        const hFrac = currentH % 1;

        if (field === 'width_int') sub.width_inches = parseInt(value) + wFrac;
        if (field === 'width_frac') sub.width_inches = wInt + parseFloat(value);
        if (field === 'height_int') sub.height_inches = parseInt(value) + hFrac;
        if (field === 'height_frac') sub.height_inches = hInt + parseFloat(value);

        Orders.calculateOrderTotal();
    },

    updateSubProp(winIndex, subIndex, field, value) {
        Orders.windows[winIndex].sub_windows[subIndex][field] = value;
        Orders.calculateOrderTotal();
    },

    toggleAddon(winIndex, subIndex, addonId, checked) {
        const sub = Orders.windows[winIndex].sub_windows[subIndex];
        if (!sub.addons) sub.addons = [];

        if (checked) {
            sub.addons.push({ addon_id: addonId, quantity: 1 });
        } else {
            sub.addons = sub.addons.filter(a => a.addon_id !== addonId);
        }
        Orders.renderWindows(); // Re-render to show/hide qty input
        Orders.calculateOrderTotal();
    },

    updateAddonQty(winIndex, subIndex, addonId, qty) {
        const sub = Orders.windows[winIndex].sub_windows[subIndex];
        const addon = sub.addons.find(a => a.addon_id === addonId);
        if (addon) {
            addon.quantity = parseInt(qty) || 1;
        }
        Orders.calculateOrderTotal();
    },

    updateWindow(index, field, value) {
        Orders.windows[index][field] = value;
        if (field === 'quantity') Orders.calculateOrderTotal();
    },

    // --- Standard Products Logic ---

    addStandardProductRow() {
        Orders.standardItems.push({
            product_id: '',
            quantity: 1,
            unit_price: 0
        });
        Orders.renderStandardItems();
    },

    removeStandardProductRow(index) {
        Orders.standardItems.splice(index, 1);
        Orders.renderStandardItems();
        Orders.calculateOrderTotal();
    },

    renderStandardItems() {
        const tbody = document.getElementById('standard-items-tbody');
        if (!tbody) return;

        tbody.innerHTML = Orders.standardItems.map((item, index) => `
            <tr>
                <td data-label="Product / 产品">
                    <select class="form-select" onchange="Orders.updateStandardItem(${index}, 'product_id', this.value)">
                        <option value="">Select Product...</option>
                        ${Orders.standardProducts.map(p => `
                            <option value="${p.id}" ${p.id == item.product_id ? 'selected' : ''}>${p.name} (${p.category})</option>
                        `).join('')}
                    </select>
                </td>
                <td data-label="Price / 单价">
                    <input type="number" step="0.01" class="form-input" value="${item.unit_price}" readonly>
                </td>
                <td data-label="Qty / 数量">
                    <input type="number" class="form-input" value="${item.quantity}" min="1" onchange="Orders.updateStandardItem(${index}, 'quantity', this.value)" style="width: 80px;">
                </td>
                <td data-label="Subtotal / 小计">
                    <span id="standard-item-subtotal-${index}" class="font-bold" style="color: var(--primary);">${Utils.formatCurrency(item.unit_price * item.quantity)}</span>
                </td>
                <td>
                    <button type="button" class="btn btn-sm btn-danger" onclick="Orders.removeStandardProductRow(${index})">×</button>
                </td>
            </tr>
        `).join('');
    },

    updateStandardItem(index, field, value) {
        const item = Orders.standardItems[index];
        if (field === 'product_id') {
            item.product_id = parseInt(value);
            const product = Orders.standardProducts.find(p => p.id === item.product_id);
            if (product) {
                item.unit_price = product.selling_price;
            } else {
                item.unit_price = 0;
            }
            Orders.renderStandardItems(); // Re-render to update price field
        } else if (field === 'quantity') {
            item.quantity = parseInt(value) || 0;
            // Don't re-render entire list for quantity change, just total
        }
        Orders.calculateOrderTotal();
    },

    // --- Calculations ---

    calculateWindowPrice(win) {
        console.log('calculateWindowPrice', win);
        if (!Orders.factoryData) return 0;
        const { pricing_method, max_perimeter, over_length_unit_price, max_square_inch, min_price, combinationPricing, squareInchPricing } = Orders.factoryData;

        const width = parseFloat(win.width_inches) || 0;
        const height = parseFloat(win.height_inches) || 0;
        if (width <= 0 || height <= 0) return 0;

        const perimeter = Math.ceil((width + height) * 2);
        const area = Math.ceil(width * height);
        console.log('perimeter', perimeter);
        console.log('area', area);

        let price = 0;
        const method = pricing_method || 'combination';

        if (method === 'square_inch') {
            const rule = (squareInchPricing || []).find(r =>
                r.material_id == win.material_id &&
                r.color_id == win.color_id &&
                r.glass_type_id == win.glass_type_id &&
                r.window_type_id == win.window_type_id
            );
            if (rule) {
                price = Math.max(area * rule.price_per_sq_inch, min_price);
            }
            if (area > max_square_inch) {
                price = 999999999; // Requires quote
            }
        } else if (method === 'combination') {
            const rules = (combinationPricing || []).filter(r =>
                r.material_id == win.material_id &&
                r.color_id == win.color_id &&
                r.glass_type_id == win.glass_type_id &&
                r.window_type_id == win.window_type_id
            );
            price = min_price;
            // Sort by min_perimeter DESC to match backend check order/priority
            rules.sort((a, b) => b.min_perimeter - a.min_perimeter);

            // Find best match in range
            const match = rules.find(r => r.min_perimeter <= perimeter && (r.max_perimeter == null || r.max_perimeter >= perimeter));

            if (match) {
                price = Math.max(match.base_price, min_price);
            } else {
                // Try over-length logic
                // Sort rules by max_perimeter DESC to find the largest range rule
                const sortedByMax = [...rules].sort((a, b) => (b.max_perimeter || 0) - (a.max_perimeter || 0));
                const maxRule = sortedByMax[0];
                console.log('maxRule', maxRule);
                const factoryMax = max_perimeter || 500;
                const unitPrice = over_length_unit_price || 5;

                if (perimeter > factoryMax) {
                    price = 999999999; // Requires quote
                } else if (maxRule && maxRule.max_perimeter && perimeter > maxRule.max_perimeter) {
                    const overLength = perimeter - maxRule.max_perimeter;
                    price = maxRule.base_price + (overLength * unitPrice);
                }
            }
        }
        console.log('price', price);
        return price;
    },

    calculateOrderTotal() {
        let subtotal = 0;

        // Calculate Windows
        Orders.windows.forEach((win, index) => {
            let winTotal = 0;
            let totalWidth = 0;
            let maxHeight = 0;

            win.sub_windows.forEach(sub => {
                totalWidth += sub.width_inches || 0;
                maxHeight = Math.max(maxHeight, sub.height_inches || 0);

                let basePrice = Orders.calculateWindowPrice(sub);
                // Addons
                if (sub.addons) {
                    sub.addons.forEach(a => {
                        const addonDef = Orders.factoryData.addons.find(d => d.id === a.addon_id);
                        if (addonDef) {
                            if (addonDef.pricing_type === 'fixed') basePrice += addonDef.price;
                            if (addonDef.pricing_type === 'per_quantity') basePrice += addonDef.price * a.quantity;
                            if (addonDef.pricing_type === 'per_sq_ft') basePrice += addonDef.price * ((sub.width_inches * sub.height_inches) / 144);
                            if (addonDef.pricing_type === 'per_inch') basePrice += addonDef.price * ((sub.width_inches + sub.height_inches) * 2);
                            if (addonDef.pricing_type === 'per_sq_inch') basePrice += addonDef.price * (sub.width_inches * sub.height_inches);
                        }
                    });
                }
                sub.unit_price = basePrice;
                winTotal += basePrice;
            });

            // Assembly Fee for Combination Windows
            if (win.item_type === 'combination' && Orders.factoryData && Orders.factoryData.assemblyFees) {
                const count = win.sub_windows.length;
                const feeRule = Orders.factoryData.assemblyFees.find(f => f.sub_window_count === count);
                if (feeRule) {
                    winTotal += feeRule.assembly_fee;
                    win.assembly_fee = feeRule.assembly_fee;
                }
            }

            // Update Item Type based on sub-window count
            win.item_type = win.sub_windows.length > 1 ? 'combination' : 'single_window';
            win.unit_price = winTotal;
            const quantity = parseInt(win.quantity) || 1;
            const lineTotal = winTotal * quantity;
            win.total_price = lineTotal;

            // Update UI
            const priceEl = document.getElementById(`window-price-${index}`);
            if (priceEl) priceEl.innerText = Utils.formatCurrency(winTotal); // Updated unit price

            const subTotalEl = document.getElementById(`window-subtotal-${index}`);
            if (subTotalEl) subTotalEl.innerText = Utils.formatCurrency(lineTotal); // Updated subtotal

            const twEl = document.getElementById(`window-total-width-${index}`);
            if (twEl) twEl.innerText = totalWidth.toFixed(2) + '"';
            const thEl = document.getElementById(`window-total-height-${index}`);
            if (thEl) thEl.innerText = maxHeight.toFixed(2) + '"';

            subtotal += lineTotal;
            win.total_width = totalWidth;
            win.total_height = maxHeight;
        });

        // Calculate Standard Items
        Orders.standardItems.forEach((item, index) => {
            const lineTotal = item.unit_price * item.quantity;
            subtotal += lineTotal;
            // Update row subtotal in table
            const rowSubEl = document.getElementById(`standard-item-subtotal-${index}`);
            if (rowSubEl) rowSubEl.innerText = Utils.formatCurrency(lineTotal);
        });

        // Discount & Tax
        const discountInput = document.querySelector('input[name="discount_amount"]');
        const discount = discountInput ? parseFloat(discountInput.value) || 0 : 0;

        const taxable = Math.max(0, subtotal - discount);

        const taxFreeCheckbox = document.getElementById('is_tax_free');
        const isTaxFree = taxFreeCheckbox ? taxFreeCheckbox.checked : false;

        const taxRateData = document.querySelector('input[name="tax_rate"]');
        const taxRate = taxRateData ? parseFloat(taxRateData.value) : 0.08875; // Default

        const tax = isTaxFree ? 0 : taxable * taxRate;
        const total = taxable + tax;

        // Render Top Summary
        document.getElementById('order-subtotal').innerText = Utils.formatCurrency(subtotal);
        document.getElementById('order-tax').innerText = Utils.formatCurrency(tax);
        document.getElementById('order-total').innerText = Utils.formatCurrency(total);
        if (document.getElementById('tax-rate-display')) {
            document.getElementById('tax-rate-display').innerText = (taxRate * 100).toFixed(2) + '%';
        }
    },

    async submitOrder() {
        const form = document.getElementById('order-form');
        const formData = new FormData(form);

        const payload = {
            customer_id: formData.get('customer_id') ? parseInt(formData.get('customer_id')) : null,
            customer_type: formData.get('customer_type'),
            customer_name: formData.get('customer_name'),
            customer_phone: formData.get('customer_phone'),
            customer_address: formData.get('customer_address'),

            factory_id: parseInt(formData.get('factory_id')),
            delivery_type: formData.get('delivery_type'),
            delivery_address: formData.get('delivery_address'),
            deposit_required: parseFloat(formData.get('deposit_required')) || 0,
            notes: formData.get('notes'),
            subtotal: parseFloat(document.getElementById('order-subtotal').innerText.replace(/[^0-9.]/g, '')) || 0,
            discount_amount: parseFloat(formData.get('discount_amount')) || 0,
            tax_rate: parseFloat(formData.get('tax_rate')) || 0.08875,
            tax_amount: parseFloat(document.getElementById('order-tax').innerText.replace(/[^0-9.]/g, '')) || 0,
            total_amount: parseFloat(document.getElementById('order-total').innerText.replace(/[^0-9.]/g, '')) || 0,
            is_tax_free: document.getElementById('is_tax_free').checked,
            items: Orders.windows,
            standard_items: Orders.standardItems.filter(i => i.product_id && i.quantity > 0)
        };

        if (payload.items.length === 0 && payload.standard_items.length === 0) {
            Utils.showNotification('Please add at least one item (Window or Product) / 请添加至少一个项目', 'warning');
            return;
        }

        try {
            await Utils.request('/orders', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            Utils.showNotification('Order created successfully / 订单创建成功', 'success');
            document.querySelector('.modal-overlay').remove();

            // Switch to orders page and refresh list
            Router.navigate('orders');
        } catch (error) {
            Utils.showNotification(error.message, 'error');
            console.error(error);
        }
    },

    // --- Rest of the file (viewDetails, etc.) ---
    async viewDetails(orderId) {
        try {
            const [order, auditLogs] = await Promise.all([
                Utils.request(`/orders/${orderId}`),
                Utils.request(`/audit/entity/order/${orderId}`)
            ]);

            const content = `
                <div class="grid grid-2 gap-1 border-bottom pb-1 mb-1">
                    <div>
                        <h4 class="mb-1">📋 订单信息 Order Info</h4>
                        <p><strong>订单号 Order #:</strong> ${order.order_number}</p>
                        <p><strong>客户 Customer:</strong> ${order.customer_name}</p>
                        <p><strong>电话 Phone:</strong> ${order.customer_phone || 'N/A'}</p>
                        <p><strong>交付地址 Address:</strong> 
                            <input type="text" class="form-input inline-input" value="${order.delivery_address || (order.customer_address || '')}" 
                                   onchange="Orders.updateOrder(${order.id}, 'delivery_address', this.value)" style="width: 250px;">
                        </p>
                        <p><strong>工厂 Factory:</strong> ${order.factory_name}</p>
                        <p><strong>下单日期 Date:</strong> ${Utils.formatDate(order.order_date)}</p>
                        <p><strong>状态 Status:</strong> 
                            <select class="form-select inline-select" onchange="Orders.updateOrder(${order.id}, 'status', this.value)">
                                ${[
                    { val: 'pending', label: '新订单 (New Order)' },
                    { val: 'factory_quote_pending', label: '等工厂报价 (Waiting for Factory Quote)' },
                    { val: 'factory_confirmed', label: '确认工厂报价 (Factory Confirmed)' },
                    { val: 'customer_quote_sent', label: '已给客户报价 (Quote Sent to Customer)' },
                    { val: 'customer_confirmed', label: '客户确认 (Customer Confirmed)' },
                    { val: 'in_transit', label: '运输中 (In Transit)' },
                    { val: 'ready_for_pickup', label: '到店可取货 (Ready for Pickup)' },
                    { val: 'out_for_delivery', label: '配送中 (Out for Delivery)' },
                    { val: 'completed', label: '完成 (Completed)' },
                    { val: 'cancelled', label: '取消 (Cancelled)' }
                ].map(s => `<option value="${s.val}" ${order.status === s.val ? 'selected' : ''}>${s.label}</option>`).join('')}
                            </select>
                        </p>
                        <p><strong>交付方式 Delivery:</strong> 
                            <select class="form-select inline-select" onchange="Orders.updateOrder(${order.id}, 'delivery_type', this.value)">
                                ${[
                    { val: 'pickup', label: '自取 (Pick Up)' },
                    { val: 'store_delivery', label: '门店送货 (Store Delivery)' },
                    { val: 'factory_delivery', label: '工厂直发 (Factory Delivery)' }
                ].map(d => `<option value="${d.val}" ${order.delivery_type === d.val ? 'selected' : ''}>${d.label}</option>`).join('')}
                            </select>
                        </p>
                        <p><strong>工厂交货日期 Factory Date:</strong> 
                            <input type="date" class="form-input inline-input" value="${order.factory_delivery_date || ''}" 
                                   onchange="Orders.updateOrder(${order.id}, 'factory_delivery_date', this.value)">
                        </p>
                        <p><strong>备注 Notes:</strong> 
                            <input type="text" class="form-input inline-input" value="${order.notes || ''}" 
                                   onchange="Orders.updateOrder(${order.id}, 'notes', this.value)" style="width: 250px;">
                        </p>
                    </div>
                    <div class="summary-card">
                        <h4 class="mb-1">财务信息 Financial Info</h4>
                        <div class="summary-row">
                            <span>Subtotal / 小计:</span>
                            <span>${Utils.formatCurrency(order.subtotal)}</span>
                        </div>
                        <div class="summary-row">
                            <span>Discount / 折扣:</span>
                            <span>-${Utils.formatCurrency(order.discount_amount)}</span>
                        </div>
                        <div class="summary-row">
                            <span>Tax / 税费 (${(order.tax_rate * 100).toFixed(2)}%):</span>
                            <span>${Utils.formatCurrency(order.tax_amount)} ${order.is_tax_free ? '(免税/Wholesale)' : ''}</span>
                        </div>
                        <div class="summary-row summary-total">
                            <span>Total / 总金额:</span>
                            <span>${Utils.formatCurrency(order.total_amount)}</span>
                        </div>
                        
                        <div style="margin-top: var(--spacing-md); padding-top: var(--spacing-md); border-top: 1px dashed var(--border);">
                            <div class="summary-row">
                                <span>Deposit Required / 应付押金:</span>
                                <span>${Utils.formatCurrency(order.deposit_required)}</span>
                            </div>
                            <div class="summary-row">
                                <span>Paid / 已付金额:</span>
                                <span style="color: var(--success); font-weight: bold;">${Utils.formatCurrency(order.paid_amount)}</span>
                            </div>
                            <div class="summary-row">
                                <span>Remaining / 剩余金额:</span>
                                <strong style="color: var(--warning);">${Utils.formatCurrency(order.remaining_amount)}</strong>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mt-2">
                    <div class="flex-between mb-1">
                        <h4 class="mb-0">💳 支付记录 Payments</h4>
                        <button class="btn btn-sm btn-success" onclick="Orders.showPaymentModal(${orderId})">
                            Pay / 付款
                        </button>
                    </div>
                    ${order.payments && order.payments.length > 0 ? `
                        <div class="table-wrapper">
                            <table class="table">
                            <thead>
                                <tr>
                                    <th>日期 Date</th>
                                    <th>金额 Amount</th>
                                    <th>方式 Method</th>
                                    <th>备注 Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.payments.map(p => `
                                    <tr>
                                        <td data-label="日期">${Utils.formatDate(p.payment_date)}</td>
                                        <td data-label="金额">${Utils.formatCurrency(p.amount)}</td>
                                        <td data-label="方式">${p.payment_method || 'N/A'}</td>
                                        <td data-label="备注">${p.notes || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        </div>
                    ` : '<p style="color: var(--text-muted);">暂无支付记录 No payment records</p>'}
                </div>
                <div class="mt-1">
                    <h4 class="mb-1">🪟 窗户明细 Windows</h4>
                    ${order.windows && order.windows.length > 0 ? order.windows.map(win => `
                        <div class="card shadow-sm mb-1 pb-1">
                            <div class="flex-between">
                                <strong>Window #${win.window_number}</strong>
                                <strong>QTY: ${win.quantity}</strong>
                                <span class="badge badge-info">${win.item_type === 'combination' ? '组合窗 Combination' : '单窗 Single'}</span>
                            </div>
                            ${win.item_type === 'combination' ? `
                                <div class="p-1 mt-1 bg-tertiary rounded" style="font-size: 0.9em;">
                                    <strong>Total Width 总宽:</strong> ${win.sub_windows.reduce((sum, s) => sum + (s.width_inches || 0), 0).toFixed(2)}" | 
                                    <strong>Total Height 总高:</strong> ${Math.max(...win.sub_windows.map(s => s.height_inches || 0)).toFixed(2)}"
                                </div>
                            ` : ''}
                            <div class="p-1 mt-1 bg-tertiary rounded" style="font-size: 0.9em;">Price 价格: <span class="font-bold" style="color: var(--primary);">${Utils.formatCurrency(win.total_price)}</span></div>
                            
                            <div style="margin-top: var(--spacing-sm); padding-left: var(--spacing-md); border-left: 2px solid var(--border);">
                                ${win.sub_windows.map((sub, idx) => `
                                    <div style="margin-bottom: 10px; font-size: 0.9em; color: var(--text-secondary);">
                                        Width 宽 ${sub.width_inches}" × Height 高 ${sub.height_inches}"
                                        <br>
                                        ${(() => {
                        const f = (zh, en) => (zh && en) ? `${zh} (${en})` : (zh || en || 'N/A');
                        return `${f(sub.material_name_zh, sub.material_name_en)} | ${f(sub.color_name_zh, sub.color_name_en)} | ${f(sub.glass_name_zh, sub.glass_name_en)} | ${f(sub.window_type_name_zh, sub.window_type_name_en)}`;
                    })()}
                                        ${sub.addons && sub.addons.length > 0 ? `
                                            <div style="margin-top: 5px; font-size: 0.9em; color: var(--primary);">
                                                <strong>额外配置 (Add-ons):</strong>
                                                ${sub.addons.map(a => `
                                                    <span class="badge badge-info" style="margin-right: 5px;">
                                                        ${a.name_zh} / ${a.name_en} (${a.quantity})
                                                    </span>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('') : '<p class="text-muted">无窗户订单 No window items</p>'}
                </div>

                <div class="mt-2">
                    <h4 class="mb-1">📦 标准产品 Standard Products</h4>
                    ${order.standard_items && order.standard_items.length > 0 ? `
                        <div class="table-wrapper">
                            <table class="table">
                            <thead>
                                <tr>
                                    <th>产品名称 Product Name</th>
                                    <th>分类 Category</th>
                                    <th>数量 Qty</th>
                                    <th>单价 Unit Price</th>
                                    <th>小计 Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.standard_items.map(item => `
                                    <tr>
                                        <td data-label="产品名称">${item.product_name}</td>
                                        <td data-label="分类">${item.category}</td>
                                        <td data-label="数量">${item.quantity} ${item.default_unit || ''}</td>
                                        <td data-label="单价">${Utils.formatCurrency(item.unit_price)}</td>
                                        <td data-label="小计">${Utils.formatCurrency(item.total_price)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            </table>
                        </div>
                    ` : '<p style="color: var(--text-muted);">无标准产品项目 No standard products</p>'}
                </div>

                

                ${Auth.role === 'boss' ? `
                    <div class="mt-2 text-muted" style="border-top: 1px solid var(--border); padding-top: var(--spacing-lg);">
                        <h4 class="mb-1">📋 操作历史 / Operation History</h4>
                        ${auditLogs && auditLogs.length > 0 ? `
                            <div class="table-wrapper">
                                <table class="table">
                                <thead>
                                    <tr>
                                        <th>时间 Time</th>
                                        <th>用户 User</th>
                                        <th>操作 Action</th>
                                        <th>IP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${auditLogs.map(log => {
                        const actionBadge = {
                            'CREATE': '<span class="badge badge-success">CREATE</span>',
                            'UPDATE': '<span class="badge badge-warning">UPDATE</span>',
                            'DELETE': '<span class="badge badge-danger">DELETE</span>',
                            'UPLOAD': '<span class="badge badge-info">UPLOAD</span>'
                        }[log.action] || `<span class="badge">${log.action}</span>`;

                        return `
                                            <tr>
                                                <td data-label="时间 Time" style="font-size: 0.85em;">${new Date(log.created_at).toLocaleString('zh-CN')}</td>
                                                <td data-label="用户 User">${Utils.escapeHtml(log.username)}</td>
                                                <td data-label="操作 Action">${actionBadge}</td>
                                                <td data-label="IP" style="font-size: 0.85em; color: var(--text-muted);">${log.ip_address || '-'}</td>
                                            </tr>
                                        `}).join('')}
                                </tbody>
                                </table>
                            </div>
                        ` : '<p style="font-size: 0.9em;">暂无操作记录 No logs</p>'}
                    </div>
                ` : ''}
            `;

            const footer = `
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">关闭 Close</button>
                <button class="btn btn-primary" onclick="Orders.generatePDF(${orderId})">生成PDF (Generate PDF)</button>
            `;

            Utils.createModal(`订单详情 Order Details #${order.order_number}`, content, footer, 'modal-lg');
        } catch (error) {
            console.error('Error in viewDetails:', error);
            Utils.showNotification('无法加载订单详情: ' + error.message, 'error');
        }
    },
    async updateOrder(orderId, field, value) {
        try {
            const payload = { [field]: value };
            const response = await Utils.request(`/orders/${orderId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            if (response.success) {
                Utils.showNotification('Order updated / 订单已更新', 'success');
            }
        } catch (error) {
            Utils.showNotification(error.message, 'error');
            console.error('Update failed:', error);
        }
    },

    async showPaymentModal(orderId) {
        const content = `
            <form id="payment-form">
                <div class="form-group">
                    <label class="form-label">付款金额 Amount *</label>
                    <input type="number" step="0.01" name="amount" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">付款日期 Date</label>
                    <input type="date" name="payment_date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label class="form-label">付款方式 Method</label>
                    <select name="payment_method" class="form-select">
                        <option value="现金">现金 Cash</option>
                        <option value="转账">转账 Transfer</option>
                        <option value="支票">支票 Check</option>
                        <option value="其他">其他 Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">备注 Note</label>
                    <textarea name="notes" class="form-textarea"></textarea>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">取消 Cancel</button>
            <button class="btn btn-primary" onclick="Orders.savePayment(${orderId})">保存 Save</button>
        `;

        Utils.createModal('添加付款记录 Add Payment', content, footer);
    },

    async savePayment(orderId) {
        const form = document.getElementById('payment-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        try {
            await Utils.request(`/orders/${orderId}/payments`, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            Utils.showNotification('付款记录添加成功 Payment saved', 'success');

            // Close all overlays to start fresh
            document.querySelectorAll('.modal-overlay').forEach(el => el.remove());

            // Refresh underlying page
            if (AppState.currentPage === 'orders') {
                Router.navigate('orders');
            }

            // Re-open details modal with fresh data
            setTimeout(() => {
                Orders.viewDetails(orderId);
            }, 500);

        } catch (error) {
            Utils.showNotification(error.message, 'error');
        }
    },

    async generatePDF(orderId) {
        try {
            Utils.showLoading();
            const response = await fetch(`${API_BASE}/orders/${orderId}/invoice`);

            if (!response.ok) {
                throw new Error('PDF生成失败');
            }
            const filename = response.headers.get('Content-Disposition').split('filename=')[1];
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);

            Utils.showNotification('PDF生成成功', 'success');
        } catch (error) {
            Utils.showNotification(error.message, 'error');
        } finally {
            Utils.hideLoading();
        }
    },




};
