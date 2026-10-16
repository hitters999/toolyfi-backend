const express = require('express');
const crypto = require('crypto');
const { getDb } = require('./firebase');
const { requireUser } = require('./auth');
const {
  SESSION_SECONDS,
  SESSION_LIFETIME_MS,
  validateRewardClaim,
  isLiveUnclaimedSession
} = require('./reward-policy');

const router = express.Router();
const POINTS_PER_SESSION = 10;

function userRef(db, uid) {
  return db.collection('allah15_users').doc(uid);
}

router.get('/health', (_req, res) => {
  res.json({ service: '15-seconds-for-allah', status: 'ready', auth: 'firebase-id-token', points: 'server-authoritative' });
});

router.use(requireUser);

router.get('/me', async (req, res) => {
  try {
    const db = getDb();
    const ref = userRef(db, req.user.uid);
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : {};
    return res.json({
      uid: req.user.uid,
      email: req.user.email || null,
      displayName: req.user.name || data.displayName || null,
      points: Number(data.points || 0),
      completedSessions: Number(data.completedSessions || 0)
    });
  } catch (error) {
    console.error('Allah15 /me failed:', error);
    return res.status(503).json({ error: 'Account service is not configured or unavailable' });
  }
});

router.post('/reward/start', async (req, res) => {
  try {
    const db = getDb();
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const accountRef = userRef(db, req.user.uid);
    const sessionCollection = db.collection('allah15_reward_sessions');
    const sessionRef = sessionCollection.doc(sessionId);

    await db.runTransaction(async transaction => {
      const accountSnap = await transaction.get(accountRef);
      const account = accountSnap.exists ? accountSnap.data() : {};
      const activeSessionId = account.activeRewardSessionId;
      if (typeof activeSessionId === 'string' && activeSessionId) {
        const activeRef = sessionCollection.doc(activeSessionId);
        const activeSnap = await transaction.get(activeRef);
        if (activeSnap.exists && activeSnap.data().uid === req.user.uid && isLiveUnclaimedSession(activeSnap.data(), now)) {
          throw Object.assign(new Error('Finish or let your current reward session expire before starting another'), { code: 'ACTIVE_SESSION' });
        }
      }

      transaction.set(sessionRef, {
        uid: req.user.uid,
        startedAtMs: now,
        expiresAtMs: now + SESSION_LIFETIME_MS,
        claimed: false,
        createdAt: new Date(now)
      });
      transaction.set(accountRef, {
        uid: req.user.uid,
        activeRewardSessionId: sessionId
      }, { merge: true });
    });
    return res.status(201).json({ sessionId, requiredSeconds: SESSION_SECONDS, expiresAt: new Date(now + SESSION_LIFETIME_MS).toISOString() });
  } catch (error) {
    if (error.code === 'ACTIVE_SESSION') return res.status(409).json({ error: error.message });
    console.error('Allah15 reward start failed:', error);
    return res.status(503).json({ error: 'Reward service is not configured or unavailable' });
  }
});

router.post('/reward/complete', async (req, res) => {
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return res.status(400).json({ error: 'A valid reward sessionId is required' });
  }

  try {
    const db = getDb();
    const sessionRef = db.collection('allah15_reward_sessions').doc(String(sessionId));
    const accountRef = userRef(db, req.user.uid);
    const eventRef = db.collection('allah15_point_events').doc();
    const now = Date.now();

    const result = await db.runTransaction(async transaction => {
      const sessionSnap = await transaction.get(sessionRef);
      const accountSnap = await transaction.get(accountRef);
      const session = sessionSnap.exists ? sessionSnap.data() : null;
      const account = accountSnap.exists ? accountSnap.data() : {};
      const claim = validateRewardClaim({
        session,
        uid: req.user.uid,
        sessionId,
        activeSessionId: account.activeRewardSessionId,
        nowMs: now
      });
      if (!claim.ok) throw Object.assign(new Error(claim.message), { code: claim.code });

      const currentPoints = Number(account.points || 0);
      const currentSessions = Number(account.completedSessions || 0);
      const nextPoints = currentPoints + POINTS_PER_SESSION;

      transaction.set(accountRef, {
        uid: req.user.uid,
        email: req.user.email || account.email || null,
        displayName: req.user.name || account.displayName || null,
        points: nextPoints,
        completedSessions: currentSessions + 1,
        activeRewardSessionId: null,
        updatedAt: new Date(now)
      }, { merge: true });
      transaction.update(sessionRef, {
        claimed: true,
        claimedAt: new Date(now),
        elapsedSeconds: Math.floor(claim.elapsedMs / 1000)
      });
      transaction.set(eventRef, {
        uid: req.user.uid,
        type: '15_second_session',
        points: POINTS_PER_SESSION,
        sessionId: String(sessionId),
        createdAt: new Date(now)
      });

      return {
        pointsAwarded: POINTS_PER_SESSION,
        totalPoints: nextPoints,
        completedSessions: currentSessions + 1
      };
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    const status = { NOT_FOUND: 404, FORBIDDEN: 403, CONFLICT: 409, EXPIRED: 410, TOO_EARLY: 422 }[error.code] || 503;
    if (status === 503) console.error('Allah15 reward completion failed:', error);
    return res.status(status).json({ error: status === 503 ? 'Reward service is not configured or unavailable' : error.message });
  }
});

router.get('/points/history', async (req, res) => {
  try {
    const db = getDb();
    const snap = await db.collection('allah15_point_events').where('uid', '==', req.user.uid).orderBy('createdAt', 'desc').limit(100).get();
    return res.json({ events: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
  } catch (error) {
    console.error('Allah15 history failed:', error);
    return res.status(503).json({ error: 'Point history unavailable' });
  }
});

module.exports = router;
