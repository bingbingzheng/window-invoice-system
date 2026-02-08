const bcrypt = require('bcrypt');
const db = require('./db');

/**
 * 插入默认管理员账户
 * Insert default admin accounts
 * 
 * @param {boolean} force - 是否强制重置所有账户（会删除现有账户）
 */
async function insertDefaultAccounts(force = false) {
    try {
        console.log('开始插入默认账户... / Starting to insert default accounts...');

        // 检查是否已存在账户
        const existingAccounts = await db.all('SELECT username, role FROM admins');

        if (existingAccounts.length > 0 && !force) {
            console.log(`\n已存在 ${existingAccounts.length} 个账户：`);
            console.log(`${existingAccounts.length} account(s) already exist:`);
            existingAccounts.forEach(acc => {
                console.log(`  - ${acc.username} (${acc.role})`);
            });
            console.log('\n如需重置账户，请运行: node database/insert-default-accounts.js --force');
            console.log('To reset accounts, run: node database/insert-default-accounts.js --force\n');
            return;
        }

        if (force && existingAccounts.length > 0) {
            console.log('⚠️  强制模式：删除所有现有账户... / Force mode: Deleting all existing accounts...');
            await db.run('DELETE FROM admins');
            console.log('✓ 已删除所有账户 / All accounts deleted\n');
        }

        // 默认账户配置 default accounts
        const defaultAccounts = [
            {
                username: 'boss',
                password: 'boss123',
                role: 'boss',
                description: '老板账户 / Boss Account'
            },
            {
                username: 'employee',
                password: 'employee123',
                role: 'employee',
                description: '员工账户 / Employee Account'
            }
        ];

        console.log('开始创建账户... / Creating accounts...\n');

        for (const account of defaultAccounts) {
            // 加密密码
            const password_hash = await bcrypt.hash(account.password, 10);

            // 插入账户
            const result = await db.run(
                'INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)',
                [account.username, password_hash, account.role]
            );

            console.log(`✓ 创建账户: ${account.username} (${account.role})`);
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ 默认账户创建成功！ / Default accounts created successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log('登录信息 / Login Credentials:\n');

        defaultAccounts.forEach((account, index) => {
            if (index > 0) console.log('');
            console.log(`${account.description}:`);
            console.log(`  用户名 / Username: ${account.username}`);
            console.log(`  密码 / Password:   ${account.password}`);
        });

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('❌ 插入默认账户失败 / Failed to insert default accounts:', error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    // 检查命令行参数
    const force = process.argv.includes('--force') || process.argv.includes('-f');

    db.initialize()
        .then(() => insertDefaultAccounts(force))
        .then(() => {
            console.log('完成 / Done');
            process.exit(0);
        })
        .catch((error) => {
            console.error('错误 / Error:', error);
            process.exit(1);
        });
}

module.exports = { insertDefaultAccounts };
