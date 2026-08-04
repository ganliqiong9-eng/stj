module.exports = {
  apps: [
    {
      name: 'stj-backend',
      script: 'server.mjs',
      cwd: '/Users/albee/Documents/stj',
      env: { NODE_ENV: 'production', PORT: 8086 },
      max_memory_restart: '1G',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
    },
    {
      name: 'stj-frontend',
      script: 'node_modules/.bin/vite',
      args: 'preview --host 0.0.0.0 --port 8081',
      cwd: '/Users/albee/Documents/stj',
      max_memory_restart: '512M',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
    },
  ],
}
