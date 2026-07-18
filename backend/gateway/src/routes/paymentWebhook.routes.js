const { Router } = require('express');
const { processPayOSWebhook } = require('../services/payment.service');

const router = Router();

router.post('/payos', async (req, res, next) => {
  try {
    const result = await processPayOSWebhook(req.body);
    res.json({ success: true, duplicate: result.duplicate });
  } catch (error) { next(error); }
});

module.exports = router;
