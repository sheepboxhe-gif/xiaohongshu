# 🍠 小红薯 - 实时互动社区

一个支持多人实时互动的轻量级社区平台，无需注册，登记即可参与互动。

## ✨ 功能特性

- 🔥 **实时互动** - WebSocket 实时推送评论、点赞、新帖子
- 👥 **多人同时在线** - 支持多人同时浏览、评论、点赞
- 📊 **实时统计** - 实时显示用户性别、年龄分布统计
- 🔐 **管理员功能** - 发帖、删帖、清除数据（密码保护）
- 👤 **用户模式** - 登记后即可评论、点赞
- 💾 **数据持久化** - SQLite 数据库存储，重启不丢失

## 🚀 快速开始

### 方式一：一键启动（推荐）

```bash
./start.sh
```

### 方式二：手动启动

```bash
# 安装依赖
npm install

# 启动服务器
npm start
```

访问 http://localhost:3000

### 方式三：生产部署

```bash
# 使用 PM2 进程管理
npm install -g pm2
npm run pm2:start
```

详见 [DEPLOY.md](./DEPLOY.md)

## 🔑 管理员密码

默认密码：`admin123`

**⚠️ 生产环境请务必修改！**

修改方法：编辑 `server.js` 第 15 行

```javascript
const ADMIN_PASSWORD = '你的新密码';
```

## 📡 实时功能说明

### WebSocket 事件

| 事件类型 | 说明 |
|---------|------|
| STATS_UPDATE | 统计数据更新（新用户登记） |
| NEW_COMMENT | 新评论 |
| LIKE_UPDATE | 点赞数更新 |
| NEW_POST | 新帖子发布 |

### 多人互动场景

- 用户 A 发表评论 → 所有在线用户实时看到
- 用户 B 点赞 → 点赞数实时更新给所有人
- 用户 C 登记 → 统计图表实时刷新
- 管理员发帖 → 所有用户收到新帖子通知

## 🏗️ 技术架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   浏览器 A   │◄───►│  WebSocket  │◄───►│   浏览器 B   │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │  Express    │
                    │  Server     │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │   SQLite    │
                    │  Database   │
                    └─────────────┘
```

## 📁 项目结构

```
xiaohongshu/
├── server.js          # 服务器主程序
├── database.js        # 数据库操作
├── websocket.js       # WebSocket 管理
├── package.json       # 项目配置
├── ecosystem.config.js # PM2 配置
├── start.sh           # 启动脚本
├── DEPLOY.md          # 部署文档
├── xiaohongshu.db     # SQLite 数据库（自动生成）
└── public/            # 前端文件
    ├── index.html     # 页面结构
    ├── app.js         # 前端逻辑
    └── style.css      # 样式
```

## 🔧 环境要求

- Node.js >= 16.0.0
- 支持平台：Linux / macOS / Windows

## 📝 数据库表结构

### users（用户表）
| 字段 | 说明 |
|-----|------|
| id | 用户ID |
| avatar | 头像 |
| userId | 用户标识 |
| gender | 性别（男/女）|
| age | 年龄段 |

### posts（帖子表）
| 字段 | 说明 |
|-----|------|
| id | 帖子ID |
| content | 内容 |
| author | 作者 |
| likes | 点赞数 |

### comments（评论表）
| 字段 | 说明 |
|-----|------|
| id | 评论ID |
| post_id | 所属帖子 |
| user_id | 评论用户 |
| content | 内容 |

## 🐛 常见问题

### WebSocket 连接失败

1. 检查防火墙是否开放端口
2. 如果使用 Nginx，确认配置了 WebSocket 支持
3. 检查浏览器控制台网络日志

### 数据库锁定

SQLite 在高并发下可能出现锁定，已启用 WAL 模式优化。如仍有问题：

```bash
# 修复数据库
sqlite3 xiaohongshu.db ".recover" | sqlite3 xiaohongshu.db.fixed
```

### 内存不足

```bash
# 限制内存使用
node --max-old-space-size=512 server.js
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 PR！

---

🍠  Enjoy!
