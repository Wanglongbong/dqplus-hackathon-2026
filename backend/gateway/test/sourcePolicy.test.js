const test = require('node:test');
const assert = require('node:assert/strict');
const { assertSafeSource, isPrivateIp } = require('../src/services/sourceRefresh.service');

test('source refresh blocks private networks', () => {
  assert.equal(isPrivateIp('127.0.0.1'), true);
  assert.equal(isPrivateIp('10.1.2.3'), true);
  assert.equal(isPrivateIp('192.168.1.8'), true);
  assert.equal(isPrivateIp('8.8.8.8'), false);
});

test('source refresh refuses social scraping and non-HTTPS sources', async () => {
  await assert.rejects(() => assertSafeSource('https://www.linkedin.com/company/private', 'official_website'), /Social scraping/);
  await assert.rejects(() => assertSafeSource('http://example.com', 'official_website'), /HTTPS/);
  await assert.rejects(() => assertSafeSource('https://example.com', 'social'), /Source type/);
});
