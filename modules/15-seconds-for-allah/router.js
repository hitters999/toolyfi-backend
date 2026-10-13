const express = require('express');
const crypto = require('crypto');
const { getDb } = require('./firebase');
const { requireUser } = require('./auth');

const router = express.Router();
const POINTS_PER_SESSION = 10;
const SESSION_SECONDS = 15;

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
      pkrBalance: Number(data.pkrBalance || 0),
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
    await db.collection('allah15_reward_sessions').doc(sessionId).set({
      uid: req.user.uid,
      startedAtMs: now,
      expiresAtMs: now + 10 * 60 * 1000,
      claimed: false,
      createdAt: new Date(now)
    });
    return res.status(201).json({ sessionId, requiredSeconds: SESSION_SECONDS, expiresAt: new Date(now + 10 * 60 * 1000).toISOString() });
  } catch (error) {
    console.error('Allah15 reward start failed:', error);
    return res.status(503).json({ error: 'Reward service is not configured or unavailable' });
  }
});

router.post('/reward/complete', async (req, res) => {
  const { sessionId, elapsedSeconds } = req.body || {};
  if (!sessionId || !Number.isFinite(Number(elapsedSeconds))) {
    return res.status(400).json({ error: 'sessionId and elapsedSeconds are required' });
  }

  try {
    const db = getDb();
    const sessionRef = db.collection('allah15_reward_sessions').doc(String(sessionId));
    const accountRef = userRef(db, req.user.uid);
    const eventRef = db.collection('allah15_point_events').doc();

    const result = await db.runTransaction(async transaction => {
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists) throw Object.assign(new Error('Reward session not found'), { code: 'NOT_FOUND' });

      const session = sessionSnap.data();
      if (session.uid !== req.user.uid) throw Object.assign(new Error('Reward session does not belong to this user'), { code: 'FORBIDDEN' });
      if (session.claimed) throw Object.assign(new Error('Reward session already claimed'), { code: 'CONFLICT' });
      if (Date.now() > Number(session.expiresAtMs)) throw Object.assign(new Error('Reward session expired'), { code: 'EXPIRED' });
      if (Number(elapsedSeconds) < SESSION_SECONDS) throw Object.assign(new Error('Complete the full 15-second session first'), { code: 'TOO_EARLY' });

      const accountSnap = await transaction.get(accountRef);
      const account = accountSnap.exists ? accountSnap.data() : {};
      const currentPoints = Number(account.points || 0);
      const currentSessions = Number(account.completedSessions || 0);
      const nextPoints = currentPoints + POINTS_PER_SESSION;

      transaction.set(accountRef, {
        uid: req.user.uid,
        email: req.user.email || account.email || null,
        displayName: req.user.name || account.displayName || null,
        points: nextPoints,
        pkrBalance: Number((nextPoints * 0.01).toFixed(2)),
        completedSessions: currentSessions + 1,
        updatedAt: new Date()
      }, { merge: true });
      transaction.update(sessionRef, { claimed: true, claimedAt: new Date(), elapsedSeconds: Number(elapsedSeconds) });
      transaction.set(eventRef, {
        uid: req.user.uid,
        type: '15_second_session',
        points: POINTS_PER_SESSION,
        sessionId: String(sessionId),
        createdAt: new Date()
      });

      return { pointsAwarded: POINTS_PER_SESSION, totalPoints: nextPoints, pkrBalance: Number((nextPoints * 0.01).toFixed(2)) };
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    const status = { NOT_FOUND: 404, FORBIDDEN: 403, CONFLICT: 409, EXPIRED: 410, TOO_EARLY: 422 }[error.code] || 503;
    return res.status(status).json({ error: error.message || 'Reward service unavailable' });
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
