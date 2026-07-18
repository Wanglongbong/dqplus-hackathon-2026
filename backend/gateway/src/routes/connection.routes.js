const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const connectionService = require('../services/connection.service');

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * /connections:
 *   post:
 *     summary: Send a consent-based connection request
 *     tags: [Connections]
 *     responses:
 *       201: { description: Request created }
 *   get:
 *     summary: List sent and received connection requests
 *     tags: [Connections]
 *     responses:
 *       200: { description: Connection list }
 */
router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await connectionService.createConnection(req.user.sub, req.body));
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    res.json({ connections: await connectionService.listConnections(req.user.sub, req.query) });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /connections/{id}:
 *   patch:
 *     summary: Accept, decline, save, or withdraw a pending request
 *     tags: [Connections]
 *     responses:
 *       200: { description: Updated request }
 */
router.patch('/:id', async (req, res, next) => {
  try {
    res.json(await connectionService.actOnConnection(req.user.sub, req.params.id, req.body.action));
  } catch (err) { next(err); }
});

router.post('/:id/report', async (req, res, next) => {
  try {
    if (!String(req.body.reason || '').trim()) return res.status(400).json({ error: 'reason is required' });
    await connectionService.reportConnection(req.user.sub, req.params.id, req.body);
    res.status(201).json({ status: 'reported' });
  } catch (err) { next(err); }
});

module.exports = router;
