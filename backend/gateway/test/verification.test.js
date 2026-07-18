const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateVerification, normalizeLinkedInUrl, normalizePublicUrl, websiteDomain } = require('../src/services/verification.service');

test('prioritizes a matching work-email domain for manual verification', () => {
  const result = evaluateVerification({ email: 'founder@enfarm.vn', websites: ['https://www.enfarm.vn/about'] });
  assert.equal(result.verification_status, 'pending');
  assert.equal(result.verification_method, 'domain_match_pending');
  assert.equal(result.verified_at, null);
});

test('personal email requires manual review even with a website', () => {
  const result = evaluateVerification({ email: 'founder@gmail.com', websites: ['https://startup.vn'] });
  assert.equal(result.verification_status, 'pending');
  assert.equal(result.verified_at, null);
});

test('normalizes website domains safely', () => {
  assert.equal(websiteDomain('www.example.com/path'), 'example.com');
  assert.equal(websiteDomain('not a url'), '');
});

test('only accepts public http and https URLs', () => {
  assert.equal(normalizePublicUrl('example.com'), 'https://example.com/');
  assert.equal(normalizePublicUrl('javascript:alert(1)'), '');
  assert.equal(normalizePublicUrl('http://127.0.0.1/admin'), '');
  assert.equal(normalizePublicUrl('http://localhost:3000'), '');
});

test('LinkedIn contact fields only accept LinkedIn hosts', () => {
  assert.equal(normalizeLinkedInUrl('linkedin.com/in/founder'), 'https://linkedin.com/in/founder');
  assert.equal(normalizeLinkedInUrl('https://phishing.example/linkedin'), '');
});
