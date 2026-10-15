const SESSION_SECONDS = 15;
const SESSION_LIFETIME_MS = 10 * 60 * 1000;

function validateRewardClaim({ session, uid, sessionId, activeSessionId, nowMs }) {
  if (!session) return { ok: false, code: 'NOT_FOUND', message: 'Reward session not found' };
  if (session.uid !== uid) return { ok: false, code: 'FORBIDDEN', message: 'Reward session does not belong to this user' };
  if (session.claimed) return { ok: false, code: 'CONFLICT', message: 'Reward session already claimed' };
  if (activeSessionId !== sessionId) return { ok: false, code: 'CONFLICT', message: 'Reward session is no longer active' };

  const startedAtMs = Number(session.startedAtMs);
  const expiresAtMs = Number(session.expiresAtMs);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(expiresAtMs) || !Number.isFinite(nowMs) || nowMs < startedAtMs) {
    return { ok: false, code: 'INVALID_SESSION', message: 'Reward session timing is invalid' };
  }
  if (nowMs > expiresAtMs) return { ok: false, code: 'EXPIRED', message: 'Reward session expired' };

  const elapsedMs = nowMs - startedAtMs;
  if (elapsedMs < SESSION_SECONDS * 1000) {
    return { ok: false, code: 'TOO_EARLY', message: 'Complete the full 15-second session first' };
  }

  return { ok: true, elapsedMs };
}

function isLiveUnclaimedSession(session, nowMs) {
  if (!session || session.claimed) return false;
  const expiresAtMs = Number(session.expiresAtMs);
  return Number.isFinite(expiresAtMs) && Number.isFinite(nowMs) && nowMs <= expiresAtMs;
}

module.exports = { SESSION_SECONDS, SESSION_LIFETIME_MS, validateRewardClaim, isLiveUnclaimedSession };
