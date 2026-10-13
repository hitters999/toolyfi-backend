# 15 Seconds for ALLAH backend module

This module is intentionally isolated from the existing Toolyfi utility APIs.

## Routes

Mounted by the main server at `/api/15-seconds-for-allah`:

- `GET /health`
- `GET /me` (Firebase ID token required)
- `POST /reward/start` (Firebase ID token required)
- `POST /reward/complete` (Firebase ID token required)
- `GET /points/history` (Firebase ID token required)

## Security model

- Google sign-in is handled by Firebase Authentication on Android and web.
- The client sends a Firebase ID token as `Authorization: Bearer <token>`.
- The server verifies the token and uses the Firebase UID as the account key.
- Points are awarded only inside a Firestore transaction.
- Client-supplied point totals are never trusted.
- Each reward session can be claimed once.

## Required server environment

```env
ALLAH15_FIREBASE_PROJECT_ID=your-firebase-project-id
ALLAH15_FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-firebase-project.iam.gserviceaccount.com
ALLAH15_FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
```

Do not commit service-account credentials. Store them in the hosting provider's secret manager.
