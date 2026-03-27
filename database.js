const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'xiaohongshu.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) console.error('数据库连接失败:', err);
    else {
        console.log('✅ 数据库连接成功');
        // 启用 WAL 模式，提高并发性能
        db.run('PRAGMA journal_mode = WAL;', (err) => {
            if (err) console.error('WAL 模式启用失败:', err);
            else console.log('✅ WAL 模式已启用，支持高并发');
        });
        // 设置同步模式为 NORMAL，平衡性能和安全性
        db.run('PRAGMA synchronous = NORMAL;');
        // 设置缓存大小
        db.run('PRAGMA cache_size = 10000;');
        initTables();
    }
});

function initTables() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            avatar TEXT NOT NULL,
            userId TEXT UNIQUE NOT NULL,
            gender TEXT CHECK(gender IN ('男', '女')),
            age TEXT CHECK(age IN ('18-30岁', '31-45岁', '46-55岁')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            author TEXT DEFAULT '管理员',
            likes INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
            user_id TEXT REFERENCES users(userId),
            content TEXT NOT NULL,
            parent_id INTEGER REFERENCES comments(id),
            likes INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS post_likes (
            post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
            user_id TEXT REFERENCES users(userId),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (post_id, user_id)
        )`);

        console.log('✅ 数据表初始化完成');
    });
}

module.exports = {
    db,
    
    addUser(avatar, userId, gender, age, callback) {
        db.run('INSERT INTO users (avatar, userId, gender, age) VALUES (?, ?, ?, ?)',
            [avatar, userId, gender, age], function(err) {
            callback(err, { id: this.lastID, avatar, userId, gender, age });
        });
    },

    getAllUsers(callback) {
        db.all('SELECT * FROM users ORDER BY created_at DESC', [], callback);
    },

    getStats(callback) {
        db.get('SELECT COUNT(*) as count FROM users WHERE gender="男"', [], (err, male) => {
            db.get('SELECT COUNT(*) as count FROM users WHERE gender="女"', [], (err, female) => {
                db.get('SELECT COUNT(*) as count FROM users WHERE age="18-30岁"', [], (err, age1) => {
                    db.get('SELECT COUNT(*) as count FROM users WHERE age="31-45岁"', [], (err, age2) => {
                        db.get('SELECT COUNT(*) as count FROM users WHERE age="46-55岁"', [], (err, age3) => {
                            callback({
                                male: male?.count || 0,
                                female: female?.count || 0,
                                age18_30: age1?.count || 0,
                                age31_45: age2?.count || 0,
                                age46_55: age3?.count || 0,
                                total: (male?.count || 0) + (female?.count || 0)
                            });
                        });
                    });
                });
            });
        });
    },

    // 清除所有用户数据（仅管理员）
    clearAllUsers(callback) {
        db.serialize(() => {
            // 先删除点赞记录（因为有外键约束）
            db.run('DELETE FROM post_likes', [], (err) => {
                if (err) return callback(err);
                
                // 删除评论
                db.run('DELETE FROM comments', [], (err) => {
                    if (err) return callback(err);
                    
                    // 删除用户
                    db.run('DELETE FROM users', [], (err) => {
                        if (err) return callback(err);
                        
                        // 重置自增ID
                        db.run('DELETE FROM sqlite_sequence WHERE name="users"', [], (err) => {
                            callback(err);
                        });
                    });
                });
            });
        });
    },

    addPost(content, callback) {
        db.run('INSERT INTO posts (content, author) VALUES (?, ?)', [content, '管理员'], function(err) {
            callback(err, { id: this.lastID, content, author: '管理员', likes: 0, created_at: new Date().toISOString() });
        });
    },

    getAllPosts(callback) {
        db.all('SELECT * FROM posts ORDER BY created_at DESC', [], callback);
    },

    deletePost(postId, callback) {
        db.run('DELETE FROM posts WHERE id = ?', [postId], callback);
    },

    addComment(postId, userId, content, parentId, callback) {
        db.run('INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)',
            [postId, userId, content, parentId || null], function(err) {
            if (err) return callback(err);
            db.get('SELECT c.*, u.avatar, u.gender FROM comments c LEFT JOIN users u ON c.user_id=u.userId WHERE c.id=?',
                [this.lastID], callback);
        });
    },

    getCommentsByPost(postId, callback) {
        db.all('SELECT c.*, u.avatar, u.gender FROM comments c LEFT JOIN users u ON c.user_id=u.userId WHERE c.post_id=? ORDER BY c.created_at ASC',
            [postId], callback);
    },

    likePost(postId, userId, callback) {
        db.run('INSERT OR IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)', [postId, userId], (err) => {
            if (err) return callback(err);
            db.run('UPDATE posts SET likes = likes + 1 WHERE id = ?', [postId], callback);
        });
    },

    unlikePost(postId, userId, callback) {
        db.run('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [postId, userId], (err) => {
            if (err) return callback(err);
            db.run('UPDATE posts SET likes = likes - 1 WHERE id = ?', [postId], callback);
        });
    },

    checkLike(postId, userId, callback) {
        db.get('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?', [postId, userId], (err, row) => {
            callback(err, !!row);
        });
    }
};