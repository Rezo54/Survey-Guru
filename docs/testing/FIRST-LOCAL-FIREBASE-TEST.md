# Survey Guru — First Local / Firebase Test Checkpoint

Status: local checkpoint only. No production deployment or production credentials.

## Purpose

Validate the shared Survey Guru PWA experience, representative GIS-first routes, PWA shell/service worker, injectable Firebase Web SDK configuration, local API health boundary, and the explicit capability gate that reserves reliable background movement for the Android layer.

This checkpoint does **not** claim that background GPS, authoritative coverage processing, production Firebase Admin authentication, Firestore business-data access, or the full Story + Explore experience is complete.

## Prerequisites

- Node.js 24 or newer
- npm compatible with the repository lock/workspace setup
- A non-production Firebase project/app approved for Survey Guru testing
- Chrome or Edge for PWA testing
- Android Studio only if preparing the Capacitor Android shell

## 1. Get the checkpoint branch

```bash
git fetch origin
git switch agent/local-test-checkpoint
git pull origin agent/local-test-checkpoint
npm install
```

## 2. Configure the Web SDK

Copy `apps/web/.env.example` to `apps/web/.env.local` and populate only the Firebase Web App configuration from the non-production Firebase project:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_SURVEY_GURU_API_URL=http://localhost:8080
```

These values configure the browser Firebase SDK. Do not place Firebase Admin private keys or service-account JSON in the web application.

## 3. Configure the local API

Copy `apps/api/.env.example` to `apps/api/.env` if local overrides are needed. The first checkpoint intentionally exposes only health/runtime diagnostics. Protected business endpoints must remain disabled until server-side authentication and authorisation are configured and tested.

## 4. Integrity checks

From the repository root run:

```bash
npm run typecheck
npm run build
```

Both commands must complete successfully before treating the checkpoint as test-ready.

## 5. Run the API and PWA

Use two terminals from the repository root:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Confirm the API health endpoint at `http://127.0.0.1:8080/health` reports `status: ok`. Then open the local Next.js URL printed by the web development server.

## 6. Browser smoke test

Verify:

1. `/dashboard` renders the management command workspace.
2. `/projects/demo/map` renders Project Map & Coverage.
3. `/field` renders Field Today and states that background coverage requires Android native capability.
4. `/field/map` renders the Field Live Map prototype.
5. The browser application manifest is available and the service worker registers without an application error.
6. Reload once while DevTools Application > Service Workers is open and confirm `/sw.js` is registered.
7. No Firebase Admin credentials, service-account secrets, or direct Firestore business-data calls are present in the browser.

## 7. Security checkpoint

The Web SDK may provide Firebase Authentication identity. Identity alone does not grant business-data authority. Survey Guru business operations must flow through the Survey Guru API, which independently authorises workspace, permission, project/assignment scope, data domain and data rights. The first checkpoint deliberately fails closed by leaving protected business endpoints disabled until server authentication is configured.

## 8. Android preparation

The Android project is a capability extension of the same field product, not a separate authority boundary. Run Android preparation only after the web build is healthy:

```bash
npm run android:sync
```

The current Android shell is preparation for local device testing. Do not interpret a successful Capacitor sync as proof that reliable background GPS is complete; that remains a Movement Reliability Prototype acceptance item.

## 9. Pass / fail rule

PASS requires successful typecheck/build plus successful rendering of the four representative routes and PWA registration. Firebase configuration must be injectable without committed secrets, and the API must remain the declared authority boundary.

Any compile error, failed route, failed service-worker registration, secret exposure, direct broad Firestore authority, or silent PWA fallback for required background movement is a FAIL and must be corrected before the next checkpoint.
