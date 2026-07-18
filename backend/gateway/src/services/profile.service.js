const { sequelize, Profile, User } = require('../models');
const { evaluateVerification, normalizeLinkedInUrl, normalizePublicUrl } = require('./verification.service');

const WRITABLE_FIELDS = new Set([
  'company_name', 'country', 'stage', 'num_of_employees', 'industry', 'target_region', 'arr',
  'where_you_operate', 'website', 'description_product', 'email', 'phone_number',
  'annual_investment_count', 'avg_holding_period', 'year_founded', 'funding_ask_usd',
  'check_size_min_usd', 'check_size_max_usd', 'traction_summary', 'investment_thesis',
  'portfolio_highlights', 'linkedin_url', 'profile_status', 'visibility', 'consent_version',
]);

function cleanData(data) {
  const clean = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (WRITABLE_FIELDS.has(key)) clean[key] = value;
  }
  if (clean.company_name !== undefined) clean.company_name = String(clean.company_name).trim();
  if (clean.email !== undefined && clean.email !== null) clean.email = String(clean.email).trim().toLowerCase();
  clean.website = Array.isArray(clean.website)
    ? clean.website.map((value) => normalizePublicUrl(String(value).trim())).filter(Boolean).slice(0, 5)
    : [];
  if (clean.linkedin_url) clean.linkedin_url = normalizeLinkedInUrl(clean.linkedin_url) || null;
  if (clean.profile_status && !['draft', 'ready'].includes(clean.profile_status)) clean.profile_status = 'draft';
  if (clean.visibility && !['community', 'private'].includes(clean.visibility)) clean.visibility = 'community';
  if (Object.prototype.hasOwnProperty.call(data || {}, 'consent_version')) {
    clean.consented_at = clean.consent_version ? new Date() : null;
  }
  clean.extraction_status = 'pending';
  return clean;
}

function ownProfileJson(profile) {
  return profile.toJSON ? profile.toJSON() : profile;
}

function validateReady(data, role) {
  if (data.profile_status !== 'ready') return;
  const common = [data.company_name, data.website, data.stage, data.industry, data.where_you_operate, data.email, data.description_product || data.investment_thesis, data.consent_version];
  const roleFields = role === 'investor'
    ? [data.check_size_min_usd, data.check_size_max_usd, data.investment_thesis]
    : [data.funding_ask_usd, data.traction_summary];
  if ([...common, ...roleFields].some((value) => value === null || value === undefined || String(value).trim() === '')) {
    const err = new Error('Complete the required profile fields and consent before marking Ready');
    err.status = 400;
    throw err;
  }
  if (role === 'investor' && Number(data.check_size_max_usd) < Number(data.check_size_min_usd)) {
    const err = new Error('Maximum ticket must be greater than or equal to minimum ticket');
    err.status = 400;
    throw err;
  }
}

function publicProfileJson(profile) {
  const p = ownProfileJson(profile);
  return {
    id: p.id,
    company_name: p.company_name,
    country: p.country,
    stage: p.stage,
    industry: p.industry,
    where_you_operate: p.where_you_operate,
    website: p.website,
    description_product: p.description_product,
    funding_ask_usd: p.funding_ask_usd,
    check_size_min_usd: p.check_size_min_usd,
    check_size_max_usd: p.check_size_max_usd,
    traction_summary: p.traction_summary,
    investment_thesis: p.investment_thesis,
    portfolio_highlights: p.portfolio_highlights,
    verification_status: p.verification_status,
    verified_at: p.verified_at,
    profile_status: p.profile_status,
    updatedAt: p.updatedAt,
  };
}

async function createProfile(userId, data) {
  return sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    if (user.profileId) {
      const err = new Error('User already has a profile');
      err.status = 409;
      throw err;
    }
    const clean = cleanData(data);
    Object.assign(clean, evaluateVerification({ email: clean.email, websites: clean.website }));
    validateReady(clean, user.role);
    const profile = await Profile.create(clean, { transaction });
    user.profileId = profile.id;
    await user.save({ transaction });
    return profile;
  });
}

async function updateProfile(userId, profileId, data) {
  const user = await User.findByPk(userId);
  if (!user || user.profileId !== profileId) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  const profile = await Profile.findByPk(profileId);
  if (!profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }
  const previous = profile.toJSON();
  const clean = cleanData({ ...previous, ...data });
  const identityChanged = clean.company_name !== previous.company_name
    || clean.email !== previous.email
    || JSON.stringify(clean.website) !== JSON.stringify(previous.website || []);
  Object.assign(clean, identityChanged
    ? evaluateVerification({ email: clean.email, websites: clean.website })
    : {
        verification_status: previous.verification_status,
        verification_method: previous.verification_method,
        verified_at: previous.verified_at,
      });
  validateReady(clean, user.role);
  await profile.update(clean);
  return profile;
}

async function getOwnProfile(userId) {
  const user = await User.findByPk(userId, { include: [{ model: Profile, as: 'profile' }] });
  if (!user || !user.profile) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }
  return user.profile;
}

async function getProfileForOwner(userId, profileId) {
  const user = await User.findByPk(userId);
  if (!user || user.profileId !== profileId) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return getOwnProfile(userId);
}

module.exports = {
  createProfile, updateProfile, getOwnProfile, getProfileForOwner, ownProfileJson, publicProfileJson,
};
