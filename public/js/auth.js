// 认证管理模块 / Authentication Module
const Auth = {
    isAdmin: false,
    role: null,
    username: null,

    async checkAuth() {
        try {
            const response = await fetch('/api/auth/check');
            const data = await response.json();
            this.isAdmin = data.isAdmin;
            this.role = data.role;
            this.username = data.username;
            this.updateUI();
            return data.isAdmin;
        } catch (error) {
            this.isAdmin = false;
            this.role = null;
            return false;
        }
    },

    async login(username, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            console.log(response);
            if (!response.ok) {
                throw new Error('Invalid credentials / 登录失败');
            }

            const data = await response.json();
            this.isAdmin = true;
            this.role = data.role;
            this.username = data.username;
            this.updateUI();
            Utils.showNotification(`Welcome ${data.username}! / 欢迎 ${data.username}！`, 'success');
            return true;
        } catch (error) {
            Utils.showNotification(error.message, 'error');
            return false;
        }
    },

    async logout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            this.isAdmin = false;
            this.role = null;
            this.username = null;
            this.updateUI();
            Utils.showNotification('Logged out / 已登出', 'success');
            Router.navigate('dashboard');
        } catch (error) {
            Utils.showNotification(error.message, 'error');
        }
    },

    updateUI() {
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const mobileLoginBtn = document.getElementById('mobile-login-btn');
        const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
        const factoriesLink = document.querySelector('[data-page="factories"]');
        const auditNav = document.getElementById('audit-nav');
        const customersLink = document.querySelector('[data-page="customers"]');

        if (this.isAdmin) {
            if (loginBtn) loginBtn.classList.add('hidden');
            if (logoutBtn) {
                logoutBtn.classList.remove('hidden');
                logoutBtn.innerHTML = `🚪 Logout / 登出 (${this.username})`;
            }
            if (mobileLoginBtn) mobileLoginBtn.classList.add('hidden');
            if (mobileLogoutBtn) {
                mobileLogoutBtn.classList.remove('hidden');
                mobileLogoutBtn.textContent = `🚪 ${this.username}`;
            }

            // 只有老板才能看到工厂管理和审计日志
            if (this.role === 'boss') {
                if (factoriesLink) factoriesLink.parentElement.classList.remove('hidden');
                if (auditNav) auditNav.classList.remove('hidden');
                if (customersLink) customersLink.parentElement.classList.remove('hidden');
            } else {
                if (factoriesLink) factoriesLink.parentElement.classList.add('hidden');
                if (auditNav) auditNav.classList.add('hidden');
                if (customersLink) customersLink.parentElement.classList.add('hidden');
            }

        } else {
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (logoutBtn) logoutBtn.classList.add('hidden');
            if (mobileLoginBtn) mobileLoginBtn.classList.remove('hidden');
            if (mobileLogoutBtn) mobileLogoutBtn.classList.add('hidden');
            if (factoriesLink) factoriesLink.parentElement.classList.add('hidden');
            if (auditNav) auditNav.classList.add('hidden');
        }
    },

    showLoginModal() {
        const content = `
            <form id="login-form" onsubmit="Auth.submitLogin(); return false;">
                <div style="background: var(--bg-tertiary); padding: var(--spacing-md); border-radius: var(--radius-md); margin-bottom: var(--spacing-lg);">
                    <p style="margin-bottom: var(--spacing-sm);"><strong>员工登录 Employee Login:</strong></p>
                    <p style="font-size: 0.9rem; color: var(--text-muted);">Username: employee | Password: employee123</p>
                    <p style="margin-top: var(--spacing-sm); margin-bottom: var(--spacing-sm);"><strong>老板登录 Boss Login:</strong></p>
                    <p style="font-size: 0.9rem; color: var(--text-muted);">Username: boss | Password: boss123</p>
                </div>
                <div class="form-group">
                    <label class="form-label">Username / 用户名</label>
                    <input type="text" name="username" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Password / 密码</label>
                    <input type="password" name="password" class="form-input" required>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel / 取消</button>
            <button class="btn btn-primary" type="submit" form="login-form">Login / 登录</button>
        `;

        Utils.createModal('Login / 登录', content, footer);
    },

    async submitLogin() {
        const form = document.getElementById('login-form');
        const formData = new FormData(form);
        const username = formData.get('username');
        const password = formData.get('password');

        const success = await this.login(username, password);
        if (success) {
            document.querySelector('.modal-overlay').remove();
        }
    }
};
