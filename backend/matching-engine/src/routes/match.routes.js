const { Router } = require('express');
const { findMatches } = require('../services/matching.service');

const router = Router();

function parseLimit(value) {
  const n = Number.parseInt(value, 10) || 10;
  return Math.min(Math.max(n, 1), 50);
}

router.get('/matches/founders/:userId/investors', async (req, res, next) => {
  try {
    const result = await findMatches({
      userId: req.params.userId,
      targetRole: 'investor',
      limit: parseLimit(req.query.limit),
      filters: { sector: req.query.sector, stage: req.query.stage, region: req.query.region },
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/matches/investors/:userId/founders', async (req, res, next) => {
  try {
    const result = await findMatches({
      userId: req.params.userId,
      targetRole: 'founder',
      limit: parseLimit(req.query.limit),
      filters: { sector: req.query.sector, stage: req.query.stage, region: req.query.region },
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
