const pool = require('../config/db');

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const n = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function loadUserProfile(userId) {
  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.role, p.*
     FROM users u
     JOIN profiles p ON p.id = u.profile_id
     WHERE u.id = $1`,
    [userId]
  );
  return rows[0] || null;
}

function toList(value) {
  return value
    ? String(value).toLowerCase().split(',').map((s) => s.trim()).filter(Boolean)
    : [];
}

function normStage(value) {
  return value ? String(value).toLowerCase().replace(/_/g, '-') : null;
}

function mapProfileToAttributes(row) {
  const regions = toList(row.target_region || row.where_you_operate);
  const evidence = (Array.isArray(row.website) ? row.website : [])
    .filter(Boolean)
    .map((url) => ({ label: String(url).replace(/^https?:\/\//, '').replace(/\/$/, ''), url }));

  if (row.role === 'investor') {
    return {
      firm_name: row.company_name || null,
      investor_type: null,
      thesis: row.investment_thesis || row.description_product || null,
      sectors: toList(row.industry),
      stages: normStage(row.stage) ? [normStage(row.stage)] : [],
      geographies: regions,
      check_size_min_usd: parseNumber(row.check_size_min_usd),
      check_size_max_usd: parseNumber(row.check_size_max_usd),
      portfolio_highlights: toList(row.portfolio_highlights),
      constraints: null,
      verification_status: row.verification_status || 'unverified',
      profile_status: row.profile_status || 'draft',
      visibility: row.visibility || 'community',
      evidence,
    };
  }

  return {
    company_name: row.company_name || null,
    industry: toList(row.industry),
    stage: normStage(row.stage),
    country: row.country || null,
    target_regions: regions,
    team_size: row.num_of_employees ?? null,
    arr_usd: row.arr !== null && row.arr !== undefined ? Number(row.arr) : null,
    funding_ask_usd: parseNumber(row.funding_ask_usd || row.checks),
    business_model: null,
    product_description: row.description_product || null,
    traction_summary: row.traction_summary || null,
    verification_status: row.verification_status || 'unverified',
    profile_status: row.profile_status || 'draft',
    visibility: row.visibility || 'community',
    evidence,
  };
}

module.exports = { loadUserProfile, mapProfileToAttributes };
