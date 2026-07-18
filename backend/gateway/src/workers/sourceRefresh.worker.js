require('dotenv').config();
const migrate = require('../db/migrate');
const { sequelize } = require('../models');
const { refreshDueSources } = require('../services/sourceRefresh.service');

const intervalMs = Math.max(Number(process.env.SOURCE_REFRESH_INTERVAL_MS) || 86_400_000, 60_000);

async function run() {
  await sequelize.authenticate();
  await migrate();
  const summary = await refreshDueSources(process.env.SOURCE_REFRESH_BATCH_SIZE || 50);
  console.log('Source refresh complete', summary);
}

async function start() {
  await run();
  setInterval(() => run().catch((error) => console.error('Source refresh failed', error)), intervalMs);
}

start().catch((error) => { console.error(error); process.exit(1); });
