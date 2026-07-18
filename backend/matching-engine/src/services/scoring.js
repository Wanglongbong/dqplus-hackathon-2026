function normalized(values = []) {
  return [...new Set(values.map((value) => String(value).trim().toLowerCase()).filter(Boolean))];
}

function intersect(a = [], b = []) {
  const setB = new Set(normalized(b));
  return normalized(a).filter((value) => setB.has(value));
}

function founderCoverage(founderSectors = [], investorSectors = []) {
  const founder = normalized(founderSectors);
  if (!founder.length || !investorSectors.length) return 0;
  return intersect(founder, investorSectors).length / founder.length;
}

function scoreAttributes(founderAttrs = {}, investorAttrs = {}) {
  const reasons = [];
  const missingSignals = [];
  let score = 0;
  let availableWeight = 0;

  if (founderAttrs.industry?.length && investorAttrs.sectors?.length) {
    availableWeight += 0.4;
    const overlap = intersect(founderAttrs.industry, investorAttrs.sectors);
    const sectorFit = founderCoverage(founderAttrs.industry, investorAttrs.sectors);
    score += 0.4 * sectorFit;
    if (overlap.length) reasons.push(`sector fit: ${overlap.join(', ')}`);
  } else missingSignals.push('sector data');

  if (founderAttrs.stage && investorAttrs.stages?.length) {
    availableWeight += 0.3;
    if (normalized(investorAttrs.stages).includes(String(founderAttrs.stage).toLowerCase())) {
      score += 0.3;
      reasons.push(`stage match: ${founderAttrs.stage}`);
    }
  } else missingSignals.push('stage preference');

  const geos = normalized(investorAttrs.geographies);
  const regions = normalized(founderAttrs.target_regions);
  if (geos.length && regions.length) {
    availableWeight += 0.2;
    const geoOverlap = intersect(regions, geos);
    if (geos.includes('global') || geoOverlap.length) {
      score += 0.2;
      reasons.push(geos.includes('global') ? 'investor invests globally' : `geography match: ${geoOverlap.join(', ')}`);
    }
  } else missingSignals.push('geography preference');

  const ask = Number(founderAttrs.funding_ask_usd);
  const min = Number(investorAttrs.check_size_min_usd);
  const max = Number(investorAttrs.check_size_max_usd);
  const hasAsk = Number.isFinite(ask) && ask > 0;
  const hasMin = Number.isFinite(min) && min > 0;
  const hasMax = Number.isFinite(max) && max > 0;
  if (hasAsk && (hasMin || hasMax)) {
    availableWeight += 0.1;
    if ((!hasMin || ask >= min) && (!hasMax || ask <= max)) {
      score += 0.1;
      reasons.push('ticket size fits the funding ask');
    }
  } else missingSignals.push('funding ask or ticket range');

  return {
    attributeScore: Number(Math.max(0, Math.min(score, 1)).toFixed(4)),
    confidence: Number(availableWeight.toFixed(2)),
    reasons,
    missingSignals,
  };
}

function scoreMatch(requesterRole, requesterAttrs, candidateAttrs) {
  return requesterRole === 'founder'
    ? scoreAttributes(requesterAttrs, candidateAttrs)
    : scoreAttributes(candidateAttrs, requesterAttrs);
}

module.exports = { scoreMatch, scoreAttributes, founderCoverage, intersect };
