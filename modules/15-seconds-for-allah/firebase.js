const admin = require('firebase-admin');

let app;

function getFirebaseApp() {
  if (app) return app;

  const projectId = process.env.ALLAH15_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.ALLAH15_FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.ALLAH15_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('15 Seconds for ALLAH Firebase credentials are not configured');
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  }, 'allah15');

  return app;
}

function getAuth() {
  return getFirebaseApp() && admin.auth(getFirebaseApp());
}

function getDb() {
  return getFirebaseApp() && admin.firestore(getFirebaseApp());
}

module.exports = { getAuth, getDb };
