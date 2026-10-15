# Hosting the 15 Seconds for ALLAH API

This repository now includes a minimal non-root Docker image. It packages the existing Express server and the isolated 15 Seconds for ALLAH API, does not bundle local environment files or credentials, and exposes `/api/health-check` as its container health probe.

## Build and smoke-test locally

```bash
docker build -t toolyfi-backend:local .
docker run --rm -p 8080:8080 toolyfi-backend:local
curl http://localhost:8080/api/health-check
```

The generic server can start without Firebase Admin credentials, but authenticated account/reward routes will return an unavailable response until its secret variables are configured.

## Required host configuration

Configure these as **server-side secrets/environment variables** in the selected host's secret manager:

- `ALLAH15_FIREBASE_PROJECT_ID=toolyfi-208b8`
- `ALLAH15_FIREBASE_CLIENT_EMAIL=<dedicated service account email>`
- `ALLAH15_FIREBASE_PRIVATE_KEY=<service account private key>`
- `PORT=<port assigned by host, if needed>`

Create a dedicated least-privilege service identity for this server and grant only the Firebase/Firestore access necessary for the reward API. Do not use a personal account key. Never put this key in the Android app, website, `.env` committed to Git, Docker image, or GitHub issues. The host should inject it only at runtime.

After deployment, verify `GET /api/health-check` returns HTTP 200 and `GET /api/15-seconds-for-allah/health` returns the module health payload. Then set the resulting **HTTPS origin** in the Toolyfi site's `allah15-api-base` meta tag and in the Android client configuration, deploy the site, rebuild the app, and perform a real Firebase sign-in and reward-session test. Leave the API base URL unset until a provider/domain has been chosen and configured.

## Important boundary

The checked-in container definition is deployment-ready scaffolding, not a live deployment. No hosting provider/account or Firebase Admin service identity/private key was supplied or configured in this task, and this environment has no Docker runtime. Do not claim shared rewards are live until host secrets, HTTPS endpoint, client API origins and end-to-end sign-in have all been verified.
