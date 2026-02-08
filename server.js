const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const db = require('./database/db');
const SQLUtils = require('./database/sql_utils');

const app = express();
const PORT = process.env.PORT || 3443;

// 配置文件上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

        // 让路由来决定最终文件名前缀
        const prefix = req.uploadPrefix || 'file';

        cb(null, `${prefix}-${uniqueSuffix}${ext}`);
    }
});
const upload = multer({ storage });

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'window-invoice-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: false, // 设为false以同时支持HTTP和HTTPS
        sameSite: 'lax'
    }
}));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// API路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/factories', require('./routes/factories'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/standard-products', require('./routes/standard-products'));
app.use('/api/product-templates', require('./routes/product-templates'));
app.use('/api/delivery', require('./routes/delivery'));

// 上传工厂确认PDF（需要登录）
const { requireAuth, auditLog } = require('./middleware/auth');

app.post('/api/orders/:id/upload-factory-confirmation',
    requireAuth,
    auditLog('UPLOAD', 'order_document'),
    (req, res, next) => {
        req.uploadPrefix = 'factory-confirmation';
        next();
    }, upload.single('pdf'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const result = await SQLUtils.insert('order_documents', {
                order_id: req.params.id,
                document_type: 'factory_confirmation',
                file_path: req.file.path,
                notes: req.body.notes
            });

            const document = await SQLUtils.findN('order_documents', { id: result.id });
            res.status(201).json(document);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

// 上传客户确认PDF（需要登录）
app.post('/api/orders/:id/upload-customer-confirmation',
    requireAuth,
    auditLog('UPLOAD', 'order_document'),
    (req, res, next) => {
        req.uploadPrefix = 'customer-confirmation';
        next();
    }, upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const result = await SQLUtils.insert('order_documents', {
                order_id: req.params.id,
                document_type: 'customer_confirmation',
                file_path: req.file.path,
                notes: req.body.notes
            });

            const document = await SQLUtils.findN('order_documents', { id: result.id });
            res.status(201).json(document);

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    });

// 获取服务器IP地址（用于LAN访问）
app.get('/api/server-info', (req, res) => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push(iface.address);
            }
        }
    }

    res.json({
        port: PORT,
        addresses,
        accessUrls: addresses.map(addr => `http://${addr}:${PORT}`)
    });
});

// 初始化数据库并启动服务器
db.initialize()
    .then(() => {
        const https = require('https');
        const fs = require('fs');
        const os = require('os');

        // 获取本机IP地址
        function getLocalIP() {
            const interfaces = os.networkInterfaces();
            for (const name of Object.keys(interfaces)) {
                for (const iface of interfaces[name]) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        return iface.address;
                    }
                }
            }
            return 'localhost';
        }

        const localIP = getLocalIP();
        const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

        // 尝试启动HTTPS服务器
        try {
            const httpsOptions = {
                key: fs.readFileSync(path.join(__dirname, 'certs', 'key.pem')),
                cert: fs.readFileSync(path.join(__dirname, 'certs', 'cert.pem'))
            };

            const httpsServer = https.createServer(httpsOptions, app);
            httpsServer.listen(HTTPS_PORT, () => {
                console.log('\n🔒 HTTPS 已启用 / HTTPS Enabled');
                console.log(`HTTPS 本地访问: https://localhost:${HTTPS_PORT}`);
                console.log(`HTTPS 局域网访问: https://${localIP}:${HTTPS_PORT}`);
                console.log('\n⚠️  注意 / Note:');
                console.log('首次访问HTTPS需要在浏览器中信任自签名证书');
                console.log('First HTTPS access requires trusting self-signed certificate in browser');
                console.log('===========================================\n');
            });
        } catch (error) {
            console.log('\n⚠️  HTTPS未启用 (证书文件不存在)');
            console.log('HTTPS not enabled (certificate files not found)');
            console.log('运行以下命令生成证书 / Run this to generate certificates:');
            console.log('openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes -config certs/cert.conf -extensions v3_req');
            console.log('===========================================\n');
        }
    })
    .catch(err => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });

module.exports = app;
