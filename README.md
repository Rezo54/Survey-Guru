# Survey Guru

Survey Guru is a TES — Task Expert Systems product, with Taskraft (Pty) Ltd as operational/field partner.

## Locked repository layout

```text
apps/web          Progressive Web App
apps/android      Android native/hybrid capability shell
apps/api          Survey Guru API
packages/*        Shared domain/client/capability code
docs/*            Living architecture/product/security documentation
infrastructure/*  Environment and deployment documentation/configuration
```

## Security boundary

The PWA and Android application are untrusted clients. Business authority lives behind the Survey Guru API. UI visibility is UX only and must never be used as access control.

## First local checkpoint

1. Install Node.js 24+ and npm.
2. Run `npm install` at repository root.
3. Copy `apps/web/.env.example` to `apps/web/.env.local` and provide the local Firebase web configuration when ready.
4. Run `npm run dev:web`.
5. In a second terminal run `npm run dev:api`.
6. Android packaging is intentionally scaffolded but native platform generation should be done locally after dependencies are installed and the first PWA field flow is verified.

No production credentials are stored in this repository.
