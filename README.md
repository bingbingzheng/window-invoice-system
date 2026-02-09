# Window Invoice System

A customized order invoice system for window manufacturing business with LAN hosting capability and HTTPS support.

一个专为窗户制造企业定制的订单发票系统，支持局域网部署和HTTPS加密。

---

## Features / 功能特性

- ✅ **Customer Management** - Customer information, order history
- ✅ **Factory Management** - Factory info, tiered pricing by area, addon pricing
- ✅ **Order Management** - Create orders, window configuration (combo windows, sub-windows)
- ✅ **Payment Tracking** - Record all payments, auto-calculate remaining balance
- ✅ **PDF Invoices** - Auto-generate professional invoice PDFs (bilingual support)
- ✅ **LAN Deployment** - Multi-device access via local network
- ✅ **HTTPS Support** - Secure encrypted connections with self-signed certificates

---

## Tech Stack / 技术栈

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express + SQLite |
| Frontend | HTML + CSS + JavaScript (no build required) |
| PDF Generation | PDFKit |
| Database | SQLite (file-based, no installation needed) |
| Authentication | bcrypt + express-session |

---

## Quick Start / 快速开始

### 1. Install Dependencies / 安装依赖

```bash
npm install
```

### 2. Generate SSL Certificates / 生成SSL证书

Before starting the server, you need to generate SSL certificates for HTTPS:

在启动服务器之前，需要生成HTTPS所需的SSL证书：

```bash
# First, find your local IP address / 首先查找本机IP地址
# macOS:
ipconfig getifaddr en0

# Then edit the certificate config / 然后编辑证书配置
nano certs/cert.conf
```

Update the `cert.conf` file with your actual IP address:

将 `cert.conf` 文件中的IP地址改为你的实际IP：

```ini
[dn]
CN=YOUR_IP_ADDRESS     # e.g., 192.168.1.100

[alt_names]
DNS.1 = localhost
DNS.2 = *.local
IP.1 = 127.0.0.1
IP.2 = YOUR_IP_ADDRESS  # e.g., 192.168.1.100
```

Then generate the certificates / 然后生成证书：

```bash
openssl req -x509 -newkey rsa:2048 \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -days 365 -nodes \
  -config certs/cert.conf \
  -extensions v3_req
```

### 3. Start the Server / 启动服务器

```bash
npm start
```

The server will start on port **3443** (HTTPS).

服务器将在端口 **3443** (HTTPS) 启动。

### 4. Access the System / 访问系统

| Access Type | URL |
|-------------|-----|
| Local | https://localhost:3443 |
| LAN | https://YOUR_IP:3443 (e.g., https://192.168.1.100:3443) |

---

## Trusting the Self-Signed Certificate / 信任自签名证书

Since we use a self-signed certificate, browsers will show a security warning on first access.

由于使用自签名证书，首次访问时浏览器会显示安全警告。

### Chrome / Edge (Desktop)
1. Visit `https://YOUR_IP:3443`
2. Click **"Advanced"**
3. Click **"Proceed to [IP] (unsafe)"**
4. Or type `thisisunsafe` on the warning page

### Safari (Mac)
1. Visit `https://YOUR_IP:3443`
2. Click **"Show Details"**
3. Click **"visit this website"**
4. Enter Mac password to confirm

### Firefox
1. Visit `https://YOUR_IP:3443`
2. Click **"Advanced"**
3. Click **"Accept the Risk and Continue"**

### iPhone / iPad (Safari)
1. Visit `https://YOUR_IP:3443`
2. Tap **"Show Details"**
3. Tap **"visit this website"**
4. Confirm by tapping **"Visit Website"**

### Android (Chrome)
1. Visit `https://YOUR_IP:3443`
2. Tap **"Advanced"**
3. Tap **"Proceed to [IP] (unsafe)"**

---

## Account Management / 账户管理

### View Accounts / 查看账户
To view existing accounts:
查看现有账户：
```bash
node database/insert-default-accounts.js
```

### Reset Accounts / 重置账户
To reset to default accounts (WARNING: deletes all existing admins):
重置为默认账户（警告：会删除所有现有管理员）：
```bash
node database/insert-default-accounts.js --force
```

**Default Credentials / 默认凭据:**
- **Boss**: `boss` / `boss123`
- **Employee**: `employee` / `employee123`

⚠️ **Security Warning**: Change passwords immediately after first login!
⚠️ **安全警告**: 首次登录后请立即修改密码！

---

## Usage Guide / 使用指南

### Initial Setup / 初始设置

1. **Add Factory / 添加工厂**
   - Go to "Factory Management" page
   - Add at least one factory
   - Configure pricing rules (by area range)
   - Configure addons (grids, Low-E, etc.)

2. **Add Customer / 添加客户**
   - Go to "Customer Management" page
   - Add customer information

### Creating Orders / 创建订单

1. Click "Create Order"
2. Select/add customer then select factory
3. Add windows:
   - Enter window dimensions
   - Select window type (single/combo)
   - Add sub-windows (optional)
   - Select addons (grids, Low-E)
4. System auto-calculates price
5. Save order

### Payment Management / 支付管理

1. Click "Payment" on order list
2. Enter payment amount and method
3. System auto-updates remaining balance

### Generate Invoice / 生成发票

1. View order details
2. Click "Generate PDF"
3. Download and print invoice

---

## Data Backup / 数据备份

Database file is located at: `database/invoice.db`

定期备份此文件即可保存所有数据。

```bash
# Backup example / 备份示例
cp database/invoice.db database/invoice_backup_$(date +%Y%m%d).db
```

---

## Troubleshooting / 故障排除

### Cannot start server / 无法启动服务器
- Check Node.js: `node --version`
- Check if port 3443 is in use

### Cannot access from LAN / 局域网无法访问
- Check firewall settings
- Ensure devices are on the same network
- Verify correct IP address

### Certificate expired / 证书过期
- Regenerate certificates (see step 2 above)
- Restart server

### Database error / 数据库错误
- Delete `database/invoice.db` (system will recreate)

---

## Environment Variables / 环境变量

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3443 | Server port |
| HTTPS_PORT | 3443 | HTTPS port |

---

## License

MIT
