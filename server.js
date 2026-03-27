const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const db = require('./database');

const app = express();
const server = http.createServer(app);

// WebSocket 服务器配置，支持多客户端
const wss = new WebSocket.Server({ 
    server,
    // 允许所有来源连接（生产环境建议配置具体域名）
    verifyClient: (info) => {
        console.log(`WebSocket 连接请求: ${info.origin}`);
        return true;
    }
});

const ADMIN_PASSWORD = 'admin123';

// CORS 配置 - 允许跨域访问
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 广播消息给所有客户端
function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// ========== 用户注册 ==========
app.post('/api/register', (req, res) => {
    const { avatar, userId, gender, age } = req.body;
    
    if (!avatar || !userId || !gender || !age) {
        return res.json({ success: false, error: '请填写完整信息' });
    }
    
    db.addUser(avatar, userId, gender, age, (err, user) => {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.json({ success: false, error: '该用户ID已被使用' });
            }
            return res.json({ success: false, error: '注册失败' });
        }
        
        // 广播统计更新
        db.getStats((stats) => {
            broadcast({ type: 'STATS_UPDATE', data: stats });
        });
        
        res.json({ success: true, user });
    });
});

// ========== 统计数据 ==========
app.get('/api/stats', (req, res) => {
    db.getStats((stats) => {
        res.json(stats);
    });
});

// ========== 清除统计数据（仅管理员） ==========
app.post('/api/stats/clear', (req, res) => {
    const { password } = req.body;
    
    if (password !== ADMIN_PASSWORD) {
        return res.json({ success: false, error: '密码错误' });
    }
    
    db.clearAllUsers((err) => {
        if (err) {
            console.error('清除数据失败:', err);
            return res.json({ success: false, error: '清除失败' });
        }
        
        // 广播统计更新
        db.getStats((stats) => {
            broadcast({ type: 'STATS_UPDATE', data: stats });
        });
        
        res.json({ success: true });
    });
});

// ========== 帖子相关 ==========
app.get('/api/posts', (req, res) => {
    db.getAllPosts((err, posts) => {
        if (err) return res.status(500).json({ error: '获取失败' });
        res.json(posts);
    });
});

app.post('/api/post', (req, res) => {
    const { content, password } = req.body;
    
    if (password !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: '无权限' });
    }
    
    if (!content || !content.trim()) {
        return res.status(400).json({ error: '内容不能为空' });
    }
    
    db.addPost(content.trim(), (err, post) => {
        if (err) return res.status(500).json({ error: '发布失败' });
        
        broadcast({ type: 'NEW_POST', data: post });
        res.json({ success: true, post });
    });
});

app.delete('/api/posts/:id', (req, res) => {
    const { password } = req.body;
    
    if (password !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: '无权限' });
    }
    
    db.deletePost(req.params.id, (err) => {
        if (err) return res.status(500).json({ error: '删除失败' });
        res.json({ success: true });
    });
});

// ========== 评论相关 ==========
app.get('/api/posts/:id/comments', (req, res) => {
    db.getCommentsByPost(req.params.id, (err, comments) => {
        if (err) return res.status(500).json({ error: '获取失败' });
        res.json(comments);
    });
});

app.post('/api/comment', (req, res) => {
    const { postId, userId, content, parentId } = req.body;
    
    if (!postId || !userId || !content || !content.trim()) {
        return res.status(400).json({ error: '参数错误' });
    }
    
    db.addComment(postId, userId, content.trim(), parentId, (err, comment) => {
        if (err) return res.status(500).json({ error: '评论失败' });
        
        broadcast({ type: 'NEW_COMMENT', data: { postId, comment } });
        res.json({ success: true, comment });
    });
});

// ========== 点赞相关 ==========
app.post('/api/like', (req, res) => {
    const { postId, userId, action } = req.body;
    
    if (action === 'like') {
        db.likePost(postId, userId, (err) => {
            if (err) return res.status(500).json({ error: '点赞失败' });
            
            db.db.get('SELECT likes FROM posts WHERE id = ?', [postId], (err, row) => {
                if (!err && row) {
                    broadcast({ type: 'LIKE_UPDATE', data: { postId, likes: row.likes } });
                }
            });
            
            res.json({ success: true });
        });
    } else {
        db.unlikePost(postId, userId, (err) => {
            if (err) return res.status(500).json({ error: '取消点赞失败' });
            
            db.db.get('SELECT likes FROM posts WHERE id = ?', [postId], (err, row) => {
                if (!err && row) {
                    broadcast({ type: 'LIKE_UPDATE', data: { postId, likes: row.likes } });
                }
            });
            
            res.json({ success: true });
        });
    }
});

// ========== WebSocket ==========
wss.on('connection', (ws) => {
    console.log('新客户端连接');
    
    // 发送当前统计
    db.getStats((stats) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'STATS_UPDATE', data: stats }));
        }
    });
    
    // 处理客户端消息（心跳检测）
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
            }
        } catch (e) {
            // 忽略非 JSON 消息
        }
    });
    
    ws.on('error', (err) => {
        console.error('WebSocket 客户端错误:', err);
    });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
});