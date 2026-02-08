const Delivery = {
    async render(content) {
        try {
            const orders = await Utils.request('/delivery');
            content.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">交付管理 Delivery Dashboard</h2>
                    </div>
                    <div class="form-group">
                        <button class="btn btn-primary" onclick="Delivery.editOrders()">
                            <span>➕</span> Edit Orders / 编辑订单
                        </button>
                    </div>
                    
                    ${orders.length === 0 ? `
                        <p style="text-align: center; padding: var(--spacing-xl); color: var(--text-muted);">
                            没有待交付订单 No pending deliveries
                        </p>
                    ` : `
                        <div class="table-wrapper">
                            <table class="table">
                            <thead>
                                <tr>
                                    <th>选择 Select</th>
                                    <th>订单号 Order#</th>
                                    <th>客户 Customer</th>
                                    <th>电话 Phone</th>
                                    <th>交付日期 Delivery Date</th>
                                    <th>状态 Status</th>
                                    <th>操作 Actions</th>
                                </tr>
                            </thead>
                            <tbody id="orders-table-body">
                                
                            </tbody>
                        </table>
                        </div>
                    `}
                </div>
            `;
            await Delivery.renderOrders();
        } catch (error) {
            console.log(error);
            content.innerHTML = '<div class="card"><p>加载失败 Loading failed</p></div>';
        }
    },
    async renderOrders() {
        const orders = await Utils.request('/delivery');
        if (orders.length === 0) {
            return;
        }
        const tbody = document.getElementById('orders-table-body');
        tbody.innerHTML = '';
        orders.forEach(order => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="选择 Select"><input type="checkbox" name="order_ids" value="${order.id}"></td>
                <td data-label="订单号 Order#"><strong>${order.order_number}</strong></td>
                <td data-label="客户 Customer">${order.customer_name}</td>
                <td data-label="电话 Phone">${order.customer_phone}</td>
                <td data-label="交付日期 Delivery Date">${Utils.formatDate(order.factory_delivery_date)}</td>
                <td data-label="状态 Status"><span class="badge badge-${order.status}">${order.status}</span></td>
                <td data-label="操作 Actions">
                    <button class="btn btn-sm btn-success" onclick="Delivery.markPickedUp(${order.id})">已取货 Picked Up</button>
                    <button class="btn btn-sm btn-primary" onclick="Orders.viewDetails(${order.id})">编辑 Edit</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },
    async editOrders() {
        const selectedOrders = document.querySelectorAll('input[name="order_ids"]:checked');
        if (selectedOrders.length === 0) {
            Utils.showNotification('Please select at least one order / 请选择至少一个订单', 'warning');
            return;
        }
        const content = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Edit Orders / 编辑订单</h2>
                </div>
                <div class="grid grid-2 gap-1 border-bottom pb-1 mb-1">
                    <p><strong>工厂交货日期 Factory Date:</strong> 
                        <input type="date" class="form-input inline-input" value="", id="factory_delivery_date">
                    </p>
                    <p><strong>状态 Status:</strong> 
                        <select class="form-select inline-select" id="status" name="status" value="factory_confirmed">
                                ${[
                { val: 'factory_confirmed', label: '确认工厂报价 (Factory Confirmed)' },
                { val: 'in_transit', label: '运输中 (In Transit)' },
                { val: 'ready_for_pickup', label: '到店可取货 (Ready for Pickup)' },
                { val: 'out_for_delivery', label: '配送中 (Out for Delivery)' },
                { val: 'completed', label: '完成 (Completed)' }
            ].map(s => `<option value="${s.val}">${s.label}</option>`).join('')}
                        </select>
                    </p>
                </div>
                
            </div>
        `;
        const footer = `
            <button class="btn btn-primary" onclick="Delivery.updateOrders()">Update Orders / 更新订单</button>
        `;
        Utils.createModal('编辑订单 Edit Order', content, footer, 'modal-lg');
    },
    async updateOrders() {
        const factoryDeliveryDate = document.getElementById('factory_delivery_date').value;
        const status = document.getElementById('status').value;
        const selectedOrders = document.querySelectorAll('input[name="order_ids"]:checked');
        if (selectedOrders.length === 0) {
            Utils.showNotification('Please select at least one order / 请选择至少一个订单', 'warning');
            return;
        }
        const orderIds = Array.from(selectedOrders).map(order => order.value);
        try {
            await Utils.request('/delivery/update', {
                method: 'PUT',
                body: JSON.stringify({
                    orderIds,
                    factoryDeliveryDate,
                    status
                })
            });
            Utils.showNotification('Orders updated successfully / 订单更新成功', 'success');
            await Delivery.renderOrders();
        } catch (error) {
            console.log(error);
            Utils.showNotification('Failed to update orders / 更新订单失败', 'error');
        }
    },
    async markPickedUp(orderId) {
        if (!confirm('确定要标记为已取货吗？')) return;
        try {
            await Utils.request(`/delivery/${orderId}/mark-picked-up`, {
                method: 'PUT'
            });
            Utils.showNotification('Order marked as picked up / 订单已标记为已取货', 'success');
            Router.navigate('delivery');
        } catch (error) {
            // Error already shown
        }
    }
};

