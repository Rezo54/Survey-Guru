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
