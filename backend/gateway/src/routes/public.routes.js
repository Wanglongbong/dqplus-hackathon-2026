const { Router } = require('express');
const { createEdges, getPublicDeal, listPublicDeals, listPulse } = require('../services/publicDeal.service');

const router = Router();

router.get('/deals', async (req, res, next) => {
  try {
    const deals = await listPublicDeals(req.query);
    res.json({ deals, dataMode: deals.some((item) => item.is_demo) ? 'mixed_or_demo' : 'live' });
  } catch (error) { next(error); }
});

router.get('/deals/:alias', async (req, res, next) => {
  try {
    const deal = await getPublicDeal(req.params.alias);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    return res.json({ deal });
  } catch (error) { return next(error); }
});

router.get('/pulse', async (req, res, next) => {
  try { res.json({ events: await listPulse(req.query.limit) }); }
  catch (error) { next(error); }
});

router.get('/constellation', async (req, res, next) => {
  try {
    const nodes = await listPublicDeals({ limit: req.query.limit || 60 });
    res.json({ nodes, edges: createEdges(nodes) });
  } catch (error) { next(error); }
});

module.exports = router;
