// 认证中间件 / Authentication Middleware

// 必须登录（用于修改操作）
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({
            error: 'Login required for this operation / 此操作需要登录'
        });
    }
    next();
}


// 老板权限中间件 / Boss Role Middleware
function requireBoss(req, res, next) {
    if (!req.session.isAdmin || req.session.role !== 'boss') {
        return res.status(403).json({ error: 'Boss access required / 需要老板权限' });
    }
    next();
}

// 可选登录（用于查看操作，不强制登录）
function optionalAuth(req, res, next) {
    // 不阻止请求，只是标记是否已登录
    req.isAuthenticated = !!req.session.userId;
    next();
}

// 操作日志记录中间件
function auditLog(action, entityType) {
    return async (req, res, next) => {
        // 保存原始的 res.json 方法
        const originalJson = res.json.bind(res);

        res.json = function (data) {
            // 只在成功时记录（2xx状态码）
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const SQLUtils = require('../database/sql_utils');

                // 提取实体ID
                let entityId = req.params.id || data?.id || data?.order_id;

                // 记录日志（异步，不阻塞响应）
                SQLUtils.insert('audit_logs', {
                    user_id: req.session.userId || null,
                    username: req.session.username || 'Anonymous',
                    action: action,
                    entity_type: entityType,
                    entity_id: entityId,
                    details: JSON.stringify({
                        method: req.method,
                        path: req.path,
                        body: req.body
                    }),
                    ip_address: req.ip
                }).catch(err => console.error('Audit log error:', err));
            }

            return originalJson(data);
        };

        next();
    };
}

module.exports = { requireAuth, requireBoss, optionalAuth, auditLog };

