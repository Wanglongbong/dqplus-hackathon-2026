const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { authorizeAdmin } = require('../middleware/authorizeAdmin');
const { checkIn, createSession, getSession, listVenues, respondToInvite, saveFeedback, selectVenue } = require('../services/coffeeSession.service');
const { createCheckout } = require('../services/payment.service');

const router = Router();
router.use(authenticate);

router.post('/', authorize('investor'), async (req, res, next) => {
  try { res.status(201).json({ session: await createSession(req.user.sub, req.body) }); }
  catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try { res.json({ session: await getSession(req.params.id, req.user.sub) }); }
  catch (error) { next(error); }
});

router.post('/:id/respond', authorize('founder'), async (req, res, next) => {
  try { res.json({ session: await respondToInvite(req.params.id, req.user.sub, req.body) }); }
  catch (error) { next(error); }
});

router.get('/:id/venues', async (req, res, next) => {
  try { res.json({ venues: await listVenues(req.params.id, req.user.sub) }); }
  catch (error) { next(error); }
});

router.post('/:id/venue', authorize('investor'), async (req, res, next) => {
  try { res.json({ session: await selectVenue(req.params.id, req.user.sub, req.body.venueId) }); }
  catch (error) { next(error); }
});

router.post('/:id/checkout', authorize('investor'), async (req, res, next) => {
  try { res.status(201).json({ payment: await createCheckout(req.params.id, req.user.sub) }); }
  catch (error) { next(error); }
});

router.post('/:id/check-in', authorizeAdmin, async (req, res, next) => {
  try { res.json({ session: await checkIn(req.params.id, req.user.sub, req.body.participantIds) }); }
  catch (error) { next(error); }
});

router.post('/:id/feedback', async (req, res, next) => {
  try { res.status(201).json({ feedback: await saveFeedback(req.params.id, req.user.sub, req.body) }); }
  catch (error) { next(error); }
});

module.exports = router;
