// 审计日志管理 / Audit Logs Management

const Audit = {
    logs: [],
    total: 0,
    currentPage: 1,
    pageSize: 50,
    filters: {
        start_date: '',
        end_date: '',
        entity_type: '',
        username: ''
    },

    // SPA渲染方法
    async render(content) {
        try {
            // 检查登录状态和权限
            const authStatus = await Utils.request('/auth/check');
            if (authStatus.role !== 'boss') {
                content.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h2 class="card-title">⚠️ Access Denied / 访问被拒绝</h2>
                        </div>
                        <div class="card-body">
                            <p>This page requires boss access. / 此页面需要老板权限。</p>
                        </div>
                    </div>
                `;
                return;
            }

            // 设置默认日期为今天
            const today = new Date().toISOString().split('T')[0];
            this.filters.start_date = today;
            this.filters.end_date = today;

            // 生成页面HTML
            content.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">📋 Audit Logs / 审计日志</h2>
                    </div>

                    <div class="card-body">
                        <!-- 过滤器 -->
                        <div class="grid grid-5 gap-1" style="margin-bottom: var(--spacing-lg);">
                            <div class="form-group">
                                <label class="form-label">Start Date / 开始日期</label>
                                <input type="date" id="start-date" class="form-input" value="${this.filters.start_date}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">End Date / 结束日期</label>
                                <input type="date" id="end-date" class="form-input" value="${this.filters.end_date}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Entity Type / 实体类型</label>
                                <select id="entity-type" class="form-select">
                                    <option value="">All / 全部</option>
                                    <option value="order">Order / 订单</option>
                                    <option value="customer">Customer / 客户</option>
                                    <option value="factory">Factory / 工厂</option>
                                    <option value="standard_product">Product / 产品</option>
                                    <option value="product_template">Template / 模板</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Keyword / 搜索关键词</label>
                                <input type="text" id="keyword" class="form-input" value="${this.filters.keyword}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">&nbsp;</label>
                                <button id="search-btn" class="btn btn-primary" style="width: 100%;">
                                    🔍 Search / 搜索
                                </button>
                            </div>
                        </div>

                        <!-- 统计信息 -->
                        <div id="stats-container" style="margin-bottom: var(--spacing-lg);"></div>

                        <!-- 日志表格 -->
                        <div class="table-wrapper">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Time / 时间</th>
                                        <th>User / 用户</th>
                                        <th>Action / 操作</th>
                                        <th>Entity / 实体</th>
                                        <th>Entity ID</th>
                                        <th>IP Address</th>
                                        <th>Details / 详情</th>
                                    </tr>
                                </thead>
                                <tbody id="logs-tbody">
                                    <tr><td colspan="7" class="text-center">Loading... / 加载中...</td></tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- 分页 -->
                        <div id="pagination-container" style="margin-top: var(--spacing-lg);"></div>
                    </div>
                </div>
            `;

            // 绑定事件
            this.bindEvents();

            // 加载数据
            await this.loadLogs();
        } catch (error) {
            content.innerHTML = '<div class="card"><p>Loading failed / 加载失败</p></div>';
            console.error('Error rendering audit logs:', error);
        }
    },

    bindEvents() {
        // 搜索按钮
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.filters.start_date = document.getElementById('start-date').value;
                this.filters.end_date = document.getElementById('end-date').value;
                this.filters.entity_type = document.getElementById('entity-type').value;
                this.filters.keyword = document.getElementById('keyword').value;
                this.currentPage = 1;
                this.loadLogs();
            });
        }

        // 日期输入回车搜索
        ['start-date', 'end-date', 'entity-type', 'keyword'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', () => {
                    this.filters.start_date = document.getElementById('start-date').value;
                    this.filters.end_date = document.getElementById('end-date').value;
                    this.filters.entity_type = document.getElementById('entity-type').value;
                    this.filters.keyword = document.getElementById('keyword').value;
                    this.currentPage = 1;
                    this.loadLogs();
                });
            }
        });
    },

    async loadLogs() {
        try {
            const params = new URLSearchParams({
                limit: this.pageSize,
                offset: (this.currentPage - 1) * this.pageSize
            });

            if (this.filters.start_date) params.append('start_date', this.filters.start_date);
            if (this.filters.end_date) params.append('end_date', this.filters.end_date);
            if (this.filters.entity_type) params.append('entity_type', this.filters.entity_type);
            if (this.filters.keyword) params.append('keyword', this.filters.keyword);

            const data = await Utils.request(`/audit?${params.toString()}`);
            this.logs = data.logs;
            this.total = data.total;

            this.renderLogs();
            this.renderPagination();
            this.renderStats();
        } catch (error) {
            console.error('Error loading logs:', error);
            Utils.showNotification('Failed to load logs / 加载日志失败', 'error');
        }
    },

    renderLogs() {
        const tbody = document.getElementById('logs-tbody');
        if (!tbody) return;

        if (this.logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No logs found / 暂无日志</td></tr>';
            return;
        }

        tbody.innerHTML = this.logs.map(log => {
            const actionBadge = this.getActionBadge(log.action);
            const time = new Date(log.created_at).toLocaleString('zh-CN');

            return `
                <tr>
                    <td data-label="Time / 时间">${time}</td>
                    <td data-label="User / 用户">${Utils.escapeHtml(log.username)}</td>
                    <td data-label="Action / 操作">${actionBadge}</td>
                    <td data-label="Entity / 实体">${Utils.escapeHtml(log.entity_type || '-')}</td>
                    <td data-label="Entity ID">${Utils.escapeHtml(log.entity_id || '-')}</td>
                    <td data-label="IP Address">${Utils.escapeHtml(log.ip_address || '-')}</td>
                    <td data-label="Details / 详情">
                        <button class="btn btn-sm btn-secondary" onclick="Audit.showDetails(${log.id})">
                            View / 查看
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    getActionBadge(action) {
        const badges = {
            'CREATE': '<span class="badge badge-success">CREATE</span>',
            'UPDATE': '<span class="badge badge-warning">UPDATE</span>',
            'DELETE': '<span class="badge badge-danger">DELETE</span>',
            'UPLOAD': '<span class="badge badge-info">UPLOAD</span>',
            'VIEW': '<span class="badge badge-secondary">VIEW</span>'
        };
        return badges[action] || `<span class="badge">${action}</span>`;
    },

    renderPagination() {
        const container = document.getElementById('pagination-container');
        if (!container) return;

        const totalPages = Math.ceil(this.total / this.pageSize);
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '<div style="display: flex; justify-content: center; gap: var(--spacing-sm);">';

        // 上一页
        if (this.currentPage > 1) {
            html += `<button class="btn btn-secondary" onclick="Audit.goToPage(${this.currentPage - 1})">← Previous / 上一页</button>`;
        }

        // 页码
        html += `<span style="padding: var(--spacing-sm); line-height: 2.5;">Page ${this.currentPage} of ${totalPages}</span>`;

        // 下一页
        if (this.currentPage < totalPages) {
            html += `<button class="btn btn-secondary" onclick="Audit.goToPage(${this.currentPage + 1})">Next / 下一页 →</button>`;
        }

        html += '</div>';
        container.innerHTML = html;
    },

    renderStats() {
        const container = document.getElementById('stats-container');
        if (!container) return;

        container.innerHTML = `
            <div style="background: var(--bg-tertiary); padding: var(--spacing-md); border-radius: var(--radius-md);">
                <strong>Total Logs / 总日志数:</strong> ${this.total}
                ${this.filters.start_date ? ` | <strong>From / 从:</strong> ${this.filters.start_date}` : ''}
                ${this.filters.end_date ? ` | <strong>To / 到:</strong> ${this.filters.end_date}` : ''}
            </div>
        `;
    },

    goToPage(page) {
        this.currentPage = page;
        this.loadLogs();
    },

    showDetails(logId) {
        const log = this.logs.find(l => l.id === logId);
        if (!log) return;

        let details = {};
        try {
            details = JSON.parse(log.details);
        } catch (e) {
            details = { raw: log.details };
        }

        const content = `
            <div style="font-family: monospace; font-size: 0.9rem;">
                <p><strong>User:</strong> ${Utils.escapeHtml(log.username)}</p>
                <p><strong>Action:</strong> ${Utils.escapeHtml(log.action)}</p>
                <p><strong>Entity Type:</strong> ${Utils.escapeHtml(log.entity_type || '-')}</p>
                <p><strong>Entity ID:</strong> ${Utils.escapeHtml(log.entity_id || '-')}</p>
                <p><strong>Time:</strong> ${new Date(log.created_at).toLocaleString('zh-CN')}</p>
                <p><strong>IP Address:</strong> ${Utils.escapeHtml(log.ip_address || '-')}</p>
                <hr>
                <p><strong>Details:</strong></p>
                <pre style="background: var(--bg-secondary); padding: var(--spacing-sm); border-radius: var(--radius-sm); overflow-x: auto;">${JSON.stringify(details, null, 2)}</pre>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close / 关闭</button>
        `;

        Utils.createModal('Log Details / 日志详情', content, footer);
    }
};
