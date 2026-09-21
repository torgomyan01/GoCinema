module.exports = {
  apps: [
    {
      name: 'gocinema',
      cwd: '/var/www/GoCinema',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 127.0.0.1 -p 3000',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '127.0.0.1',
      },
      max_memory_restart: '1G',
      time: true,
      error_file: '/var/log/gocinema-error.log',
      out_file: '/var/log/gocinema-out.log',
      merge_logs: true,
    },
  ],
};
