const crypto = require('node:crypto');

function serviceAuth(req, res, next) {
  const expected = process.env.INTERNAL_SERVICE_TOKEN || '';
  const received = req.headers['x-internal-service-token'] || '';
  if (!expected || expected.length < 16 || received.length !== expected.length) {
    return res.status(401).json({ error: 'Unauthorized service request' });
  }
  if (!crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Unauthorized service request' });
  }
  return next();
}

module.exports = serviceAuth;
