const WebSocket = require('ws');

class WebSocketManager {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.clients = new Set();
        
        this.wss.on('connection', (ws) => {
            console.log('新客户端连接');
            this.clients.add(ws);
            
            ws.on('close', () => {
                this.clients.delete(ws);
                console.log('客户端断开');
            });
            
            ws.on('error', (err) => {
                console.error('WebSocket错误:', err);
            });
        });
        
        console.log('✅ WebSocket服务器已启动');
    }
    
    broadcast(type, data) {
        const message = JSON.stringify({
            type,
            data,
            timestamp: Date.now()
        });
        
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
    
    broadcastStats(stats) {
        this.broadcast('STATS_UPDATE', stats);
    }
    
    broadcastComment(postId, comment) {
        this.broadcast('NEW_COMMENT', { postId, comment });
    }
    
    broadcastLike(postId, likes, userId, isLike) {
        this.broadcast('LIKE_UPDATE', { postId, likes, userId, isLike });
    }
    
    broadcastNewPost(post) {
        this.broadcast('NEW_POST', post);
    }
}

module.exports = WebSocketManager;