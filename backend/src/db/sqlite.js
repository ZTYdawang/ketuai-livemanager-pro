import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

async function initSQLite() {
  try {
    // 打开SQLite数据库文件
    db = await open({
      filename: join(__dirname, '../../ketu_live_score.db'),
      driver: sqlite3.Database
    });

    console.log('Connected to SQLite database!');

    // 创建用户表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone_number VARCHAR(20) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建主播表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS anchors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        avatar VARCHAR(255),
        gender TEXT CHECK(gender IN ('male', 'female')) NOT NULL,
        age INTEGER,
        rating TEXT CHECK(rating IN ('top', 'experienced', 'regular', 'probation')) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 删除旧的直播间表（如果存在），重新创建完整版本
    await db.exec('DROP TABLE IF EXISTS live_rooms');
    
    // 创建直播间表（完整版本，包含所有字段）
    await db.exec(`
      CREATE TABLE live_rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        url VARCHAR(500),
        status TEXT CHECK(status IN ('MONITORING', 'IDLE', 'OFFLINE', 'ERROR')) DEFAULT 'IDLE',
        viewer_count INTEGER DEFAULT 0,
        last_checked DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 插入测试用户
    await db.run(`
      INSERT OR IGNORE INTO users (username, email, password_hash)
      VALUES ('admin', 'admin@163.com', '$2a$10$62gKvMd.mHzOIj2W195pZOaGFoEUBSIXtmHW2yFVRbm6d3GhpgC6a')
    `);

    console.log('SQLite database initialized successfully!');
    
  } catch (error) {
    console.error('Error initializing SQLite database:', error);
    throw error;
  }
}

export default {
  async query(text, params = []) {
    if (!db) {
      await initSQLite();
    }
    
    // 转换PostgreSQL语法到SQLite
    let sqliteQuery = text;
    
    // 转换RETURNING语句
    if (text.includes('RETURNING')) {
      sqliteQuery = text.split('RETURNING')[0];
    }
    
    // 转换参数占位符从$1, $2 到 ?, ?
    sqliteQuery = sqliteQuery.replace(/\$(\d+)/g, '?');
    
    try {
      if (text.toUpperCase().startsWith('SELECT') || text.toUpperCase().startsWith('PRAGMA')) {
        const result = await db.all(sqliteQuery, params);
        return { rows: result };
      } else if (text.toUpperCase().startsWith('INSERT')) {
        const result = await db.run(sqliteQuery, params);
        if (text.includes('RETURNING')) {
          // 如果是INSERT RETURNING，需要获取刚插入的记录
          const tableName = text.match(/INSERT INTO (\w+)/)[1];
          const inserted = await db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [result.lastID]);
          return { rows: [inserted] };
        }
        return { rows: [], rowCount: result.changes };
      } else {
        const result = await db.run(sqliteQuery, params);
        return { rows: [], rowCount: result.changes };
      }
    } catch (error) {
      console.error('SQLite query error:', error);
      throw error;
    }
  }
};

// 初始化数据库
initSQLite().catch(console.error); 