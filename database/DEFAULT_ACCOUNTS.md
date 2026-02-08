# 默认账户管理 / Default Accounts Management

## 当前账户 / Current Accounts

数据库中已存在以下账户：
- **boss** (老板账户)

## 使用脚本 / Using the Script

### 查看现有账户 / View Existing Accounts
```bash
node database/insert-default-accounts.js
```

### 重置并创建默认账户 / Reset and Create Default Accounts
```bash
node database/insert-default-accounts.js --force
```

⚠️ **警告 / Warning**: `--force` 参数会删除所有现有账户并重新创建默认账户。

## 默认账户信息 / Default Account Information

脚本会创建以下两个默认账户：

### 老板账户 / Boss Account
- **用户名 / Username**: `boss`
- **密码 / Password**: `boss123`
- **权限 / Role**: `boss`

### 员工账户 / Employee Account
- **用户名 / Username**: `employee`
- **密码 / Password**: `employee123`
- **权限 / Role**: `employee`

## 修改默认账户 / Modify Default Accounts

如需修改默认账户配置，请编辑 `database/insert-default-accounts.js` 文件中的 `defaultAccounts` 数组。

## 安全建议 / Security Recommendations

⚠️ **重要 / Important**: 
- 首次登录后请立即修改默认密码
- 不要在生产环境中使用这些默认密码
- Change default passwords immediately after first login
- Do not use these default passwords in production
