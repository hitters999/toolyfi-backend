# Toolyfi Backend

Node.js/Express API server used by Toolyfi. The isolated **15 Seconds for ALLAH** account and reward API is documented in [`modules/15-seconds-for-allah/README.md`](modules/15-seconds-for-allah/README.md).

## Local development

Requires Node.js 18 or newer.

```bash
npm ci
npm test
npm start
```

The non-Firebase health routes are available at `/` and `/api/health-check`. The 15 Seconds for ALLAH module exposes `/api/15-seconds-for-allah/health`; authenticated routes require Firebase ID tokens and the Firebase Admin environment variables below.

## Server secrets

Set these values in the deployment provider's secret manager, not in source control or a checked-in `.env` file:

- `ALLAH15_FIREBASE_PROJECT_ID`
- `ALLAH15_FIREBASE_CLIENT_EMAIL`
- `ALLAH15_FIREBASE_PRIVATE_KEY`

Never commit Firebase service-account credentials or paste the private key into a public issue or pull request. See [`.env.15-seconds-for-allah.example`](.env.15-seconds-for-allah.example) for variable names only.

The service also supports other Toolyfi integrations. See `server.js` for the environment variables those existing routes use.

## Container deployment

The repository includes a minimal non-root `Dockerfile` and `.dockerignore`. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for local build commands, runtime secret requirements, and the required post-deployment HTTPS checks. These files are deployment scaffolding; they do not provision a host or Firebase service-account credentials.
