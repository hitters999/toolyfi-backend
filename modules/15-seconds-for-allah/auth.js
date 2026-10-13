const { getAuth } = require('./firebase');

async function requireUser(req, res, next) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ error: 'Authorization bearer token required' });
  }

  try {
    req.user = await getAuth().verifyIdToken(match[1], true);
    return next();
  } catch (error) {
    console.error('Allah15 auth verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}

module.exports = { requireUser };
