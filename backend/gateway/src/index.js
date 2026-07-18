const app = require('./app');
const { sequelize } = require('./models');
const migrate = require('./db/migrate');

const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';

async function start() {
  const jwtSecret = process.env.JWT_SECRET || '';
  if (process.env.NODE_ENV === 'production'
    && (jwtSecret.length < 32 || jwtSecret.includes('local-jwt-secret') || jwtSecret.includes('change-me'))) {
    throw new Error('A strong JWT_SECRET is required in production');
  }
  const serviceToken = process.env.INTERNAL_SERVICE_TOKEN || '';
  if (process.env.NODE_ENV === 'production' && (serviceToken.length < 32 || serviceToken.includes('local-service-token'))) {
    throw new Error('A strong INTERNAL_SERVICE_TOKEN is required in production');
  }
  if (process.env.NODE_ENV === 'production' && String(process.env.DB_PASSWORD || '').includes('local-development-only')) {
    throw new Error('Replace the local database password before starting production');
  }
  await sequelize.authenticate();
  await migrate();

  app.listen(port, host, () => {
    console.log(`Gateway listening on ${host}:${port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start gateway:', err);
  process.exit(1);
});
