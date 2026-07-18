const { Op } = require('sequelize');
const { Opportunity, Profile, Report, User } = require('../models');
const { publicProfileJson } = require('./profile.service');

const TYPES = new Set(['fundraising', 'investment', 'pilot', 'partnership']);

const ownerInclude = [{
  model: User,
  as: 'owner',
  required: true,
  include: [{
    model: Profile,
    as: 'profile',
    required: true,
    where: { profile_status: 'ready', verification_status: 'verified', visibility: 'community' },
  }],
}];
const ownerIncludeAny = [{ model: User, as: 'owner', include: [{ model: Profile, as: 'profile' }] }];

function serialize(row) {
  const item = row.toJSON ? row.toJSON() : row;
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    summary: item.summary,
    criteria: item.criteria,
    status: item.status,
    expiresAt: item.expiresAt,
    createdAt: item.createdAt,
    owner: item.owner ? {
      userId: item.owner.id,
      role: item.owner.role,
      profile: item.owner.profile ? publicProfileJson(item.owner.profile) : null,
    } : null,
  };
}

async function expireOld() {
  await Opportunity.update({ status: 'expired' }, { where: { status: 'active', expiresAt: { [Op.lt]: new Date() } } });
}

async function listOpportunities({ type, role } = {}) {
  await expireOld();
  const where = { status: 'active', expiresAt: { [Op.gt]: new Date() } };
  if (type && TYPES.has(type)) where.type = type;
  const include = role
    ? [{ ...ownerInclude[0], where: { role }, required: true }]
    : ownerInclude;
  const rows = await Opportunity.findAll({ where, include, order: [['createdAt', 'DESC']], limit: 100 });
  return rows.map(serialize);
}

async function createOpportunity(ownerUserId, data) {
  const owner = await User.findByPk(ownerUserId, { include: [{ model: Profile, as: 'profile' }] });
  if (!owner?.profile || owner.profile.profile_status !== 'ready'
    || owner.profile.verification_status !== 'verified' || owner.profile.visibility !== 'community') {
    const err = new Error('Use a Ready, verified community profile before posting an opportunity');
    err.status = 403;
    throw err;
  }
  if (!TYPES.has(data.type)) {
    const err = new Error('Invalid opportunity type');
    err.status = 400;
    throw err;
  }
  await expireOld();
  const activeCount = await Opportunity.count({ where: { ownerUserId, status: 'active' } });
  if (activeCount >= 5) {
    const err = new Error('Close an existing opportunity before publishing another (maximum 5 active)');
    err.status = 429;
    throw err;
  }
  const title = String(data.title || '').trim();
  const summary = String(data.summary || '').trim();
  if (title.length < 5 || title.length > 180 || summary.length < 20 || summary.length > 3000) {
    const err = new Error('Opportunity title or summary length is invalid');
    err.status = 400;
    throw err;
  }
  const requestedExpiry = data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const maxExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  if (!Number.isFinite(requestedExpiry.getTime()) || requestedExpiry <= new Date() || requestedExpiry > maxExpiry) {
    const err = new Error('Expiry must be within the next 90 days');
    err.status = 400;
    throw err;
  }
  const created = await Opportunity.create({
    ownerUserId,
    type: data.type,
    title,
    summary,
    criteria: data.criteria && typeof data.criteria === 'object' ? data.criteria : {},
    expiresAt: requestedExpiry,
  });
  return serialize(await Opportunity.findByPk(created.id, { include: ownerInclude }));
}

async function updateOpportunity(ownerUserId, id, data) {
  const item = await Opportunity.findByPk(id);
  if (!item || item.ownerUserId !== ownerUserId) {
    const err = new Error('Opportunity not found');
    err.status = 404;
    throw err;
  }
  if (data.action === 'close') item.status = 'closed';
  else {
    const title = data.title === undefined ? item.title : String(data.title).trim();
    const summary = data.summary === undefined ? item.summary : String(data.summary).trim();
    if (title.length < 5 || title.length > 180 || summary.length < 20 || summary.length > 3000) {
      const err = new Error('Opportunity title or summary length is invalid');
      err.status = 400;
      throw err;
    }
    item.title = title;
    item.summary = summary;
    if (data.criteria && typeof data.criteria === 'object' && !Array.isArray(data.criteria)) item.criteria = data.criteria;
  }
  await item.save();
  return serialize(await Opportunity.findByPk(id, { include: ownerIncludeAny }));
}

async function reportOpportunity(reporterUserId, id, data) {
  const item = await Opportunity.findByPk(id);
  if (!item || item.ownerUserId === reporterUserId) {
    const err = new Error('Opportunity not found');
    err.status = 404;
    throw err;
  }
  const reason = String(data.reason || '').trim();
  const details = String(data.details || '').trim();
  if (!reason || reason.length > 255 || details.length > 3000) {
    const err = new Error('Report reason or details length is invalid');
    err.status = 400;
    throw err;
  }
  const existing = await Report.findOne({ where: { reporterUserId, opportunityId: id, status: 'open' } });
  if (existing) {
    const err = new Error('You already reported this opportunity');
    err.status = 409;
    throw err;
  }
  return Report.create({
    reporterUserId,
    targetUserId: item.ownerUserId,
    opportunityId: id,
    reason,
    details: details || null,
  });
}

module.exports = { listOpportunities, createOpportunity, updateOpportunity, reportOpportunity };
