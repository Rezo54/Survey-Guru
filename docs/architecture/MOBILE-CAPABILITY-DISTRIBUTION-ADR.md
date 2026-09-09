# ADR — Survey Guru Mobile Capability & Distribution v1.1

**Product Owner:** TES — Task Expert Systems  
**Operational / Field Partner:** Taskraft (Pty) Ltd  
**Status:** Approved Architecture Decision / Living Document  
**Version:** 1.1  
**Updated:** 9 September 2026

## 1. Decision

Survey Guru will be built as a **Progressive Web App (PWA) with an Android native/hybrid field layer for capabilities that require stronger device integration and reliability**.

This is not a choice between PWA and Android. The intended architecture is:

> **PWA-first shared application experience + Android native/hybrid capability layer.**

The management application remains web/PWA-capable. The field experience must be installable and usable as a PWA where browser capability is sufficient, while the Android packaged field application provides the stronger native capabilities required for reliable background movement, durable offline field operation and device integration.

**iOS is explicitly outside MVP scope** and may be introduced later when customer/user demand justifies it. Backend/API/domain contracts remain platform-neutral.

Initial Android distribution should favour controlled/private operational distribution. Public Google Play availability is not an MVP prerequisite.

## 2. Why Both PWA and Android Native/Hybrid

Survey Guru needs two characteristics simultaneously:

1. **low-friction web deployment and installability**; and
2. **reliable Android field capability** for demanding operational workflows.

The PWA provides:

- URL-based access;
- installable web experience;
- responsive mobile/desktop delivery;
- service-worker/offline application shell;
- rapid application updates;
- reusable TypeScript/web UI;
- broad access for supervisors, QA, clients and appropriate field use;
- reduced duplication between web and packaged Android experiences.

The Android native/hybrid layer adds capabilities where PWA/browser behaviour is insufficient or inconsistent, particularly:

- reliable background location during active Search Sessions;
- Android foreground service integration;
- stronger lifecycle handling across lock screen/app switching;
- protected local persistence;
- robust background/retry sync;
- native camera/device integration where required;
- battery/network/device diagnostics;
- secure native credential/session storage where appropriate.

TES will not weaken coverage requirements merely to remain inside browser limitations.

## 3. Product Surfaces

```text
                         SURVEY GURU
                              |
              +---------------+---------------+
              |                               |
              v                               v
        WEB / PWA SURFACE              ANDROID FIELD APP
      Next.js / TypeScript             Hybrid Native Shell
              |                               |
      Management / QA / Client          Shared Web/PWA UI
      Installable PWA                   + Native Android APIs
              |                               |
              +---------------+---------------+
                              |
                              v
                       Survey Guru API
                              |
                  Authorisation / Domain
                              |
                 Data / Storage / Coverage
```

The Android package should reuse the Survey Guru field web/PWA experience wherever practical rather than becoming a separately designed product.

## 4. PWA Is a First-Class Product Requirement

Survey Guru web surfaces must be designed as a proper Progressive Web App rather than merely a responsive website.

PWA requirements include:

- valid web app manifest;
- installable application identity;
- responsive layouts;
- service-worker strategy;
- application-shell caching;
- controlled offline behaviour;
- update/version detection;
- safe cache invalidation;
- explicit online/offline state;
- recovery from interrupted requests;
- no assumption that cached UI implies current authority;
- secure HTTPS deployment;
- accessible install/update experience.

The exact PWA implementation library is not locked by this ADR.

## 5. Shared Code Principle

The PWA and Android packaged application should share as much of the following as is technically sensible:

```text
UI components
Field workflows
Survey rendering
Validation presentation
API client
Authentication flow abstraction
Assignment models
Visit models
Sync models
Coverage presentation
Map components
Error/status vocabulary
```

Native Android code should concentrate on device-specific capability rather than duplicating Survey Guru business logic.

## 6. Hybrid Direction

Capacitor remains the preferred first candidate for evaluation because it can package the shared web/PWA field experience while exposing native Android capability.

The intended boundary is conceptually:

```text
Survey Guru Field PWA/UI
          |
   Capability Interface
          |
   +------+--------------------+
   |                           |
Web/PWA implementation     Android native implementation
when sufficient            when reliability requires it
```

If an off-the-shelf plugin cannot satisfy field reliability, TES may implement a narrowly scoped Kotlin plugin/module behind this interface.

Framework choice remains subject to prototype evidence.

## 7. Capability Abstraction

