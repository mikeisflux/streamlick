module.exports = {
  apps: [{
    name: 'streamlick-backend',
    script: 'dist/index.js',
    cwd: '/home/user/streamlick/backend',
    env_file: '/home/user/streamlick/backend/.env',
    env: {
      NODE_ENV: 'production',
      NODE_PATH: '/home/user/streamlick/backend/node_modules'
    },
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    disable_trace: true,
    disable_logs: false
  }]
};
