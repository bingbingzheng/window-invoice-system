const db = require('./db');

class SQLUtils {
    /**
     * Insert a record into a table
     * @param {string} table - Table name
     * @param {object} data - Key-value pairs of data to insert
     * @returns {Promise<object>} - Result object { id, changes }
     */
    static async insert(table, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?').join(', ');
        const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
        return db.run(sql, values);
    }

    /**
     * Update records in a table
     * @param {string} table - Table name
     * @param {object} data - Key-value pairs of data to update
     * @param {object} where - Key-value pairs for WHERE clause
     * @returns {Promise<object>} - Result object { changes }
     */
    static async update(table, data, where) {
        const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
        const values = [...Object.values(data), ...Object.values(where)];

        const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
        return db.run(sql, values);
    }

    /**
     * Delete records from a table
     * @param {string} table - Table name
     * @param {object} where - Key-value pairs for WHERE clause
     * @returns {Promise<object>} - Result object { changes }
     */
    static async delete(table, where) {
        const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
        const values = Object.values(where);

        const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
        return db.run(sql, values);
    }

    /**
     * Find a N record
     * @param {string} table - Table name
     * @param {object} where - Key-value pairs for WHERE clause
     * @param {number} n - Number of records to return
     * @returns {Promise<object|undefined>} - Found record or undefined
     */
    static async findN(table, where, n = 1) {
        const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
        const values = Object.values(where);

        const sql = `SELECT * FROM ${table} WHERE ${whereClause} LIMIT ${n}`;
        return db.get(sql, values);
    }

    /**
     * Find all records matching criteria
     * @param {string} table - Table name
     * @param {object} where - Key-value pairs for WHERE clause (optional)
     * @param {string} orderBy - ORDER BY clause (optional, e.g., "created_at DESC")
     * @returns {Promise<Array>} - Array of records
     */
    static async findAll(table, where = {}, orderBy = null) {
        let sql = `SELECT * FROM ${table}`;
        const values = [];

        if (Object.keys(where).length > 0) {
            const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
            sql += ` WHERE ${whereClause}`;
            values.push(...Object.values(where));
        }

        if (orderBy) {
            sql += ` ORDER BY ${orderBy}`;
        }

        return db.all(sql, values);
    }

    /**
     * Count records matching criteria
     * @param {string} table - Table name
     * @param {object} where - Key-value pairs for WHERE clause (optional)
     * @returns {Promise<number>} - Count of records
     */
    static async count(table, where = {}) {
        let sql = `SELECT COUNT(*) as count FROM ${table}`;
        const values = [];

        if (Object.keys(where).length > 0) {
            const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
            sql += ` WHERE ${whereClause}`;
            values.push(...Object.values(where));
        }

        const result = await db.get(sql, values);
        return result ? result.count : 0;
    }

    /**
     * Check if a record exists
     * @param {string} table - Table name
     * @param {object} where - Key-value pairs for WHERE clause
     * @returns {Promise<boolean>} - True if exists, false otherwise
     */
    static async exists(table, where) {
        const count = await this.count(table, where);
        return count > 0;
    }
}

module.exports = SQLUtils;
