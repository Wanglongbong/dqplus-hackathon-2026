const crypto = require('node:crypto');
const dns = require('node:dns/promises');
const net = require('node:net');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

const ALLOWED_SOURCE_TYPES = new Set(['founder_submission', 'official_website', 'accelerator', 'portfolio', 'official_press', 'rss']);

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const normalized = address.toLowerCase();
  return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
}

async function assertSafeSource(url, sourceType) {
  if (!ALLOWED_SOURCE_TYPES.has(sourceType)) throw new Error('Source type is not allowed');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('Only HTTPS sources are allowed');
  if (/(^|\.)linkedin\.com$/i.test(parsed.hostname)) throw new Error('Social scraping is not allowed');
  const addresses = await dns.lookup(parsed.hostname, { all: true });
  if (!addresses.length || addresses.some((item) => isPrivateIp(item.address))) throw new Error('Private or unresolved source host');
  return parsed;
}

async function fetchSource(source) {
  await assertSafeSource(source.url, source.source_type);
  const response = await fetch(source.url, {
    redirect: 'error',
    headers: { 'user-agent': 'VietNexusSourceRefresh/1.0 (+official-public-sources-only)' },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 2_000_000) throw new Error('Source is larger than 2 MB');
  const text = (await response.text()).slice(0, 2_000_000);
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function refreshDueSources(limit = 50) {
  const sources = await sequelize.query(`
    SELECT id, deal_profile_id, url, source_type, content_hash
    FROM entity_sources WHERE next_refresh_at <= now()
    ORDER BY next_refresh_at ASC LIMIT :limit
  `, { replacements: { limit: Math.min(Math.max(Number(limit) || 50, 1), 200) }, type: QueryTypes.SELECT });
  const summary = { checked: 0, changed: 0, unchanged: 0, failed: 0 };
  for (const source of sources) {
    try {
      const hash = await fetchSource(source);
      const changed = hash !== source.content_hash;
      await sequelize.query(`
        UPDATE entity_sources SET content_hash = :hash, last_checked_at = now(),
          next_refresh_at = now() + interval '7 days', last_status = :status,
          error_message = NULL, updated_at = now() WHERE id = :id
      `, { replacements: { id: source.id, hash, status: changed ? 'fresh' : 'unchanged' } });
      await sequelize.query(`
        UPDATE deal_profiles SET source_checked_at = now(), is_stale = false,
          evidence_count = GREATEST(evidence_count, 1), updated_at = now()
        WHERE id = :dealProfileId
      `, { replacements: { dealProfileId: source.deal_profile_id } });
      if (changed) await sequelize.query(`
        INSERT INTO pulse_events (event_type, public_text, public_meta, deal_profile_id)
        SELECT 'evidence', alias || ' có nguồn dữ liệu chính thức được cập nhật',
          evidence_count || ' tín hiệu đã đối chiếu', id FROM deal_profiles WHERE id = :dealProfileId
      `, { replacements: { dealProfileId: source.deal_profile_id } });
      summary[changed ? 'changed' : 'unchanged'] += 1;
    } catch (error) {
      await sequelize.query(`
        UPDATE entity_sources SET last_checked_at = now(), next_refresh_at = now() + interval '24 hours',
          last_status = 'failed', error_message = :message, updated_at = now() WHERE id = :id
      `, { replacements: { id: source.id, message: String(error.message).slice(0, 500) } });
      summary.failed += 1;
    }
    summary.checked += 1;
  }
  await sequelize.query("UPDATE deal_profiles SET is_stale = true, updated_at = now() WHERE source_checked_at < now() - interval '30 days' AND is_stale = false");
  return summary;
}

module.exports = { ALLOWED_SOURCE_TYPES, isPrivateIp, assertSafeSource, fetchSource, refreshDueSources };