Field code should not directly scatter platform checks throughout business workflows.

Use capability abstractions such as:

```text
LocationCapability
CameraCapability
LocalStoreCapability
SyncCapability
ConnectivityCapability
NotificationCapability
DeviceDiagnosticsCapability
```

The runtime can supply a web/PWA or Android-native implementation.

This keeps a future iOS implementation possible without redesigning Survey Guru's domain model.

## 8. PWA Capability Policy

The PWA may perform field functions that its runtime can execute credibly.

However, a project requiring authoritative movement-supported Live Street Coverage must not silently fall back to inadequate browser tracking.

Before an Assignment begins, Survey Guru should evaluate required capabilities.

Example:

```text
Survey Capture          Ready
Offline Package         Ready
Camera                  Ready
Background Coverage     Native Android required
```

If project Coverage Policy requires reliable background movement and the current PWA runtime cannot provide it, the application should direct the worker to the supported Android field app rather than pretending full capability exists.

## 9. Native Capabilities Required

The Android field layer must support, subject to Android rules and user permissions:

- reliable foreground/background location collection for active Search Sessions;
- Android foreground-service behaviour where required;
- camera/photo capture;
- protected local persistence;
- durable offline operation queue;
- background/retry-capable synchronisation;
- connectivity awareness;
- battery/power-state awareness where operationally useful;
- application lifecycle recovery;
- safe app switching;
- secure native storage;
- app/device diagnostics;
- notification capability where useful.

## 10. Background Location Principle

Background movement collection is permitted only for a legitimate active Survey Guru field purpose.

```text
Assignment Ready
      |
Start Assignment
      |
Search Session ACTIVE
      |
Native Location Capability Active
      |
Movement Evidence Captured
      |
Pause / Visit / Resume
      |
Complete Search Session
      |
Location Capability Stops
```

Survey Guru must not implement unrestricted always-on worker tracking.

## 11. Coverage Authority Remains Server-Side

Neither the PWA nor Android native layer is authoritative for final coverage.

The client may calculate/display provisional local progress, but cannot authoritatively set:

- `COVERED`;
- `VERIFIED`;
- final traversal percentage;
- final confidence;
- searched-zero-found;
- QA outcome.

Movement Batches are uploaded to the Survey Guru API and authoritative coverage is derived/reconciled server-side.

## 12. Offline Architecture

Both the PWA and Android field package should support offline-first field workflows to the extent appropriate to their runtime.

Minimum authorised offline package may include:

- Assignment;
- immutable Survey Version;
- project/zone boundary;
- relevant Street Segments;
- relevant Coverage Cells;
- current authorised coverage state;
- Coverage Policy/version;
- relevant known outlets/duplicate subset;
- Search Session state where supported;
- Visits/Responses/Repeatable Rows;
- Evidence queue;
- Movement Batches where supported;
- corrections/revisits;
- sync/idempotency metadata.

Offline does not permit unrestricted caching of the TES Market Universe.

## 13. PWA Offline Storage

The PWA should use appropriate browser storage for offline application state and queued work, with IndexedDB or equivalent durable browser storage preferred over fragile key/value-only approaches for substantive field records.

Service-worker caches and business data stores are separate concerns:

```text
Service Worker Cache -> application shell / controlled static resources
Offline Data Store   -> authorised assignments / visits / queues
```

Cached data never bypasses reauthorisation when synchronising.

## 14. Android Local Data Protection

The Android packaged application may use stronger platform storage where required.

At minimum:

- tokens/secrets use secure platform storage;
- application data remains app-private;
- sensitive local DB/files receive appropriate protection;
- debug logs exclude tokens and unnecessary sensitive payloads;
- evidence is not intentionally placed in public/shared storage;
- logout/revocation/retention behaviour is defined.

## 15. Search Session & Tracking UX

When field search is active:

```text
Searching this assignment
Movement is being used to calculate project coverage.

[Pause Search]
```

The worker can clearly see active, paused and completed states.

Where the PWA cannot meet a required background-location capability, it must say so before field execution rather than allowing an unreliable session.

## 16. App Switching Requirement

The Android application must be tested while switching between:

```text
Survey Guru
Premier Power Apps
Navigation / Maps
Camera
Phone call
Messaging
Home screen
Lock screen
```

Normal switching must not silently destroy Visit, Evidence, Search Session or unsynchronised Movement Batch state.

## 17. Premier WTS Interaction

Survey Guru remains the canonical capture record.

