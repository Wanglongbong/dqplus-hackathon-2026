const test = require('node:test');
const assert = require('node:assert/strict');
const { founderCoverage, scoreAttributes } = require('../src/services/scoring');

test('sector coverage does not penalize a broad investor thesis', () => {
  assert.equal(founderCoverage(['agritech'], ['agritech', 'climate', 'saas', 'fintech']), 1);
});

test('scores complete founder and investor fit with transparent confidence', () => {
  const result = scoreAttributes(
    { industry: ['agritech'], stage: 'seed', target_regions: ['vietnam'], funding_ask_usd: 500000 },
    { sectors: ['agritech', 'climate'], stages: ['seed'], geographies: ['sea', 'vietnam'], check_size_min_usd: 250000, check_size_max_usd: 1000000 },
  );
  assert.equal(result.attributeScore, 1);
  assert.equal(result.confidence, 1);
  assert.equal(result.missingSignals.length, 0);
  assert.ok(result.reasons.some((reason) => reason.includes('ticket size')));
});

test('missing data lowers confidence without inventing a positive signal', () => {
  const result = scoreAttributes({ industry: ['ai'] }, { sectors: ['fintech'] });
  assert.equal(result.attributeScore, 0);
  assert.equal(result.confidence, 0.4);
  assert.deepEqual(result.missingSignals, ['stage preference', 'geography preference', 'funding ask or ticket range']);
});
