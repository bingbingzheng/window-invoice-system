const bcrypt = require('bcrypt');
const db = require('./db');

/**
 * 重置用户密码脚本
 * Reset user password script
 * 
 * Usage: node database/reset-password.js <username> <new_password>
 */
async function resetPassword() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('Usage: node database/reset-password.js <username> <new_password>');
        process.exit(1);
    }

    const username = args[0];
    const newPassword = args[1];

    try {
        console.log(`正在重置用户 ${username} 的密码... / Resetting password for ${username}...`);

        // 1. Check if user exists
        const user = await db.get('SELECT * FROM admins WHERE username = ?', [username]);
        if (!user) {
            console.error(`❌ 用户未找到 / User not found: ${username}`);
            process.exit(1);
        }

        // 2. Hash new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // 3. Update database
        await db.run('UPDATE admins SET password_hash = ? WHERE username = ?', [passwordHash, username]);

        console.log('✅ 密码修改成功！ / Password reset successfully!');
        console.log(`用户 / User: ${username}`);
        console.log(`新密码 / New Password: ${newPassword}`);

    } catch (error) {
        console.error('❌ 发生错误 / Error:', error);
        process.exit(1);
    }
}

// 确保数据库已连接后再运行
if (require.main === module) {
    db.initialize()
        .then(() => resetPassword())
        .then(() => {
            // Give a moment for logs to flush before exit if needed, though usually not strictly necessary for simple console.log
            setTimeout(() => process.exit(0), 100);
        })
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}
