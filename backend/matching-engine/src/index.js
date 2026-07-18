const app = require('./app');

const port = process.env.PORT || 3002;
const host = process.env.HOST || '127.0.0.1';

const token = process.env.INTERNAL_SERVICE_TOKEN || '';
if (process.env.NODE_ENV === 'production' && (token.length < 32 || token.includes('local-service-token'))) {
  throw new Error('A strong INTERNAL_SERVICE_TOKEN is required in production');
}

app.listen(port, host, () => {
  console.log(`Matching engine listening on ${host}:${port}`);
});
