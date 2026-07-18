const test = require('node:test');
const assert = require('node:assert/strict');
const { publicProfileJson } = require('../src/services/profile.service');

test('public profiles never expose direct contact fields', () => {
  const result = publicProfileJson({
    id: 'profile-1',
    company_name: 'Acme',
    website: ['https://acme.example'],
    email: 'founder@acme.example',
    phone_number: '+84 123 456 789',
    linkedin_url: 'https://linkedin.com/in/private-contact',
    verification_status: 'verified',
  });

  assert.equal(result.company_name, 'Acme');
  assert.equal(result.email, undefined);
  assert.equal(result.phone_number, undefined);
  assert.equal(result.linkedin_url, undefined);
});
