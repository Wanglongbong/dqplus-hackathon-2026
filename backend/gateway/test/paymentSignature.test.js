const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalize, signPayOS, verifyPayOSSignature } = require('../src/services/payment.service');

test('PayOS canonicalization is stable and signatures reject tampering', () => {
  const data = { returnUrl: 'https://example.com/return', amount: 1490000, orderCode: 12345 };
  assert.equal(canonicalize(data), 'amount=1490000&orderCode=12345&returnUrl=https://example.com/return');
  const signature = signPayOS(data, 'test-checksum-key');
  assert.equal(verifyPayOSSignature(data, signature, 'test-checksum-key'), true);
  assert.equal(verifyPayOSSignature({ ...data, amount: 1 }, signature, 'test-checksum-key'), false);
});
