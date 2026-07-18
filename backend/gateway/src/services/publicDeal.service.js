const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

const PUBLIC_FIELDS = [
  'id', 'alias', 'sector', 'stage', 'location', 'funding_ask_usd', 'traction_summary',
  'product_summary', 'evidence_count', 'confidence', 'source_checked_at',
  'offline_meet_count', 'last_met_at', 'is_demo',
];

function publicDealJson(row) {
  const value = typeof row?.toJSON === 'function' ? row.toJSON() : (row || {});
  return PUBLIC_FIELDS.reduce((result, key) => {
    if (value[key] !== undefined) result[key] = value[key];
    return result;
  }, {});
}

async function listPublicDeals({ sector, stage, limit = 50 } = {}) {
  const where = ["status = 'published'", 'is_stale = false'];
  const replacements = { limit: Math.min(Math.max(Number(limit) || 50, 1), 100) };
  if (sector) { where.push('LOWER(sector) = LOWER(:sector)'); replacements.sector = sector; }
  if (stage) { where.push('LOWER(stage) = LOWER(:stage)'); replacements.stage = stage; }
  const rows = await sequelize.query(`
    SELECT id, alias, sector, stage, location, funding_ask_usd, traction_summary,
      product_summary, evidence_count, confidence, source_checked_at,
      offline_meet_count, last_met_at, is_demo
    FROM deal_profiles
    WHERE ${where.join(' AND ')}
    ORDER BY confidence DESC, evidence_count DESC, created_at DESC
    LIMIT :limit
  `, { replacements, type: QueryTypes.SELECT });
  return rows.map(publicDealJson);
}

async function getPublicDeal(alias) {
  const rows = await sequelize.query(`
    SELECT id, alias, sector, stage, location, funding_ask_usd, traction_summary,
      product_summary, evidence_count, confidence, source_checked_at,
      offline_meet_count, last_met_at, is_demo
    FROM deal_profiles
    WHERE status = 'published' AND is_stale = false AND alias = :alias
    LIMIT 1
  `, { replacements: { alias }, type: QueryTypes.SELECT });
  return rows[0] ? publicDealJson(rows[0]) : null;
}

async function listPulse(limit = 12) {
  return sequelize.query(`
    SELECT id, event_type AS type, public_text AS text, public_meta AS meta,
      occurred_at AS time, is_demo
    FROM pulse_events
    WHERE is_public = true
    ORDER BY occurred_at DESC
    LIMIT :limit
  `, { replacements: { limit: Math.min(Math.max(Number(limit) || 12, 1), 30) }, type: QueryTypes.SELECT });
}

function createEdges(deals) {
  const edges = [];
  for (let index = 0; index < deals.length; index += 1) {
    for (let other = index + 1; other < deals.length; other += 1) {
      const a = deals[index]; const b = deals[other];
      const shared = [a.sector === b.sector ? 'sector' : null, a.stage === b.stage ? 'stage' : null, a.location === b.location ? 'location' : null].filter(Boolean);
      if (shared.length) edges.push({ source: a.id, target: b.id, reasons: shared });
      if (edges.length >= deals.length * 2) return edges;
    }
  }
  return edges;
}

module.exports = { publicDealJson, listPublicDeals, getPublicDeal, listPulse, createEdges };
