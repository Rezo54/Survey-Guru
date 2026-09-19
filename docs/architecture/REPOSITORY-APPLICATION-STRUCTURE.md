# Survey Guru Repository & Application Structure v1.0

**Product Owner:** TES — Task Expert Systems  
**Operational / Field Partner:** Taskraft (Pty) Ltd  
**Status:** Locked Implementation Baseline / Living Document  
**Version:** 1.0  
**Date:** 12 September 2026

## Decision

Survey Guru uses one monorepo with separately deployable surfaces and shared code:

```text
apps/web          Progressive Web App
apps/android      Android native/hybrid capability shell
apps/api          Survey Guru API
packages/*        Shared domain/client/capability code
docs/*            Living documentation
infrastructure/*  Environment/deployment configuration
```

The Android package is not a separate Survey Guru product. It wraps/extends the shared field PWA with native Android capabilities where runtime reliability requires them.

## Runtime pattern

```text
Shared Survey Guru field experience
            |
      capability interface
       /              \
Web/PWA runtime    Android runtime
       \              /
         Survey Guru API
              |
       Authorisation/domain
              |
         Data/storage
```

## Security

Clients are untrusted. Authentication identifies the caller, but the Survey Guru API independently resolves resource scope and authorises every protected business operation. UI visibility, local roles and cached state never grant authority.

## Firebase setup

Firebase client configuration is injectable through environment variables and intentionally absent from source control. Firebase Admin configuration belongs only in the server environment and is not required for the first shell/health test.

## First checkpoint

The repository should first prove:

1. workspace install succeeds;
2. PWA starts locally;
3. PWA can be installed/loaded with service-worker shell caching;
4. field route renders runtime capability gating;
5. API starts and exposes only non-sensitive health/runtime endpoints until server authentication is configured;
6. Android Capacitor shell configuration exists without pretending native movement has already been implemented;
7. shared domain and capability packages compile from both clients/server.

## Next checkpoint

After Benedict supplies local Firebase configuration, implement Firebase Auth wiring and authenticated API token verification before introducing protected business endpoints or direct data access.

## LinkedIn marketing integration — initial checkpoint (19 September 2026)

App: Survey Guru Marketing. Community Management Development Tier vetting is
pending. No Page permissions or refresh-token entitlement are assumed.

The existing runtime split is preserved:
- Next.js on Netlify: `/privacy`, `/settings/linkedin`, same-site OAuth start and
  callback routes under `/api/integrations/linkedin/`.
- Fastify on Cloud Run: `/api/v1/integrations/linkedin` and its start, callback,
  disconnect, page and drafts operations. Existing Firebase identity and
  `workspace.admin` authority apply to all operations except callback, which uses
  a one-use state and browser binding, then rechecks the initiating administrator.
- Existing Firestore Admin SDK stores connections, pending state and drafts.
  The existing deny-all browser Firestore rules remain unchanged.

### Developer Portal URLs

Register these exact redirects for the appropriate app/environment:

- Development: `https://localhost:3000/api/integrations/linkedin/callback`
- Production: `https://surveyguru.ai/api/integrations/linkedin/callback`
- Public policy: `https://surveyguru.ai/privacy`

Local HTTPS was selected because no hosted development hostname was supplied.
Run `npm --workspace @survey-guru/web run dev -- --experimental-https --port 3000`
and trust the local development certificate before the OAuth round trip. Do not
use the production app credentials for development. If LinkedIn portal validation
requires a public development hostname, provision an HTTPS dev hostname and
replace the DEV redirect in both runtimes and the portal; do not reuse production.
Do not use HTTP callbacks, www redirects, deploy previews or wildcard URLs.

### Server-only configuration

Set `LINKEDIN_ENV=development` locally and `LINKEDIN_ENV=production` in production
on both runtimes. There is no fallback between environments.

API runtime (Cloud Run / local API), using the matching DEV or PROD prefix:

```dotenv
LINKEDIN_PROD_CLIENT_ID=<developer-app-client-id>
LINKEDIN_PROD_CLIENT_SECRET=<server-secret>
LINKEDIN_PROD_REDIRECT_URI=https://surveyguru.ai/api/integrations/linkedin/callback
LINKEDIN_PROD_TOKEN_KEY=<64-hex-characters-from-32-random-bytes>
LINKEDIN_PROD_SCOPES=<space-separated-scopes-actually-granted-in-portal>
```

Development equivalents: LINKEDIN_DEV_CLIENT_ID, LINKEDIN_DEV_CLIENT_SECRET,
LINKEDIN_DEV_REDIRECT_URI, LINKEDIN_DEV_TOKEN_KEY and LINKEDIN_DEV_SCOPES.
Use independent app credentials and encryption keys. An empty scope list disables
connection; do not populate Community Management scopes while vetting is pending
unless the portal actually grants them. No default scopes are requested.

