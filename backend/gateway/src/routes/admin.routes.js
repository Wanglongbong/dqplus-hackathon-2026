const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const { authorizeAdmin } = require('../middleware/authorizeAdmin');
const { ConnectionRequest, Opportunity, Profile, Report, User } = require('../models');

const router = Router();
router.use(authenticate, authorizeAdmin);

router.get('/review', async (req, res, next) => {
  try {
    const [profiles, reports] = await Promise.all([
      Profile.findAll({
        where: { verification_status: 'pending' },
        include: [{ model: User, as: 'owner', attributes: ['id', 'username', 'role'] }],
        order: [['updatedAt', 'ASC']],
      }),
      Report.findAll({
        where: { status: 'open' },
        include: [
          { model: User, as: 'reporter', attributes: ['id', 'username', 'role'] },
          { model: User, as: 'target', attributes: ['id', 'username', 'role'] },
          { model: Opportunity, as: 'opportunity', attributes: ['id', 'title', 'status'] },
          { model: ConnectionRequest, as: 'connection', attributes: ['id', 'intent', 'status'] },
        ],
        order: [['createdAt', 'ASC']],
      }),
    ]);
    res.json({ profiles, reports });
  } catch (err) { next(err); }
});

router.patch('/profiles/:id/verification', async (req, res, next) => {
  try {
    const status = req.body.status;
    if (!['verified', 'unverified'].includes(status)) return res.status(400).json({ error: 'Invalid verification status' });
    const profile = await Profile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    await profile.update({
      verification_status: status,
      verification_method: status === 'verified' ? 'admin_review' : 'admin_rejected',
      verified_at: status === 'verified' ? new Date() : null,
      extraction_status: 'pending',
    });
    res.json(profile);
  } catch (err) { next(err); }
});

router.patch('/reports/:id', async (req, res, next) => {
  try {
    if (!['reviewed', 'resolved'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid report status' });
    const report = await Report.findByPk(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (req.body.action === 'close_opportunity' && report.opportunityId) {
      await Opportunity.update({ status: 'closed' }, { where: { id: report.opportunityId } });
    }
    await report.update({ status: req.body.status });
    res.json(report);
  } catch (err) { next(err); }
});

module.exports = router;
