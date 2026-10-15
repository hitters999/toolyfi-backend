const test = require('node:test');
const assert = require('node:assert/strict');
const { SESSION_SECONDS, validateRewardClaim, isLiveUnclaimedSession } = require('./reward-policy');

const startedAtMs = 1_000_000;
const sessionId = 'e3d4b844-43b4-4e7c-9bf9-12a7d9f815a0';
const baseSession = {
  uid: 'firebase-user-1',
  startedAtMs,
  expiresAtMs: startedAtMs + 10 * 60 * 1000,
  claimed: false
};

function validate(overrides = {}) {
  return validateRewardClaim({
    session: baseSession,
    uid: 'firebase-user-1',
    sessionId,
    activeSessionId: sessionId,
    nowMs: startedAtMs + SESSION_SECONDS * 1000,
    ...overrides
  });
}

test('accepts exactly 15 seconds measured by the server', () => {
  assert.deepEqual(validate(), { ok: true, elapsedMs: 15_000 });
});

test('rejects a claim before the server-measured 15-second minimum', () => {
  assert.equal(validate({ nowMs: startedAtMs + 14_999 }).code, 'TOO_EARLY');
});

test('does not use a client-supplied elapsedSeconds value', () => {
  assert.equal(validate({ nowMs: startedAtMs + 1_000, elapsedSeconds: 999 }).code, 'TOO_EARLY');
});

test('rejects expired or malformed session timing', () => {
  assert.equal(validate({ nowMs: startedAtMs + 10 * 60 * 1000 + 1 }).code, 'EXPIRED');
  assert.equal(validate({ session: { ...baseSession, startedAtMs: 'bad' } }).code, 'INVALID_SESSION');
});

test('rejects sessions belonging to another user, stale sessions, and repeats', () => {
  assert.equal(validate({ uid: 'another-user' }).code, 'FORBIDDEN');
  assert.equal(validate({ activeSessionId: 'another-session' }).code, 'CONFLICT');
  assert.equal(validate({ session: { ...baseSession, claimed: true } }).code, 'CONFLICT');
});

test('only one unclaimed session remains active until expiry', () => {
  assert.equal(isLiveUnclaimedSession(baseSession, startedAtMs + 1), true);
  assert.equal(isLiveUnclaimedSession({ ...baseSession, claimed: true }, startedAtMs + 1), false);
  assert.equal(isLiveUnclaimedSession(baseSession, baseSession.expiresAtMs + 1), false);
});