For Premier WTS v2.006 POC/fallback operation, the Android app must tolerate switching to Premier Power Apps and back without losing field state.

The PWA architecture and shared UI must not prevent this native packaged workflow.

## 18. PWA Update Strategy

PWA updates must avoid field disruption.

Rules:

1. never force-refresh while unsynchronised field work is active;
2. detect a new application version;
3. inform the user when an update is ready;
4. activate safely at a workflow boundary;
5. retain/migrate compatible offline data;
6. reject incompatible stale packages server-side where necessary with a recoverable path;
7. record app/schema/package versions with important offline operations.

## 19. Android App Update Strategy

Controlled Android builds need explicit versioning and update management.

The backend may define minimum supported app versions for security or contract compatibility, but should avoid unnecessary forced upgrades during active field work.

Android package and PWA release versions should be traceable to shared application/API contract versions.

## 20. Distribution Decision

Survey Guru has two distribution channels:

### PWA

Delivered securely over the web and optionally installed from the browser/device where supported.

### Android packaged application

Initially distributed through a controlled/private operational mechanism where practical.

Public Google Play availability is not a prerequisite for MVP field deployment.

The exact private distribution mechanism will be selected based on device ownership, MDM/enterprise capability, signing/update needs and commercial rollout.

## 21. Public Google Play Later

A public Google Play release may follow when broader self-service installation and commercial distribution justify it.

Public-store release is a distribution/commercial milestone, not the definition of Survey Guru's PWA capability.

## 22. iOS Decision

**iOS remains deferred.**

No iOS packaged field client is required for MVP acceptance.

A user may still access suitable Survey Guru web/PWA surfaces through a compatible browser, but TES makes no MVP commitment that iOS browser/PWA behaviour will satisfy movement-supported field coverage requirements.

Future iOS native/hybrid support must reuse platform-neutral API/domain contracts.

## 23. Device Support Strategy

TES/Taskraft will establish an initial supported Android device/OS matrix based on field evidence.

Pilot devices should represent low/mid-range field hardware, common manufacturers, multiple Android versions, constrained resources, manufacturer battery optimisation and weak connectivity.

## 24. Battery & Sampling

Survey Guru must balance evidence quality and battery life.

Production sampling frequency is not yet locked. It may adapt according to Search Session state, movement, GPS quality, speed, distance, battery and Coverage Policy.

The Coverage Engine remains responsible for evidence sufficiency.

## 25. Foreground Service UX

Where Android requires a foreground service/notification:

```text
Survey Guru — Search active
Recording movement for Mahikeng WTS coverage.
```

The notification must be clear and purpose-limited.

## 26. Failure Recovery

The PWA and Android application must recover safely, according to runtime capability, from:

- app/browser restart;
- process termination;
- background restriction;
- network loss;
- failed uploads;
- partial evidence upload;
- interrupted Movement Batch submission;
- session expiry;
- server conflict;
- storage pressure;
- permission revocation;
- application update.

Preserve legitimate unsynchronised field evidence without duplicating authoritative records.

## 27. Capability Test Matrix

Before production rollout test at minimum:

1. PWA installability;
2. PWA application-shell offline launch;
3. PWA offline Visit capture/recovery;
4. PWA update with unsynchronised work;
5. foreground Android walking;
6. screen locked while walking;
7. phone in pocket/screen off;
8. Survey Guru backgrounded;
9. camera capture during Search Session;
10. repeated photo capture;
11. Premier Power Apps switch/return;
12. navigation/maps switch/return;
13. phone interruption;
14. messaging interruption;
15. weak GPS;
16. GPS unavailable/recovered;
17. data loss/extended offline;
18. reconnection/backlog sync;
19. process kill/restart;
20. battery saver;
21. low battery;
22. low storage;
23. permission revocation;
24. session expiry offline;
25. duplicate Movement Batch retry;
26. partial Evidence retry;
27. Assignment reassigned offline;
28. full field shift;
29. multiple field days;
30. local/server coverage reconciliation;
31. side-street false-positive protection;
32. capability-gating from unsupported PWA runtime to Android app.

## 28. Production Acceptance Gate

Architecture is acceptable when:

1. PWA installs and operates correctly for its supported workflows;
2. PWA offline Visit work survives interruption;
3. PWA update handling does not destroy unsynchronised work;
4. Android active Search Sessions survive realistic lifecycle changes;
5. app switching does not lose field state;
6. screen lock does not create unacceptable coverage gaps;
7. offline work persists safely;
8. retries remain idempotent;
9. battery supports realistic shift;
10. side streets are not falsely completed;
11. server remains coverage authority;
12. unsupported PWA capability is explicitly gated rather than silently degraded.

