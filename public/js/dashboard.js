const Dashboard = {
    async render(content) {
        try {
            const [customers, factories, orders] = await Promise.all([
                Utils.request('/customers'),
                Utils.request('/factories'),
                Utils.request('/orders')
            ]);

            const pendingOrders = orders.filter(o => o.status === 'pending').length;
            const quotePendingOrders = orders.filter(o => o.status === 'factory_quote_pending').length;
            const inTransitOrders = orders.filter(o => o.status === 'in_transit').length;

            content.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">仪表盘 Dashboard</h2>
                    </div>
                    <div class="grid grid-3">
                        <div class="card shadow-sm">
                            <h3 style="color: var(--text-muted); font-size: 0.9rem;">待处理订单 Pending</h3>
                            <p style="font-size: 2rem; font-weight: bold; color: var(--primary);">${pendingOrders}</p>
                        </div>
                        <div class="card shadow-sm">
                            <h3 style="color: var(--text-muted); font-size: 0.9rem;">报价待处理 Factory Quote Pending</h3>
                            <p style="font-size: 2rem; font-weight: bold; color: var(--warning);">${quotePendingOrders}</p>
                        </div>
                        <div class="card shadow-sm">
                            <h3 style="color: var(--text-muted); font-size: 0.9rem;">运输中 In Transit</h3>
                            <p style="font-size: 2rem; font-weight: bold; color: var(--success);">${inTransitOrders}</p>
                        </div>
                    </div>
                    
                    <div style="margin-top: var(--spacing-xl);">
                        <h3 style="margin-bottom: var(--spacing-md);">最近订单 Recent Orders</h3>
                        <div class="table-wrapper">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>订单号 Order#</th>
                                        <th>客户 Customer</th>
                                        <th>日期 Date</th>
                                        <th>状态 Status</th>
                                        <th>操作 Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${orders.length > 0 ? orders.slice(0, 5).map(order => `
                                        <tr>
                                            <td data-label="订单号 Order#">${order.order_number}</td>
                                            <td data-label="客户 Customer">${order.customer_name}</td>
                                            <td data-label="日期 Date">${Utils.formatDate(order.created_at)}</td>
                                            <td data-label="状态 Status"><span class="badge badge-${order.status}">${order.status}</span></td>
                                            <td data-label="操作 Action">
                                                <button class="btn btn-primary btn-sm" onclick="Orders.viewDetails(${order.id})">详情 Details</button>
                                            </td>
                                        </tr>
                                    `).join('') : '<tr><td colspan="5" style="text-align: center;">暂无订单 No orders</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            content.innerHTML = '<div class="card"><p>加载失败 Loading failed</p></div>';
        }
    }
};
