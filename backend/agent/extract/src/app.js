const express = require('express');
const extractRouter = require('./routes/extract.routes');
const errorHandler = require('./middleware/errorHandler');
const pool = require('./config/db');
const serviceAuth = require('./middleware/serviceAuth');

const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'unavailable' });
  }
});

app.use('/', serviceAuth, extractRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

module.exports = app;
