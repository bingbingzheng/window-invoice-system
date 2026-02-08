// 客户管理模块
const Customers = {
    async render(content) {
        try {
            const customers = await Utils.request('/customers');
            AppState.customers = customers;

            content.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">客户管理</h2>
                        <button class="btn btn-primary" onclick="Customers.showAddModal()">
                            <span>➕</span> 添加客户
                        </button>
                    </div>
                    
                    <div class="table-wrapper">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>姓名/公司</th>
                                    <th>电话</th>
                                    <th>地址</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${customers.map(customer => `
                                    <tr>
                                        <td data-label="姓名/公司"><strong>${customer.name}</strong></td>
                                        <td data-label="电话">${customer.phone || 'N/A'}</td>
                                        <td data-label="地址">${customer.address || 'N/A'}</td>
                                        <td data-label="操作">
                                            <button class="btn btn-sm btn-secondary" onclick="Customers.showEditModal(${customer.id})">编辑</button>
                                            <button class="btn btn-sm btn-secondary" onclick="Customers.viewOrders(${customer.id})">订单</button>
                                            <button class="btn btn-sm btn-danger" onclick="Customers.delete(${customer.id})">删除</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            content.innerHTML = '<div class="card"><p>加载客户列表失败</p></div>';
        }
    },

    showAddModal() {
        const content = `
            <form id="customer-form">
                <div class="form-group">
                    <label class="form-label">姓名/公司名 *</label>
                    <input type="text" name="name" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">电话 *</label>
                    <input type="tel" name="phone" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">地址</label>
                    <input type="text" name="address" class="form-input">
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="Customers.save()">保存</button>
        `;

        Utils.createModal('添加客户', content, footer);
    },

    async showEditModal(id) {
        const customer = await Utils.request(`/customers/${id}`);

        const content = `
            <form id="customer-form">
                <input type="hidden" name="id" value="${customer.id}">
                <div class="form-group">
                    <label class="form-label">姓名/公司名 *</label>
                    <input type="text" name="name" class="form-input" value="${customer.name}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">电话</label>
                    <input type="tel" name="phone" class="form-input" value="${customer.phone || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">地址</label>
                    <input type="text" name="address" class="form-input" value="${customer.address || ''}">
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">取消</button>
            <button class="btn btn-primary" onclick="Customers.save()">保存</button>
        `;

        Utils.createModal('编辑客户', content, footer);
    },

    async save() {
        const form = document.getElementById('customer-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        try {
            if (data.id) {
                await Utils.request(`/customers/${data.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                });
                Utils.showNotification('客户更新成功', 'success');
            } else {
                await Utils.request('/customers', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                Utils.showNotification('客户添加成功', 'success');
            }

            document.querySelector('.modal-overlay').remove();
            Router.navigate('customers');
        } catch (error) {
            // Error already shown by Utils.request
        }
    },

    async delete(id) {
        if (!confirm('确定要删除此客户吗？')) return;

        try {
            await Utils.request(`/customers/${id}`, { method: 'DELETE' });
            Utils.showNotification('客户删除成功', 'success');
            Router.navigate('customers');
        } catch (error) {
            // Error already shown by Utils.request
        }
    },

    async viewOrders(id) {
        try {
            const orders = await Utils.request(`/customers/${id}/orders`);
            const customer = AppState.customers.find(c => c.id === id);

            const content = `
                <h3>${customer.name} 的订单历史</h3>
                <div class="table-wrapper">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>订单号</th>
                                <th>日期</th>
                                <th>工厂</th>
                                <th>金额</th>
                                <th>状态</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${orders.length > 0 ? orders.map(order => `
                                <tr>
                                    <td data-label="订单号">${order.order_number}</td>
                                    <td data-label="日期">${Utils.formatDate(order.order_date)}</td>
                                    <td data-label="工厂">${order.factory_name}</td>
                                    <td data-label="金额">${Utils.formatCurrency(order.total_amount)}</td>
                                    <td data-label="状态"><span class="badge badge-${order.status}">${order.status}</span></td>
                                </tr>
                            `).join('') : '<tr><td colspan="5" class="text-center">暂无订单</td></tr>'}
                        </tbody>
                    </table>
                </div>
            `;

            Utils.createModal('订单历史', content, '<button class="btn btn-secondary" onclick="this.closest(\'.modal-overlay\').remove()">关闭</button>');
        } catch (error) {
            // Error already shown
        }
    }
};
