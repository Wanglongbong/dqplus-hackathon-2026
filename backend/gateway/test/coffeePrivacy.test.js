const test = require('node:test');
const assert = require('node:assert/strict');
const { publicDealJson } = require('../src/services/publicDeal.service');

test('blind deal projection never exposes identity, owner or contact fields', () => {
  const result = publicDealJson({
    id: 'deal-1', alias: 'ClimateTech HN-024', sector: 'ClimateTech', stage: 'seed', location: 'Hà Nội',
    company_name: 'Private Company Ltd', owner_user_id: 'user-1', email: 'founder@example.com',
    phone_number: '+84 123', website: 'https://private.example', product_summary: 'Safe public summary',
  });
  assert.equal(result.alias, 'ClimateTech HN-024');
  assert.equal(result.product_summary, 'Safe public summary');
  assert.equal(result.company_name, undefined);
  assert.equal(result.owner_user_id, undefined);
  assert.equal(result.email, undefined);
  assert.equal(result.phone_number, undefined);
  assert.equal(result.website, undefined);
});
