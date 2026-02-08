// 全局状态
const AppState = {
    currentPage: 'dashboard',
    customers: [],
    factories: [],
    orders: []
};

// 路由管理
const Router = {
    navigate(page) {
        // 更新导航状态
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === page) {
                link.classList.add('active');
            }
        });

        AppState.currentPage = page;
        this.render();
    },

    render() {
        const content = document.getElementById('page-content');

        switch (AppState.currentPage) {
            case 'dashboard':
                Dashboard.render(content);
                break;
            case 'delivery':
                Delivery.render(content);
                break;
            case 'orders':
                Orders.render(content);
                break;
            case 'customers':
                Customers.render(content);
                break;
            case 'standard-products':
                StandardProducts.render(content);
                break;
            case 'factories':
                Factories.render(content);
                break;
            case 'audit':
                Audit.render(content);
                break;
            default:
                content.innerHTML = '<h1>页面未找到 Page Not Found</h1>';
        }
    }
};

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    // 检查认证状态
    Auth.checkAuth();

    // 设置导航事件
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            Router.navigate(page);

            // 移动端点击导航后关闭菜单
            if (window.innerWidth <= 768) {
                const sidebar = document.querySelector('.sidebar');
                sidebar.classList.remove('mobile-open');
            }
        });
    });

    // 移动端菜单切换
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');

    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
        });

        // 点击侧边栏外部关闭菜单
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 &&
                sidebar.classList.contains('mobile-open') &&
                !sidebar.contains(e.target) &&
                !mobileMenuToggle.contains(e.target)) {
                sidebar.classList.remove('mobile-open');
            }
        });

        // 窗口大小改变时处理
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('mobile-open');
            }
        });
    }

    // 渲染初始页面
    Router.navigate('dashboard');
});