Web runtime (Netlify Functions / local Next.js), no LinkedIn secrets or tokens:

```dotenv
LINKEDIN_ENV=production
LINKEDIN_PROD_REDIRECT_URI=https://surveyguru.ai/api/integrations/linkedin/callback
LINKEDIN_PROD_API_ORIGIN=https://survey-guru-api-1028439473514.africa-south1.run.app
```

Local equivalents: LINKEDIN_ENV=development,
LINKEDIN_DEV_REDIRECT_URI=https://localhost:3000/api/integrations/linkedin/callback,
and LINKEDIN_DEV_API_ORIGIN=http://localhost:8080 (or the actual local API port).
Never use NEXT_PUBLIC for these variables. Use secret management for the API's
client secret and token key. Key replacement requires deleting stored connections
and reconnecting; do not silently rotate a key over unreadable tokens.
Existing production CORS remains SURVEY_GURU_WEB_ORIGIN=https://surveyguru.ai.

### Storage and manual publishing boundary

`linkedinConnections/{sha256(workspaceId:environment)}` stores encrypted token,
expiry, scopes, connecting administrator and optional organisation ID/URN/name.
Page metadata is administrator-entered and explicitly UNVERIFIED; entering a Page
ID does not establish permission to publish. Status responses omit token material.
`linkedinOAuthStates` uses the same key and holds hashed state/binding, actor,
redirect, environment and ten-minute expiry. A new attempt replaces the old one;
success deletes the record. Expired/declined attempts cannot be used and may be
removed by operational cleanup. There is at most one pending attempt per workspace
and environment. Disconnect deletes both records and cancels an in-flight exchange.
`linkedinDrafts` holds immutable text, workspace/environment, creator and review
history. The UI lists up to 50 drafts; editing is intentionally outside this initial
checkpoint (create a new draft instead). No captured customer evidence is copied.

Draft → Preview → Approve → Publish is the required order. The server enforces the
first three steps and rejects ALL publish calls, including approved drafts.
No scheduler, autonomous publishing, external post call or token refresh runs.
Before implementing Publish, verify LinkedIn vetting, granted organisation scopes,
Page administrative authority and current API version; bind approval to exact text
and verified Page, invalidate it on edits/reconnection, and design idempotent sends
and audit records. Enabling an environment flag alone must not bypass those checks.

### Verification and release

Tests use fake provider responses and Firestore fixtures, never live tokens or
publishing. They cover environment configuration, variable TTL, encryption,
workspace/role boundaries, expired/mismatched/replayed state, browser binding,
cancellation, disconnect, explicit workflow order and the locked publish endpoint.
Run root typecheck, API test command (also runs web tests) and production build.
After owner approval and deployment, validate public policy and callback routing,
real admin consent/decline, metadata-only responses and disconnect against LinkedIn.
Live verification requires actual granted scopes and is not implied by mocked tests.
Privacy controller confirmed by owner: Task Expert Systems (Pty) Ltd. Privacy
contact uses the existing consult@surveyguru.ai mailbox. The policy discloses the
implemented data practices; it does not certify LinkedIn approval. Operator review
of applicable terms/customer agreements remains part of the vetting submission.

Reference: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
Reference: https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review
Reference: https://www.linkedin.com/legal/l/api-terms-of-use

### Local HTTPS configured (19 September 2026)

The working checkout now has a `dev:https` web script using Next.js experimental
HTTPS with explicit local certificate/key paths. Run from the repository root:
`npm --workspace @survey-guru/web run dev:https`.
Certificates are in apps/web/certificates; the local mkcert CA/cache are under
.local-https. Both directories and certificate/key extensions are Git-ignored.
No TLS material is tracked. Do not copy, commit or distribute rootCA-key.pem.

A request to https://localhost:3000 was verified with the generated root CA and
normal TLS hostname/chain checking (no insecure TLS bypass), returning HTTP 200.
Windows trust-store import could not be performed from the agent environment.
From a normal PowerShell window in this checkout, run:

```powershell
certutil -user -addstore Root .\.local-https\ca\rootCA.pem
```

Accept the Windows certificate-trust confirmation if prompted. Restart Chrome or
Edge, then visit https://localhost:3000. This imports the public CA certificate
for your Windows user only, not the private key. Do not click through certificate
warnings if import fails; report the command error instead. These certificates
exist only in this working checkout and are not delivered by a Git pull.
LinkedIn redirect configuration is unchanged.
