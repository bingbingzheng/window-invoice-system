// 简化版前端 - 工厂配置和订单创建
// 这个文件替代了旧的 factories.js

console.log('Factories Module Loaded');

const Factories = {
    factoryData: null, // Store factory data globally for access

    async showPricingModal(factoryId) {
        try {
            console.log('Fetching factory data for ID:', factoryId);
            const factory = await Utils.request(`/factories/${factoryId}`);
            console.log('Factory data received:', factory);

            Factories.factoryData = factory;
            const isSqInch = factory.pricing_method === 'square_inch';

            const content = `
                <div style="max-height: 80vh; overflow-y: auto; padding-right: 10px;">
                    <p style="color: var(--text-muted); margin-bottom: var(--spacing-lg);">
                        配置工厂的所有选项和定价。当前定价方式: <strong>${isSqInch ? '面积定价 (Square Inch)' : '组合定价 (Combination)'}</strong>
                    </p>
                    
                    <div class="tabs" style="margin-bottom: var(--spacing-md); border-bottom: 1px solid var(--border);">
                        <button type="button" class="btn btn-sm btn-ghost active" onclick="Factories.switchTab(this, 'tab-options')">基础选项 Options</button>
                        <button type="button" class="btn btn-sm btn-ghost" onclick="Factories.switchTab(this, 'tab-pricing')">
                            ${isSqInch ? '面积定价 Square Inch Pricing' : '组合定价 Combination Pricing'}
                        </button>
                    </div>

                    <div id="tab-options">
                        <!-- 全局设置 -->
                        <div style="margin-bottom: var(--spacing-lg); background: var(--bg-secondary); padding: var(--spacing-sm); border-radius: var(--radius-sm);">
                            <h4>全局设置 Global Settings</h4>
                            <div class="form-group">
                                <label class="form-label">最低起步价 Minimum Price ($)</label>
                                <input type="number" class="form-input" name="min_price" value="${factory.min_price !== undefined ? factory.min_price : 0}" step="0.01">
                                <small class="text-muted">订单的最低收费标准 / Minimum charge for an order</small>
                            </div>
                            <div class="form-group">
                                <label class="form-label">超长单价 Over-length Unit Price ($/inch)</label>
                                <input type="number" class="form-input" name="over_length_unit_price" value="${factory.over_length_unit_price !== undefined ? factory.over_length_unit_price : 5}" step="0.01">
                                <small class="text-muted">超过限制尺寸的每英寸额外费用 / Extra cost per inch exceeding limit</small>
                            </div>

                             ${!isSqInch ? `
                            <div class="form-group">
                                <label class="form-label">最大周长 Max Perimeter (inches)</label>
                                <input type="number" class="form-input" name="max_perimeter" value="${factory.max_perimeter !== undefined ? factory.max_perimeter : 500}" step="0.1">
                                <small class="text-muted">超过此周长将显示"需要报价" / Exceeding this will show "Need Quote"</small>
                            </div>
                            ` : `
                            <div class="form-group">
                                <label class="form-label">最大面积 Max Square Inch (sq in)</label>
                                <input type="number" class="form-input" name="max_square_inch" value="${factory.max_square_inch !== undefined ? factory.max_square_inch : 5000}" step="1">
                                <small class="text-muted">超过此面积将显示"需要报价" / Exceeding this will show "Need Quote"</small>
                            </div>
                            `}
                        </div>

                        <!-- 材质 -->
                        <h4>材质 Materials</h4>
                        <div id="materials-list">
                            ${(factory.materials || []).map((m, i) => `
                                <div class="grid grid-2 gap-1" style="margin-bottom: var(--spacing-sm); position: relative;">
                                    <input type="hidden" name="mat_id_${i}" value="${m.id}">
                                    <input type="text" class="form-input" name="mat_zh_${i}" value="${m.name_zh}" placeholder="中文">
                                    <div class="flex gap-1">
                                        <input type="text" class="form-input" name="mat_en_${i}" value="${m.name_en}" placeholder="English">
                                        <button type="button" class="btn btn-sm btn-danger btn-icon" onclick="this.closest('.grid').remove()" title="删除 Delete">×</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="Factories.addMaterial()">+ 添加</button>
                        
                        <hr style="margin: var(--spacing-lg) 0;">
                        
                        <!-- 颜色 -->
                        <h4>颜色 Colors</h4>
                        <div id="colors-list">
                            ${(factory.colors || []).map((c, i) => `
                                <div class="grid grid-2 gap-1" style="margin-bottom: var(--spacing-sm); position: relative;">
                                    <input type="hidden" name="color_id_${i}" value="${c.id}">
                                    <input type="text" class="form-input" name="color_zh_${i}" value="${c.name_zh}" placeholder="中文">
                                    <div class="flex gap-1">
                                        <input type="text" class="form-input" name="color_en_${i}" value="${c.name_en}" placeholder="English">
                                        <button type="button" class="btn btn-sm btn-danger btn-icon" onclick="this.closest('.grid').remove()" title="删除 Delete">×</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="Factories.addColor()">+ 添加</button>
                        
                        <hr style="margin: var(--spacing-lg) 0;">
                        
                        <!-- 玻璃类型 -->
                        <h4>玻璃类型 Glass Types</h4>
                        <div id="glass-list">
                            ${(factory.glassTypes || []).map((g, i) => `
                                <div class="grid grid-2 gap-1" style="margin-bottom: var(--spacing-sm); position: relative;">
                                    <input type="hidden" name="glass_id_${i}" value="${g.id}">
                                    <input type="text" class="form-input" name="glass_zh_${i}" value="${g.name_zh}" placeholder="中文">
                                    <div class="flex gap-1">
                                        <input type="text" class="form-input" name="glass_en_${i}" value="${g.name_en}" placeholder="English">
                                        <button type="button" class="btn btn-sm btn-danger btn-icon" onclick="this.closest('.grid').remove()" title="删除 Delete">×</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="Factories.addGlass()">+ 添加</button>
                        
                        <hr style="margin: var(--spacing-lg) 0;">
                        
                        <!-- 窗户类型 -->
                        <h4>窗户类型 Window Types</h4>
                        <div id="window-types-list">
                            ${(factory.windowTypes || []).map((w, i) => `
                                <div class="grid grid-2 gap-1" style="margin-bottom: var(--spacing-sm); position: relative;">
                                    <input type="hidden" name="wtype_id_${i}" value="${w.id}">
                                    <input type="text" class="form-input" name="wtype_zh_${i}" value="${w.name_zh}" placeholder="中文">
                                    <div class="flex gap-1">
                                        <input type="text" class="form-input" name="wtype_en_${i}" value="${w.name_en}" placeholder="English">
                                        <button type="button" class="btn btn-sm btn-danger btn-icon" onclick="this.closest('.grid').remove()" title="删除 Delete">×</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="Factories.addWindowType()">+ 添加</button>
                        
                        <hr style="margin: var(--spacing-lg) 0;">
                        
                        <!-- Addons -->
                        <h4>额外选项 Addons</h4>
                        <div id="addons-list">
                            ${(factory.addons || []).map((a, i) => `
                                <div class="grid grid-4 gap-1" style="margin-bottom: var(--spacing-sm); position: relative;">
                                    <input type="hidden" name="addon_id_${i}" value="${a.id}">
                                    <input type="text" class="form-input" name="addon_zh_${i}" value="${a.name_zh}" placeholder="中文">
                                    <input type="text" class="form-input" name="addon_en_${i}" value="${a.name_en}" placeholder="English">
                                    <select class="form-select" name="addon_type_${i}">
                                        <option value="per_quantity" ${a.pricing_type === 'per_quantity' ? 'selected' : ''}>按数量</option>
                                        <option value="fixed" ${a.pricing_type === 'fixed' ? 'selected' : ''}>固定价格</option>
                                        <option value="per_inch" ${a.pricing_type === 'per_inch' ? 'selected' : ''}>按英寸</option>
                                    </select>
                                    <div class="flex gap-1">
                                        <input type="number" class="form-input" name="addon_price_${i}" value="${a.price}" placeholder="价格">
                                        <button type="button" class="btn btn-sm btn-danger btn-icon" onclick="this.closest('.grid').remove()" title="删除 Delete">×</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="Factories.addAddon()">+ 添加</button>
                        
                        <hr style="margin: var(--spacing-lg) 0;">
                        
                        <!-- 组合窗组装费 Combination Window Assembly Fees -->
                        <h4>组合窗组装费 Combination Window Assembly Fees</h4>
                        <div class="alert alert-info" style="margin-bottom: var(--spacing-md);">
                            根据子窗数量设置固定组装费用。例如：2个子窗 = $10，3个子窗 = $15
                        </div>
                        <div id="assembly-fees-list">
                            ${(factory.assemblyFees || []).map((f, i) => `
                                <div class="grid grid-2 gap-1" style="margin-bottom: var(--spacing-sm); position: relative;">
                                    <input type="number" class="form-input" name="assembly_count_${i}" value="${f.sub_window_count}" placeholder="子窗数量" min="2">
                                    <div class="flex gap-1">
                                        <input type="number" class="form-input" name="assembly_fee_${i}" value="${f.assembly_fee}" placeholder="组装费 ($)" step="0.01">
                                        <button type="button" class="btn btn-sm btn-danger btn-icon" onclick="this.closest('.grid').remove()" title="删除 Delete">×</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="Factories.addAssemblyFee()">+ 添加</button>
                    </div>

                    <div id="tab-pricing" class="hidden">
                        <div class="alert alert-info" style="margin-bottom: var(--spacing-md);">
                            ${isSqInch ?
                    '面积定价规则：根据 材质+颜色+玻璃+类型 组合，按每平方英寸单价计算。' :
                    '组合定价规则：当订单满足特定 材质+颜色+玻璃+类型+周长 时，使用设定的基础价格。'}
                        </div>
                        
                        <div style="margin-bottom: var(--spacing-md); background: var(--bg-secondary); padding: var(--spacing-sm); border-radius: var(--radius-sm);">
                            <h5>添加新规则 Add New Rule</h5>
                            <div class="grid grid-4 gap-1" style="margin-bottom: var(--spacing-sm);">
                                <select class="form-select" id="new-pricing-material">
                                    <option value="">材质 Material</option>
                                    ${(factory.materials || []).map(m => `<option value="${m.id}">${m.name_zh}</option>`).join('')}
                                </select>
                                <select class="form-select" id="new-pricing-color">
                                    <option value="">颜色 Color</option>
                                    ${(factory.colors || []).map(c => `<option value="${c.id}">${c.name_zh}</option>`).join('')}
                                </select>
                                <select class="form-select" id="new-pricing-glass">
                                    <option value="">玻璃 Glass</option>
                                    ${(factory.glassTypes || []).map(g => `<option value="${g.id}">${g.name_zh}</option>`).join('')}
                                </select>
                                <select class="form-select" id="new-pricing-type">
                                    <option value="">类型 Type</option>
                                    ${(factory.windowTypes || []).map(w => `<option value="${w.id}">${w.name_zh}</option>`).join('')}
                                </select>
                            </div>
                            
                            ${isSqInch ? `
                                <div class="grid grid-1 gap-1">
                                    <input type="number" class="form-input" id="new-pricing-price" placeholder="每平方英寸单价 Price per Sq Inch ($)" step="0.01">
                                </div>
                            ` : `
                                <div class="grid grid-3 gap-1">
                                    <input type="number" class="form-input" id="new-pricing-min" placeholder="Min Perimeter">
                                    <input type="number" class="form-input" id="new-pricing-max" placeholder="Max Perimeter">
                                    <input type="number" class="form-input" id="new-pricing-price" placeholder="Base Price $" step="0.01">
                                </div>
                            `}
                            
                            <button type="button" class="btn btn-primary btn-sm" style="margin-top: var(--spacing-sm);" onclick="Factories.addPricingRule()">+ 添加规则 Add Rule</button>
                        </div>

                        <div class="table-container">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>材质 Material</th>
                                        <th>颜色 Color</th>
                                        <th>玻璃 Glass</th>
                                        <th>类型 Type</th>
                                        ${isSqInch ? '<th>单价/SqInch Price</th>' : '<th>周长范围 Perimeter Range</th><th>基础价格 Base Price</th>'}
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody id="pricing-rules-body">
                                    ${(isSqInch ? (factory.squareInchPricing || []) : (factory.combinationPricing || [])).map((p, i) => Factories.renderPricingRow(p, i)).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            const footer = `
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">取消</button>
                <button class="btn btn-primary" onclick="Factories.saveAll(${factoryId})">保存全部 Save All</button>
            `;

            Utils.createModal('工厂配置 Factory Configuration', content, footer, 'modal-lg');
        } catch (error) {
            console.error(error);
            Utils.showNotification('加载失败 / Load failed', 'error');
        }
    },

    switchTab(btn, tabId) {
        // Update buttons
        btn.parentElement.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update tabs
        document.getElementById('tab-options').classList.add('hidden');
        document.getElementById('tab-pricing').classList.add('hidden');
        document.getElementById(tabId).classList.remove('hidden');
    },

    // UNIFIED: Render Pricing Row
    renderPricingRow(p, index) {
        const data = Factories.factoryData;
        if (!data) return `<tr class="error"><td>Error: Data missing</td></tr>`;

        const isSqInch = data.pricing_method === 'square_inch';

        // Helper to name from ID
        const getName = (items, id) => {
            const item = (items || []).find(i => i.id == id);
            return item ? item.name_zh : id;
        };

        const commonCells = `
            <td data-label="材质 Material">${getName(data.materials, p.material_id)}</td>
            <td data-label="颜色 Color">${getName(data.colors, p.color_id)}</td>
            <td data-label="玻璃 Glass">${getName(data.glassTypes, p.glass_type_id)}</td>
            <td data-label="类型 Type">${getName(data.windowTypes, p.window_type_id)}</td>
        `;

        const commonInputs = `
            <input type="hidden" name="pricing_mat_${index}" value="${p.material_id}">
            <input type="hidden" name="pricing_col_${index}" value="${p.color_id}">
            <input type="hidden" name="pricing_glass_${index}" value="${p.glass_type_id}">
            <input type="hidden" name="pricing_type_${index}" value="${p.window_type_id}">
        `;

        let specificCells = '';
        let specificInputs = '';

        if (isSqInch) {
            specificCells = `<td data-label="单价/SqInch Price">$${p.price_per_sq_inch}</td>`;
            specificInputs = `<input type="hidden" name="pricing_price_${index}" value="${p.price_per_sq_inch}">`;
        } else {
            const maxDisplay = p.max_perimeter === null || p.max_perimeter === '' ? '∞' : p.max_perimeter;
            specificCells = `
                <td data-label="周长范围 Perimeter Range">${p.min_perimeter} - ${maxDisplay}</td>
                <td data-label="基础价格 Base Price">$${p.base_price}</td>
            `;
            specificInputs = `
                <input type="hidden" name="pricing_min_${index}" value="${p.min_perimeter}">
                <input type="hidden" name="pricing_max_${index}" value="${p.max_perimeter || ''}">
                <input type="hidden" name="pricing_price_${index}" value="${p.base_price}">
            `;
        }

        return `
            <tr class="pricing-row" data-index="${index}">
                ${commonCells}
                ${specificCells}
                <td data-label="操作">
                    <button class="btn btn-xs btn-danger" onclick="this.closest('tr').remove()">×</button>
                </td>
                ${commonInputs}
                ${specificInputs}
            </tr>
        `;
    },

    // UNIFIED: Add Pricing Rule
    addPricingRule() {
        try {
            const matId = document.getElementById('new-pricing-material').value;
            const colId = document.getElementById('new-pricing-color').value;
            const glassId = document.getElementById('new-pricing-glass').value;
            const typeId = document.getElementById('new-pricing-type').value;
            const price = document.getElementById('new-pricing-price').value; // Unified price input ID

            if (!matId || !colId || !glassId || !typeId || !price) {
                Utils.showNotification('请填写所有必填项 / Please fill all required fields', 'warning');
                return;
            }

            const factory = Factories.factoryData;
            const isSqInch = factory.pricing_method === 'square_inch';

            const newRule = {
                material_id: parseInt(matId),
                color_id: parseInt(colId),
                glass_type_id: parseInt(glassId),
                window_type_id: parseInt(typeId),
            };

            if (isSqInch) {
                newRule.price_per_sq_inch = parseFloat(price);
            } else {
                const min = document.getElementById('new-pricing-min').value;
                if (!min) {
                    Utils.showNotification('请输入最小周长 / Please enter min perimeter', 'warning');
                    return;
                }
                const max = document.getElementById('new-pricing-max').value;
                newRule.min_perimeter = parseFloat(min);
                newRule.max_perimeter = max ? parseFloat(max) : null;
                newRule.base_price = parseFloat(price);

                // Check for overlaps (Combination only)
                const existingRules = Factories.collectRulesFromDOM();
                for (const rule of existingRules) {
                    if (Factories.isOverlap(newRule, rule)) {
                        Utils.showNotification('错误：周长范围重叠 / Error: Perimeter range overlaps', 'error');
                        return;
                    }
                }
            }

            // Check for exact duplicates for SqInch (Combination handled by overlap)
            if (isSqInch) {
                const existingRules = Factories.collectRulesFromDOM();
                for (const rule of existingRules) {
                    if (rule.material_id === newRule.material_id &&
                        rule.color_id === newRule.color_id &&
                        rule.glass_type_id === newRule.glass_type_id &&
                        rule.window_type_id === newRule.window_type_id) {
                        Utils.showNotification('该组合已存在 / Combination exists', 'error');
                        return;
                    }
                }
            }

            const tbody = document.getElementById('pricing-rules-body');
            const index = Date.now();
            const rowHtml = Factories.renderPricingRow(newRule, index);
            tbody.insertAdjacentHTML('beforeend', rowHtml);

            // Clear inputs
            document.getElementById('new-pricing-price').value = '';
            if (!isSqInch) {
                document.getElementById('new-pricing-min').value = '';
                document.getElementById('new-pricing-max').value = '';
            }

        } catch (error) {
            console.error('Error in addPricingRule:', error);
            Utils.showNotification('添加失败: ' + error.message, 'error');
        }
    },

    // Helper to check if two ranges overlap
    isOverlap(r1, r2) {
        // Check if configuration matches
        if (r1.material_id !== r2.material_id ||
            r1.color_id !== r2.color_id ||
            r1.glass_type_id !== r2.glass_type_id ||
            r1.window_type_id !== r2.window_type_id) {
            return false;
        }

        // Check perimeter overlap
        // Treat null max as Infinity
        const min1 = r1.min_perimeter;
        const max1 = r1.max_perimeter === null || r1.max_perimeter === '' ? Infinity : r1.max_perimeter;
        const min2 = r2.min_perimeter;
        const max2 = r2.max_perimeter === null || r2.max_perimeter === '' ? Infinity : r2.max_perimeter;

        // Use <= to catch boundary overlaps (e.g. 100 in 0-100 and 100-200)
        return Math.max(min1, min2) <= Math.min(max1, max2);
    },

    // UNIFIED: Collect Rules
    collectRulesFromDOM() {
        const rules = [];
        const pricingRows = document.querySelectorAll('.pricing-row');
        const isSqInch = Factories.factoryData.pricing_method === 'square_inch';

        pricingRows.forEach(row => {
            const index = row.dataset.index;

            // Collect common
            const base = {
                material_id: parseInt(row.querySelector(`input[name="pricing_mat_${index}"]`).value),
                color_id: parseInt(row.querySelector(`input[name="pricing_col_${index}"]`).value),
                glass_type_id: parseInt(row.querySelector(`input[name="pricing_glass_${index}"]`).value),
                window_type_id: parseInt(row.querySelector(`input[name="pricing_type_${index}"]`).value),
            };

            if (isSqInch) {
                base.price_per_sq_inch = parseFloat(row.querySelector(`input[name="pricing_price_${index}"]`).value);
                rules.push(base);
            } else {
                base.min_perimeter = parseFloat(row.querySelector(`input[name="pricing_min_${index}"]`).value);
                const maxVal = row.querySelector(`input[name="pricing_max_${index}"]`).value;
                base.max_perimeter = maxVal ? parseFloat(maxVal) : null;
                base.base_price = parseFloat(row.querySelector(`input[name="pricing_price_${index}"]`).value);
                rules.push(base);
            }
        });
        return rules;
    },



    addMaterial() {
        const container = document.getElementById('materials-list');
        const idx = container.children.length;
        const div = document.createElement('div');
        div.className = 'grid grid-2 gap-1';
        div.style.marginBottom = 'var(--spacing-sm)';
        div.innerHTML = `
            <input type="text" class="form-input" name="mat_zh_${idx}" placeholder="中文">
            <div class="flex gap-1">
                <input type="text" class="form-input" name="mat_en_${idx}" placeholder="English">
                <button type="button" class="btn btn-sm btn-danger btn-icon" onclick="this.closest('.grid').remove()" title="删除 Delete">×</button>
            </div>
        `;
        container.appendChild(div);
    },

    addColor() {
        const container = document.getElementById('colors-list');
        const idx = container.children.length;
        const div = document.createElement('div');
        div.className = 'grid grid-2 gap-1';
        div.style.marginBottom = 'var(--spacing-sm)';
        div.innerHTML = `
            <input type="text" class="form-input" name="color_zh_${idx}" placeholder="中文">
            <div class="flex gap-1">
                <input type="text" class="form-input" name="color_en_${idx}" placeholder="English">
                <button type="button" class="btn btn-sm btn-danger btn-icon" onclick="this.closest('.grid').remove()" title="删除 Delete">×</button>
            </div>
        `;
        container.appendChild(div);
    },

    addGlass() {
        const container = document.getElementById('glass-list');
        const idx = container.children.length;
        const div = document.createElement('div');
        div.className = 'grid grid-2 gap-1';
        div.style.marginBottom = 'var(--spacing-sm)';
        div.innerHTML = `
            <input type="text" class="form-input" name="glass_zh_${idx}" placeholder="中文">
            <div class="flex gap-1">
                <input type="text" class="form-input" name="glass_en_${idx}" placeholder="English">
                <button type="button" class="btn btn-sm btn-danger btn-icon" onclick="this.closest('.grid').remove()" title="删除 Delete">×</button>
            </div>
        `;
        container.appendChild(div);
    },

    addWindowType() {
        const container = document.getElementById('window-types-list');
        const idx = container.children.length;
        const div = document.createElement('div');
        div.className = 'grid grid-2 gap-1';
        div.style.marginBottom = 'var(--spacing-sm)';
        div.innerHTML = `
            <input type="text" class="form-input" name="wtype_zh_${idx}" placeholder="中文">
            <div class="flex gap-1">
                <input type="text" class="form-input" name="wtype_en_${idx}" placeholder="English">
                <button type="button" class="btn btn-sm btn-danger btn-icon" onclick="this.closest('.grid').remove()" title="删除 Delete">×</button>
            </div>
        `;
        container.appendChild(div);
    },

    addAddon() {
        const container = document.getElementById('addons-list');
        const idx = container.children.length;
        const div = document.createElement('div');
        div.className = 'grid grid-4 gap-1';
        div.style.marginBottom = 'var(--spacing-sm)';
        div.innerHTML = `
            <input type="text" class="form-input" name="addon_zh_${idx}" placeholder="中文">
            <input type="text" class="form-input" name="addon_en_${idx}" placeholder="English">
            <select class="form-select" name="addon_type_${idx}">
                <option value="per_quantity">按数量 (per quantity)</option>
                <option value="fixed">固定价格 (fixed)</option>
                <option value="per_inch">按英寸 (per inch)</option>
                <option value="per_sqft">按平方英尺 (per sqft)</option>
                <option value="per_sqft">按平方英尺 (per sqft)</option>
            </select>
            <div class="flex gap-1">
                <input type="number" class="form-input" name="addon_price_${idx}" placeholder="价格">
                <button type="button" class="btn btn-sm btn-danger btn-icon" onclick="this.closest('.grid').remove()" title="删除 Delete">×</button>
            </div>
        `;
        container.appendChild(div);
    },

    addAssemblyFee() {
        const container = document.getElementById('assembly-fees-list');
        const idx = container.children.length;
        const div = document.createElement('div');
        div.className = 'grid grid-2 gap-1';
        div.style.marginBottom = 'var(--spacing-sm)';
        div.innerHTML = `
            <input type="number" class="form-input" name="assembly_count_${idx}" placeholder="子窗数量" min="2">
            <div class="flex gap-1">
                <input type="number" class="form-input" name="assembly_fee_${idx}" placeholder="组装费 ($)" step="0.01">
                <button type="button" class="btn btn-sm btn-danger btn-icon" onclick="this.closest('.grid').remove()" title="删除 Delete">×</button>
            </div>
        `;
        container.appendChild(div);
    },

    // Missing render method to display the factory list
    async render(content) {
        try {
            const factories = await Utils.request('/factories');

            content.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">工厂管理 Factories</h2>
                        <button class="btn btn-primary" onclick="Factories.showAddModal()">
                            <span>➕</span> 添加工厂 Add Factory
                        </button>
                    </div>
                    
                    <div class="grid grid-2">
                        ${factories.map(factory => `
                            <div class="card">
                                <div class="flex-between">
                                    <h3>${factory.name} ${factory.is_default ? '<span class="badge badge-pending">默认 Default</span>' : ''}</h3>
                                    <div class="flex gap-1">
                                        <button class="btn btn-sm btn-secondary" onclick="Factories.showEditModal(${factory.id})">编辑 Edit</button>
                                        <button class="btn btn-sm btn-primary" onclick="Factories.showPricingModal(${factory.id})">配置 Configure</button>
                                        <button class="btn btn-sm btn-danger" onclick="Factories.delete(${factory.id})">删除 Delete</button>
                                    </div>
                                </div>
                                <p style="color: var(--text-muted); margin-top: var(--spacing-sm);">
                                    ${factory.contact_person || ''} ${factory.phone || ''} <br>
                                    <span class="badge badge-info">${factory.pricing_method === 'square_inch' ? '面积定价 Sq Inch' : '组合定价 Combination'}</span>
                                </p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } catch (error) {
            content.innerHTML = '<div class="card"><p>加载工厂列表失败 / Failed to load factories</p></div>';
        }
    },

    showAddModal() {
        const content = `
            <form id="factory-form">
                <div class="form-group">
                    <label class="form-label">工厂名称 Factory Name *</label>
                    <input type="text" name="name" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">定价方式 Pricing Method *</label>
                    <select name="pricing_method" class="form-select" required>
                        <option value="combination">组合定价 Combination Pricing (按周长)</option>
                        <option value="square_inch">面积定价 Square Inch Pricing (按面积)</option>
                    </select>
                    <small class="text-muted">选择工厂的定价计算方式 / Choose how this factory calculates pricing</small>
                </div>
                <div class="form-group">
                    <label class="form-label">
                        <input type="checkbox" name="is_default" value="1">
                        设为默认工厂 Set as Default
                    </label>
                </div>
                <div class="form-group">
                    <label class="form-label">联系人 Contact Person</label>
                    <input type="text" name="contact_person" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">电话 Phone</label>
                    <input type="tel" name="phone" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">地址 Address</label>
                    <input type="text" name="address" class="form-input">
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">取消 Cancel</button>
            <button class="btn btn-primary" onclick="Factories.save()">保存 Save</button>
        `;

        Utils.createModal('添加工厂 Add Factory', content, footer);
    },

    async showEditModal(id) {
        const factory = await Utils.request(`/factories/${id}`);

        const content = `
            <form id="factory-form">
                <input type="hidden" name="id" value="${factory.id}">
                <!-- Preserve existing values in hidden fields in case they aren't edited but needed -->
                <input type="hidden" name="over_length_unit_price" value="${factory.over_length_unit_price || 0}">
                <input type="hidden" name="max_perimeter" value="${factory.max_perimeter || 500}">
                <input type="hidden" name="max_square_inch" value="${factory.max_square_inch || 5000}">
                <input type="hidden" name="min_price" value="${factory.min_price || 0}">
                
                <div class="form-group">
                    <label class="form-label">工厂名称 Factory Name *</label>
                    <input type="text" name="name" class="form-input" value="${factory.name}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">定价方式 Pricing Method *</label>
                    <select name="pricing_method" class="form-select" required>
                        <option value="combination" ${factory.pricing_method === 'combination' ? 'selected' : ''}>组合定价 Combination Pricing (按周长)</option>
                        <option value="square_inch" ${factory.pricing_method === 'square_inch' ? 'selected' : ''}>面积定价 Square Inch Pricing (按面积)</option>
                    </select>
                    <small class="text-muted">当前: ${factory.pricing_method === 'square_inch' ? '面积定价' : '组合定价'} / Current pricing method</small>
                </div>
                <div class="form-group">
                    <label class="form-label">
                        <input type="checkbox" name="is_default" value="1" ${factory.is_default ? 'checked' : ''}>
                        设为默认工厂 Set as Default
                    </label>
                </div>
                <div class="form-group">
                    <label class="form-label">联系人 Contact Person</label>
                    <input type="text" name="contact_person" class="form-input" value="${factory.contact_person || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">电话 Phone</label>
                    <input type="tel" name="phone" class="form-input" value="${factory.phone || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">地址 Address</label>
                    <input type="text" name="address" class="form-input" value="${factory.address || ''}">
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">取消 Cancel</button>
            <button class="btn btn-primary" onclick="Factories.save()">保存 Save</button>
        `;

        Utils.createModal('编辑工厂 Edit Factory', content, footer);
    },

    async save() {
        const form = document.getElementById('factory-form');
        const formData = new FormData(form);
        const data = {
            name: formData.get('name'),
            pricing_method: formData.get('pricing_method') || 'combination',
            is_default: formData.get('is_default') ? 1 : 0,
            contact_person: formData.get('contact_person'),
            phone: formData.get('phone'),
            address: formData.get('address'),
            // Basic defaults if not provided (will be refined in showPricingModal)
            max_perimeter: parseFloat(formData.get('max_perimeter')) || 500,
            max_square_inch: parseFloat(formData.get('max_square_inch')) || 5000,
            min_price: parseFloat(formData.get('min_price')) || 0,
            over_length_unit_price: parseFloat(formData.get('over_length_unit_price')) || 0
        };

        try {
            const id = formData.get('id');
            if (id) {
                await Utils.request(`/factories/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
                Utils.showNotification('工厂更新成功 / Factory updated', 'success');
            } else {
                await Utils.request('/factories', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                Utils.showNotification('工厂添加成功 / Factory added', 'success');
            }

            document.querySelector('.modal-overlay').remove();
            Factories.render(document.getElementById('page-content'));
        } catch (error) {
            // Error already shown
        }
    },

    async delete(id) {
        if (!confirm('确定要删除此工厂吗？ / Are you sure you want to delete this factory?')) return;

        try {
            await Utils.request(`/factories/${id}`, { method: 'DELETE' });
            Utils.showNotification('工厂删除成功 / Factory deleted', 'success');
            Factories.render(document.getElementById('page-content'));
        } catch (error) {
            // Error already shown
        }
    },

    async saveAll(factoryId) {
        try {
            const factory = Factories.factoryData;
            const modal = document.querySelector('.modal');
            const isSqInch = factory.pricing_method === 'square_inch';

            // 1. Collect Global Settings
            // Note: Only collect what is visible based on pricing method
            const maxPerimeterInput = modal.querySelector('input[name="max_perimeter"]');
            const maxSquareInchInput = modal.querySelector('input[name="max_square_inch"]');
            const minPriceInput = modal.querySelector('input[name="min_price"]');
            const overLengthInput = modal.querySelector('input[name="over_length_unit_price"]');

            const globals = {
                name: factory.name, // Keep existing values
                contact_person: factory.contact_person,
                phone: factory.phone,
                address: factory.address,
                is_default: factory.is_default,
                pricing_method: factory.pricing_method,

                // New logic: capture updated values, fallback to existing
                min_price: minPriceInput ? parseFloat(minPriceInput.value) || 0 : (factory.min_price || 0),
                over_length_unit_price: overLengthInput ? parseFloat(overLengthInput.value) || 0 : (factory.over_length_unit_price || 0),

                // Specific fields
                max_perimeter: isSqInch ?
                    (factory.max_perimeter || 500) : // Don't change if hidden
                    (maxPerimeterInput ? parseFloat(maxPerimeterInput.value) || 500 : 500),

                max_square_inch: isSqInch ?
                    (maxSquareInchInput ? parseFloat(maxSquareInchInput.value) || 5000 : 5000) :
                    (factory.max_square_inch || 5000)
            };

            // 2. Collect common collections (Materials, Colors, etc.)
            const collectCommon = (listId, prefix, fields) => {
                const results = [];
                const list = document.getElementById(listId);
                if (list) {
                    list.querySelectorAll('.grid').forEach((row, idx) => {
                        const item = { id: null };
                        let isValid = true;

                        // ID input (hidden)
                        const idInput = row.querySelector(`input[name="${prefix}_id_${idx}"]`);
                        if (idInput) item.id = idInput.value || null;

                        // Other fields
                        fields.forEach(field => {
                            const input = row.querySelector(`[name="${prefix}_${field}_${idx}"]`);
                            if (input) {
                                if (field === 'zh' || field === 'en') {
                                    if (!input.value) isValid = false; // Name required
                                    item['name_' + field] = input.value;
                                } else {
                                    item[field] = input.value;
                                }
                            }
                        });

                        if (isValid) results.push(item);
                    });
                }
                return results;
            };

            const materials = collectCommon('materials-list', 'mat', ['zh', 'en']);
            const colors = collectCommon('colors-list', 'color', ['zh', 'en']);
            const glassTypes = collectCommon('glass-list', 'glass', ['zh', 'en']);
            const windowTypes = collectCommon('window-types-list', 'wtype', ['zh', 'en']);

            // Addons need special handling for select and price parse
            const addons = [];
            const addonsList = document.getElementById('addons-list');
            if (addonsList) {
                addonsList.querySelectorAll('.grid').forEach((row, idx) => {
                    const zh = row.querySelector(`[name="addon_zh_${idx}"]`)?.value;
                    const en = row.querySelector(`[name="addon_en_${idx}"]`)?.value;
                    if (zh && en) {
                        addons.push({
                            id: row.querySelector(`[name="addon_id_${idx}"]`)?.value || null,
                            name_zh: zh,
                            name_en: en,
                            pricing_type: row.querySelector(`[name="addon_type_${idx}"]`)?.value || 'fixed',
                            price: parseFloat(row.querySelector(`[name="addon_price_${idx}"]`)?.value) || 0,
                            display_order: idx
                        });
                    }
                });
            }

            // Assembly fees
            const assemblyFees = [];
            const asmList = document.getElementById('assembly-fees-list');
            if (asmList) {
                asmList.querySelectorAll('.grid').forEach((row, idx) => {
                    const count = parseInt(row.querySelector(`[name="assembly_count_${idx}"]`)?.value);
                    const fee = parseFloat(row.querySelector(`[name="assembly_fee_${idx}"]`)?.value);
                    if (count && !isNaN(fee)) {
                        assemblyFees.push({ sub_window_count: count, assembly_fee: fee });
                    }
                });
            }

            // 3. Collect Pricing Rules (Unified)
            const pricingRules = Factories.collectRulesFromDOM();

            // Validate overlaps for Combination Pricing only
            if (!isSqInch) {
                for (let i = 0; i < pricingRules.length; i++) {
                    for (let j = i + 1; j < pricingRules.length; j++) {
                        if (Factories.isOverlap(pricingRules[i], pricingRules[j])) {
                            Utils.showNotification('错误：存在重叠的定价规则，请检查 / Error: Overlapping pricing rules detected', 'error');
                            return;
                        }
                    }
                }
            }

            console.log('Saving All:', { globals, materials, pricingRules });

            // 4. Save API Calls
            // Save basic options
            await Promise.all([
                Utils.request(`/factories/${factoryId}/materials`, { method: 'POST', body: JSON.stringify({ materials }) }),
                Utils.request(`/factories/${factoryId}/colors`, { method: 'POST', body: JSON.stringify({ colors }) }),
                Utils.request(`/factories/${factoryId}/glass-types`, { method: 'POST', body: JSON.stringify({ glassTypes }) }),
                Utils.request(`/factories/${factoryId}/window-types`, { method: 'POST', body: JSON.stringify({ windowTypes }) }),
                Utils.request(`/factories/${factoryId}/addons`, { method: 'POST', body: JSON.stringify({ addons }) }),
                Utils.request(`/factories/${factoryId}/assembly-fees`, { method: 'POST', body: JSON.stringify({ assemblyFees }) })
            ]);

            // Save Pricing Rules
            if (isSqInch) {
                await Utils.request(`/factories/${factoryId}/square-inch-pricing`, {
                    method: 'POST',
                    body: JSON.stringify({ squareInchRules: pricingRules })
                });
            } else {
                await Utils.request(`/factories/${factoryId}/combination-pricing`, {
                    method: 'POST',
                    body: JSON.stringify({ combinations: pricingRules })
                });
            }

            // Save Global Settings
            await Utils.request(`/factories/${factoryId}`, {
                method: 'PUT',
                body: JSON.stringify(globals)
            });

            Utils.showNotification('保存成功 / Saved successfully', 'success');
            document.querySelector('.modal-overlay').remove();

            // Reload modal to reflect saved state
            Factories.showPricingModal(factoryId);

        } catch (error) {
            console.error('Save failed:', error);
            Utils.showNotification('保存失败 / Save failed: ' + error.message, 'error');
        }
    }
};