## 29. Security Requirements

Both surfaces preserve the existing architecture:

- Firebase Authentication establishes identity;
- Survey Guru API authorises business operations;
- cached/client roles are not trusted;
- no Firebase Admin credentials in browser or APK;
- no production integration secrets embedded client-side;
- evidence access remains authorised;
- offline sync is reauthorised/revalidated;
- Movement Batch ownership is server verified;
- client cannot set authoritative coverage/QA/integration state;
- service-worker caches do not become an access-control boundary.

## 30. Environment & Release Separation

Development, staging/test and production builds/deployments use separated backend/environment configuration.

Experimental PWA or Android builds must not accidentally access live customer production data.

Release credentials and production deployment authority remain separate from autonomous code-generation authority.

> **No autonomous agent receives simultaneous authority over code, production credentials and deployment.**

## 31. Consequences

### Positive

- Survey Guru remains easy to access/install as a PWA;
- management and field web experiences share technology;
- Android provides reliable native capability where needed;
- field users are not forced through public Play Store distribution for MVP;
- shared code reduces duplication;
- future iOS remains possible;
- browser limitations cannot silently weaken coverage integrity.

### Costs / Risks

- two runtime modes must be tested;
- capability abstraction is required;
- service-worker/cache versioning needs discipline;
- Android build/signing remains necessary;
- native plugins increase technical surface area;
- background location/battery behaviour requires ongoing device testing.

## 32. Rejected Alternative — PWA Only

Rejected as the sole field architecture because movement-supported coverage cannot depend on browser background behaviour being adequate on every target Android device.

PWA remains a first-class Survey Guru delivery surface.

## 33. Rejected Alternative — Native Android Only

Rejected because Survey Guru benefits materially from web/PWA deployment, installability, rapid updates and shared code across management and field workflows.

Native capability should extend the PWA architecture, not unnecessarily replace it.

## 34. Rejected Alternative — Android + iOS MVP

Rejected because current field demand does not justify the additional implementation/test/release complexity.

## 35. Locked Decisions v1.1

1. Survey Guru is a Progressive Web App.
2. PWA is a first-class product requirement, not merely a responsive website.
3. Survey Guru field MVP is Android-first for native packaged capability.
4. Android native/hybrid capability extends the shared PWA field experience.
5. iOS packaged support is outside MVP scope.
6. Future iOS remains architecturally possible.
7. Capacitor remains the preferred first hybrid candidate, subject to prototype evidence.
8. Native Kotlin may be used behind capability interfaces where required.
9. Field business logic should be shared rather than duplicated between PWA and Android.
10. Background location is required for movement-supported Search Sessions where Coverage Policy requires it.
11. Unsupported PWA runtimes must be capability-gated rather than silently degraded.
12. Tracking is purpose-limited, visible and controllable.
13. Server remains authoritative for coverage.
14. Local coverage is provisional only.
15. Offline persistence is mandatory for field workflows.
16. PWA service-worker cache and offline business-data store are separate concerns.
17. App switching to Premier/navigation/camera must be supported by Android field package.
18. Public Google Play release is not required for MVP.
19. Controlled/private Android distribution is preferred initially.
20. Supported Android devices/versions are evidence-driven.
21. Battery/sampling policy is field-tested.
22. PWA install/offline/update tests are mandatory.
23. Android background/lock/app-switch/full-shift tests are mandatory.
24. No client contains production admin credentials.
25. Environment separation applies to PWA and Android builds.
26. Autonomous agents do not receive code + production credentials + deployment authority simultaneously.

## 36. Follow-On Work

1. Update the Movement Reliability Prototype to explicitly use the PWA + Android capability model.
2. Establish repository structure for shared PWA, Android shell, API and packages.
3. Prototype Capacitor packaging of the field PWA.
4. Prototype native Android movement capability.
5. Test PWA offline/install/update behaviour independently of background movement.
6. Test Android background GPS/app switching/battery.
7. Define controlled Android signing/distribution.
8. Feed measured results back into all affected living specifications.

---

## Living Documentation Rule

This ADR is a living TES architecture decision. Material changes to PWA strategy, supported mobile platforms, background-location capability, distribution, offline architecture, device support, signing/release or field privacy must be version-controlled here and reflected in other materially affected Survey Guru/TES documents.