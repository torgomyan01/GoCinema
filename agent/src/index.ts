import { loadConfig } from './config.js';
import { createServer } from './server.js';

const config = loadConfig();
const server = createServer(config);

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[gocinema-hdm-agent] Port ${config.port} is already in use on ${config.host}.`
    );
    console.error(
      '[gocinema-hdm-agent] Stop the old agent first: npm run agent:stop'
    );
    console.error(
      '[gocinema-hdm-agent] Or run only Next.js if agent is already running.'
    );
    process.exit(1);
  }
  console.error('[gocinema-hdm-agent] Server error:', err);
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  console.info(
    `[gocinema-hdm-agent] listening on http://${config.host}:${config.port}`
  );
  console.info(
    `[gocinema-hdm-agent] HDM target ${config.hdm.host}:${config.hdm.port}`
  );
  console.info(
    `[gocinema-hdm-agent] CORS origins: ${config.allowOrigins.join(', ')}`
  );
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
