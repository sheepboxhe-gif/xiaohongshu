# 🍠 小红薯部署指南

## 系统要求

- Node.js >= 16.0.0
- 内存 >= 512MB
- 磁盘空间 >= 1GB

## 快速部署

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式启动

```bash
npm run dev
```

访问 http://localhost:3000

### 3. 生产环境部署（推荐）

#### 使用 PM2 进程管理器

```bash
# 全局安装 PM2
npm install -g pm2

# 创建日志目录
mkdir -p logs

# 启动服务
npm run pm2:start

# 查看状态
pm2 status

# 查看日志
npm run pm2:logs

# 重启服务
npm run pm2:restart

# 停止服务
npm run pm2:stop
```

#### 使用 systemctl（Linux）

```bash
# 创建服务文件
sudo nano /etc/systemd/system/xiaohongshu.service
```

写入以下内容：

```ini
[Unit]
Description=小红薯实时互动社区
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/xiaohongshu
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable xiaohongshu
sudo systemctl start xiaohongshu
sudo systemctl status xiaohongshu
```

## Nginx 反向代理（推荐）

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 静态文件
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket 支持
        proxy_read_timeout 86400;
    }
}
```

## HTTPS 配置（Let's Encrypt）

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

## 云服务器部署

### 阿里云/腾讯云/AWS

1. 开放安全组端口：80, 443, 3000（可选）
2. 使用 Nginx 反向代理
3. 配置域名解析
4. 启用 HTTPS

### Docker 部署（可选）

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

构建和运行：

```bash
docker build -t xiaohongshu .
docker run -d -p 3000:3000 -v $(pwd)/xiaohongshu.db:/app/xiaohongshu.db --name xiaohongshu xiaohongshu
```

## 性能优化

### 数据库优化

- 已启用 SQLite WAL 模式，支持高并发读写
- 建议定期备份数据库：`cp xiaohongshu.db xiaohongshu.db.backup`

### WebSocket 优化

- 支持多客户端实时连接
- 自动重连机制
- 心跳检测

### 监控

```bash
# 查看 PM2 监控面板
pm2 monit

# 查看日志
pm2 logs xiaohongshu --lines 100
```

## 管理员密码

默认管理员密码：`admin123`

生产环境请务必修改！

## 故障排查

### WebSocket 连接失败

1. 检查防火墙是否开放端口
2. 检查 Nginx 配置是否正确
3. 查看服务器日志

### 数据库锁定

```bash
# 修复数据库
sqlite3 xiaohongshu.db ".recover" | sqlite3 xiaohongshu.db.fixed
mv xiaohongshu.db xiaohongshu.db.corrupt
mv xiaohongshu.db.fixed xiaohongshu.db
```

### 内存不足

```bash
# 限制 Node.js 内存使用
node --max-old-space-size=512 server.js
```

## 备份策略

```bash
#!/bin/bash
# backup.sh - 每天凌晨 3 点备份
DATE=$(date +%Y%m%d_%H%M%S)
cp /path/to/xiaohongshu.db /backup/xiaohongshu_$DATE.db
gzip /backup/xiaohongshu_$DATE.db
# 保留最近 7 天
find /backup -name "xiaohongshu_*.db.gz" -mtime +7 -delete
```

添加定时任务：

```bash
0 3 * * * /path/to/backup.sh
```

## 更新部署

```bash
# 拉取最新代码
git pull

# 安装新依赖
npm install

# 重启服务
npm run pm2:restart
```

## 联系支持

如有问题，请查看日志文件或提交 Issue。
