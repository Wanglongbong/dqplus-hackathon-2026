const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const opportunityService = require('../services/opportunity.service');

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * /opportunities:
 *   get:
 *     summary: List active community opportunities
 *     tags: [Opportunities]
 *     responses:
 *       200: { description: Opportunity list }
 *   post:
 *     summary: Publish a time-limited opportunity as a verified member
 *     tags: [Opportunities]
 *     responses:
 *       201: { description: Opportunity created }
 */
router.get('/', async (req, res, next) => {
  try {
    res.json({ opportunities: await opportunityService.listOpportunities(req.query) });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await opportunityService.createOpportunity(req.user.sub, req.body));
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    res.json(await opportunityService.updateOpportunity(req.user.sub, req.params.id, req.body));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /opportunities/{id}/report:
 *   post:
 *     summary: Report a community opportunity for moderator review
 *     tags: [Opportunities]
 *     responses:
 *       201: { description: Report submitted }
 */
router.post('/:id/report', async (req, res, next) => {
  try {
    await opportunityService.reportOpportunity(req.user.sub, req.params.id, req.body);
    res.status(201).json({ status: 'reported' });
  } catch (err) { next(err); }
});

module.exports = router;
