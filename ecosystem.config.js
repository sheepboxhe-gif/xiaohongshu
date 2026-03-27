module.exports = {
  apps: [{
    name: 'xiaohongshu',
    script: './server.js',
    instances: 1,           // 单实例模式（WebSocket 需要粘性会话）
    exec_mode: 'fork',      // fork 模式支持 WebSocket
    watch: false,           // 生产环境关闭文件监视
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // 日志配置
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    // 自动重启配置
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    // 崩溃后延迟重启
    restart_delay: 3000,
    // 优雅关闭
    kill_timeout: 5000,
    listen_timeout: 10000
  }]
};
