const pool = require('../config/db');
const { scoreMatch } = require('./scoring');

const requestedVectorWeight = Math.max(0, Number(process.env.MATCH_VECTOR_WEIGHT ?? 0.7) || 0);
const requestedAttrWeight = Math.max(0, Number(process.env.MATCH_ATTR_WEIGHT ?? 0.3) || 0);
const weightTotal = requestedVectorWeight + requestedAttrWeight;
const VECTOR_WEIGHT = weightTotal > 0 ? requestedVectorWeight / weightTotal : 0.7;
const ATTR_WEIGHT = weightTotal > 0 ? requestedAttrWeight / weightTotal : 0.3;
const CANDIDATE_POOL = Math.min(Math.max(Number.parseInt(process.env.MATCH_CANDIDATE_POOL || '50', 10) || 50, 5), 200);

function clamp(value) {
  return Math.max(0, Math.min(Number(value) || 0, 1));
}

async function findMatches({ userId, targetRole, limit, filters = {} }) {
  const { rows: meRows } = await pool.query(
    'SELECT role, attributes FROM extracted_profiles WHERE user_id = $1',
    [userId]
  );
  if (!meRows.length) {
    const err = new Error('No extracted profile for user; run extraction first');
    err.status = 404;
    throw err;
  }
  const me = meRows[0];

  const conditions = [
    'ep.role = $2',
    'ep.user_id <> $1',
    "p.profile_status = 'ready'",
    "p.verification_status = 'verified'",
    "p.visibility = 'community'",
  ];
  const params = [userId, targetRole];

  const sectorKey = targetRole === 'investor' ? 'sectors' : 'industry';
  const stageKey = targetRole === 'investor' ? 'stages' : 'stage';
  const regionKey = targetRole === 'investor' ? 'geographies' : 'target_regions';

  if (filters.sector) {
    params.push(filters.sector.toLowerCase());
    conditions.push(`ep.attributes->'${sectorKey}' ? $${params.length}`);
  }
  if (filters.stage) {
    params.push(filters.stage.toLowerCase());
    conditions.push(
      targetRole === 'investor'
        ? `ep.attributes->'${stageKey}' ? $${params.length}`
        : `ep.attributes->>'${stageKey}' = $${params.length}`
    );
  }
  if (filters.region) {
    params.push(filters.region.toLowerCase());
    conditions.push(`ep.attributes->'${regionKey}' ? $${params.length}`);
  }
  params.push(CANDIDATE_POOL);
  const candidatePoolParam = `$${params.length}`;

  const { rows: candidates } = await pool.query(
    `WITH me AS (
       SELECT embedding FROM extracted_profiles WHERE user_id = $1
     )
     SELECT ep.user_id,
            ep.attributes || jsonb_build_object(
              'profile_status', p.profile_status,
              'verification_status', p.verification_status,
              'visibility', p.visibility
            ) AS attributes,
            1 - (ep.embedding <=> me.embedding) AS vector_score
     FROM extracted_profiles ep
     JOIN users u ON u.id = ep.user_id
     JOIN profiles p ON p.id = u.profile_id
     CROSS JOIN me
     WHERE ${conditions.join(' AND ')}
     ORDER BY ep.embedding <=> me.embedding
     LIMIT ${candidatePoolParam}`,
    params
  );

  const matches = candidates
    .map((c) => {
      const vectorScore = clamp(c.vector_score);
      const { attributeScore, confidence, reasons, missingSignals } = scoreMatch(me.role, me.attributes, c.attributes);
      const score = clamp(VECTOR_WEIGHT * vectorScore + ATTR_WEIGHT * attributeScore);
      return {
        userId: c.user_id,
        score: Number(score.toFixed(4)),
        vectorScore: Number(vectorScore.toFixed(4)),
        attributeScore: Number(attributeScore.toFixed(4)),
        confidence,
        attributes: c.attributes,
        reasons,
        missingSignals,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { userId, role: me.role, matches };
}

module.exports = { findMatches };
