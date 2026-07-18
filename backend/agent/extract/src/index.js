const app = require('./app');
const initSchema = require('./db/init');

const port = process.env.PORT || 3001;
const host = process.env.HOST || '127.0.0.1';

async function start() {
  const token = process.env.INTERNAL_SERVICE_TOKEN || '';
  if (process.env.NODE_ENV === 'production' && (token.length < 32 || token.includes('local-service-token'))) {
    throw new Error('A strong INTERNAL_SERVICE_TOKEN is required in production');
  }
  await initSchema();

  app.listen(port, host, () => {
    console.log(`Extract agent listening on ${host}:${port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start extract agent:', err);
  process.exit(1);
});
