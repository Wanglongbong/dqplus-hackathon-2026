const test = require('node:test');
const assert = require('node:assert/strict');
const { canCheckInStatus, validateSessionInput } = require('../src/services/coffeeSession.service');

const now = new Date('2026-07-19T00:00:00.000Z');
const deals = ['1', '2', '3', '4', '5'];
const slots = [3, 5, 7].map((day) => ({ startsAt: `2026-07-${19 + day}T02:30:00.000Z`, durationMinutes: 90 }));

test('Coffee & Chat requires exactly five unique startups', () => {
  assert.throws(() => validateSessionInput({ dealIds: deals.slice(0, 4), slots }, now), /exactly 5/);
  assert.throws(() => validateSessionInput({ dealIds: ['1', '2', '3', '4', '4'], slots }, now), /unique/);
});

test('Coffee & Chat requires three unique 90-minute slots 2–21 days ahead', () => {
  const value = validateSessionInput({ dealIds: deals, slots }, now);
  assert.equal(value.slots.length, 3);
  assert.ok(value.slots.every((slot) => slot.durationMinutes === 90));
  assert.throws(() => validateSessionInput({ dealIds: deals, slots: slots.map((slot, index) => ({ ...slot, durationMinutes: index ? 90 : 60 })) }, now), /90 minutes/);
});

test('host check-in stays locked until payment', () => {
  assert.equal(canCheckInStatus('threshold_met'), false);
  assert.equal(canCheckInStatus('awaiting_payment'), false);
  assert.equal(canCheckInStatus('paid'), true);
  assert.equal(canCheckInStatus('confirmed'), true);
});
