const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const { MatchFeedback, Profile, User } = require('../models');
const { internalRequest } = require('../services/internal.service');

const router = Router();
router.use(authenticate);

function publicMatch(match) {
  const attributes = { ...(match.attributes || {}) };
  attributes.evidence = (attributes.evidence || []).filter((source) => {
    try { return !new URL(source.url).hostname.toLowerCase().endsWith('linkedin.com'); }
    catch { return false; }
  });
  return { ...match, attributes };
}

async function currentUser(id) {
  const user = await User.findByPk(id, { include: [{ model: Profile, as: 'profile' }] });
  if (!user?.profile) {
    const err = new Error('Complete your profile first');
    err.status = 409;
    throw err;
  }
  if (user.profile.profile_status !== 'ready') {
    const err = new Error('Mark your profile Ready before using discovery');
    err.status = 409;
    throw err;
  }
  return user;
}

/**
 * @openapi
 * /discovery/refresh:
 *   post:
 *     summary: Refresh the current user's structured profile and embedding
 *     tags: [Discovery]
 *     responses:
 *       200: { description: Profile refreshed }
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const user = await currentUser(req.user.sub);
    await user.profile.update({ extraction_status: 'pending' });
    try {
      const result = await internalRequest(process.env.EXTRACT_SERVICE_URL, '/extract/profile', {
        method: 'POST', body: { userId: user.id },
      });
      await user.profile.update({ extraction_status: 'ready' });
      res.json({ status: 'ready', extractedAt: result.updated_at || new Date().toISOString() });
    } catch (err) {
      await user.profile.update({ extraction_status: 'failed' });
      throw err;
    }
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /discovery/matches:
 *   get:
 *     summary: Get verified opposite-role matches with evidence and confidence
 *     tags: [Discovery]
 *     responses:
 *       200: { description: Ranked matches }
 */
router.get('/matches', async (req, res, next) => {
  try {
    const user = await currentUser(req.user.sub);
    const target = user.role === 'investor' ? 'founders' : 'investors';
    const source = user.role === 'investor' ? 'investors' : 'founders';
    const params = new URLSearchParams();
    for (const key of ['limit', 'sector', 'stage', 'region']) if (req.query[key]) params.set(key, req.query[key]);
    const result = await internalRequest(
      process.env.MATCH_SERVICE_URL || 'http://localhost:3002',
      `/matches/${source}/${user.id}/${target}?${params.toString()}`,
    );
    const feedback = await MatchFeedback.findAll({ where: { requesterUserId: user.id } });
    const byCandidate = new Map(feedback.map((item) => [item.candidateUserId, item]));
    result.matches = (result.matches || [])
      .filter((match) => byCandidate.get(match.userId)?.action !== 'not_relevant')
      .map((match) => ({ ...publicMatch(match), saved: byCandidate.get(match.userId)?.action === 'saved' }));
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/feedback', async (req, res, next) => {
  try {
    const { candidateUserId, action, reason } = req.body;
    if (!candidateUserId || !['saved', 'not_relevant'].includes(action)) {
      return res.status(400).json({ error: 'candidateUserId and a valid action are required' });
    }
    const [item] = await MatchFeedback.upsert({ requesterUserId: req.user.sub, candidateUserId, action, reason });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

module.exports = router;
