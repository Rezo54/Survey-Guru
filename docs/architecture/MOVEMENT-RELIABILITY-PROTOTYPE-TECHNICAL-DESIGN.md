# Survey Guru Movement Reliability Prototype — Technical Design v1.0

**Product Owner:** TES — Task Expert Systems  
**Operational / Field Partner:** Taskraft (Pty) Ltd  
**Status:** Prototype Technical Baseline / Living Document  
**Version:** 1.0  
**Date:** 9 September 2026

## 1. Purpose

This document defines the first executable mobile engineering spike for Survey Guru after the Android-first Mobile Capability & Distribution ADR.

The prototype exists to answer one question before TES builds the complete field application:

> **Can Survey Guru reliably collect sufficient, privacy-bounded movement evidence on realistic Android field devices across screen lock, app switching, camera use, Premier Power Apps use, calls, weak connectivity and a full field shift, then reconcile that evidence into credible server-authoritative street coverage?**

The prototype is intentionally narrow. It is not the Survey Guru MVP field UI.

## 2. Prototype Outcome

The prototype must prove or disprove the mobile capability assumptions behind Live Street Coverage.

Successful prototype flow:

```text
Authenticate
  -> Download Test Assignment Package
  -> Start Search Session
  -> Start Android Movement Service
  -> Walk / Drive Test Network
  -> Lock / Unlock Phone
  -> Switch Applications
  -> Capture Photo
  -> Use Premier Power Apps
  -> Lose / Restore Connectivity
  -> Stop Search Session
  -> Upload Idempotent Movement Batches
  -> Server Validates
  -> Server Map-Matches
  -> Coverage Engine Derives Traversal
  -> Compare Expected vs Actual Coverage
  -> Review Battery / Reliability / False Positives
```

## 3. Non-Goals

This spike will not attempt to complete:

- full Survey Builder;
- production project administration;
- complete Visit/question UI;
- client reporting;
- production Premier automation;
- opportunity scoring;
- ML-based routing;
- public Play Store release;
- iOS support;
- final production visual design.

## 4. Architecture Hypothesis

Preferred prototype direction:

```text
Android Device
   |
   +-- Hybrid Application Shell
   |      |
   |      +-- TypeScript/Web UI
   |      +-- Native Android Movement Module
   |      +-- Local Durable Store
   |      +-- Sync Queue
   |
   v
Survey Guru API
   |
   +-- Authentication / Authorisation
   +-- Movement Ingestion
   +-- Coverage Processing
   |
   v
Spatial Processing / Prototype Store
```

The hybrid shell should allow maximum reuse of Survey Guru TypeScript/UI logic while using native Android capability for the reliability-critical movement lifecycle.

## 5. Framework Evaluation

**Capacitor is the preferred first candidate for the prototype**, because Survey Guru's broader stack is Next.js/TypeScript and the field application can retain web skills/code while accessing native Android plugins/modules.

However, the framework is not considered permanently locked until the prototype proves:

- background location reliability;
- application lifecycle recovery;
- local persistence reliability;
- acceptable plugin/native extension model;
- maintainability;
- build/release practicality.

If an off-the-shelf location plugin cannot satisfy the Coverage requirements, TES should implement a narrowly scoped native Android/Kotlin movement plugin rather than weakening the product requirement.

## 6. Prototype Components

### Android Client

1. Authentication screen.
2. Test Assignment selector/package download.
3. Search Session controller.
4. Native movement service.
5. GPS diagnostics panel.
6. Local event/batch store.
7. Sync queue.
8. Simple live/provisional map.
9. Test interruption controls/instructions.
10. Session summary.

### Backend

1. Test Assignment Package endpoint.
2. Search Session endpoints.
3. Movement Batch ingestion endpoint.
4. Idempotency enforcement.
5. Validation pipeline.
6. Prototype map-matching processor.
7. StreetTraversal derivation.
8. Coverage calculation.
9. Diagnostics endpoint/report.

## 7. Prototype Screen Flow

```text
LOGIN
  |
  v
TEST ASSIGNMENT
  |
  v
READINESS
  |
  v
START SEARCH
  |
  v
LIVE TEST MAP
  |       |
  |       +--> GPS DIAGNOSTICS
  |       +--> CAPTURE TEST PHOTO
  |       +--> TEST INSTRUCTIONS
  |
  v
STOP SEARCH
  |
  v
SYNC
  |
  v
SESSION RESULTS
```

## 8. Readiness Screen

Before starting:

```text
Authentication             Ready
Assignment Package          Ready
Street Network              Ready
Location Permission         Ready
Background Location         Ready
Notification Permission     Ready / N/A
Battery Restriction         Status
Local Storage               Ready
Connectivity                Online / Offline-capable
App Version                 x.x.x
```

The prototype records the actual device/OS configuration with the test result.

## 9. Search Session Controller

Search Session is the explicit operational boundary for movement collection.

States:

```text
READY
ACTIVE_SEARCH
PAUSED
COMPLETED
CANCELLED
```

The prototype may temporarily support a simulated `VISIT_IN_PROGRESS` state to test whether movement behaviour should pause/change during outlet capture.

Server owns authoritative Search Session identity and assignment relationship.

## 10. Native Android Movement Service

The native movement layer is responsible only for reliable collection and local persistence of movement evidence while a legitimate Search Session is active.

It should expose a small bridge contract to the hybrid application, conceptually:

```text
startSearchSession(config)
pauseSearchSession()
resumeSearchSession()
stopSearchSession()
getMovementStatus()
getRecentDiagnostics()
```

It must not contain business logic for final street coverage.

## 11. Android Foreground Service

Where required by Android, active background movement uses an appropriate foreground service and visible notification.

Conceptual notification:

```text
Survey Guru — Search active
Recording movement for Test Assignment A.
```

The notification should allow return to the active Survey Guru test session.

The service stops when the Search Session completes/cancels and behaves according to explicit pause policy.

## 12. Movement Event Logical Model

Each logical movement observation should be capable of carrying:

```text
movementEventId
searchSessionId
deviceId / installationId
sequenceNumber
capturedAt
latitude
longitude
accuracyMetres
altitude? 
speed? 
bearing? 
provider/source
isMockSignal? where legitimately available
appLifecycleState
batteryState? sampled economically
networkState? sampled economically
```

Not every diagnostic attribute needs to be persisted permanently in production. The prototype may collect more diagnostics to establish policy.

## 13. Sampling Strategy — Prototype

Do not lock one production interval yet.

The prototype should test at least three candidate profiles, for example:

```text
PROFILE A — conservative battery
PROFILE B — balanced
PROFILE C — higher evidence density
```

Profiles should vary time/distance/accuracy behaviour rather than simply collecting maximum-rate GPS.

Exact numeric settings are implementation test parameters and must be recorded with each run.

## 14. Adaptive Sampling Hypothesis

Future production sampling may respond to:

- stationary vs moving;
- walking vs vehicle speed;
- distance moved;
- accuracy degradation;
- screen/app state only where technically relevant;
- battery condition;
- Search Session state;
- Coverage Policy.

The prototype should measure enough data to decide whether adaptive sampling materially improves battery/evidence trade-offs.

## 15. Local Persistence

Movement Events must be written to durable local storage before being considered safely captured.

Recommended prototype abstraction:

```text
Local DB
  search_sessions
  movement_events or compact movement_batches
  sync_operations
  prototype_photos
  diagnostics
```

The implementation may use SQLite or another suitable durable Android-compatible store behind an application repository abstraction.

Local storage choice must not leak into Survey Guru domain/API contracts.

## 16. Movement Batching

Events should be grouped into immutable/idempotent Movement Batches for upload.

Conceptual batch:

```text
batchId
searchSessionId
deviceInstallationId
firstSequence
lastSequence
capturedFrom
capturedTo
samplingProfileVersion
events[]
clientCreatedAt
idempotencyKey
```

Once acknowledged by the server, local retention can follow defined policy rather than immediately deleting evidence required for diagnostics/reconciliation.

## 17. Movement API

Prototype aligns with API v1.1 direction:

```text
POST /api/v1/search-sessions/{searchSessionId}/movement-batches
```

Server verifies:

- authenticated identity;
- Search Session ownership/authority;
- Assignment relationship;
- batch/session consistency;
- sequence range;
- timestamps;
- coordinates;
- payload size/count;
- duplicate/idempotency state;
- offline capture validity;
- rate limits.

The client cannot submit authoritative matched street or coverage state.

## 18. Upload Behaviour

The prototype must work under:

```text
ONLINE
INTERMITTENT
OFFLINE
RECONNECTING
```

A successful local capture does not require immediate network availability.

Sync uses retry with bounded backoff and idempotency. A retry cannot create duplicate authoritative Movement Events/Traversals.

## 19. Sequence Integrity

Each installation/Search Session should maintain monotonic event sequence information sufficient to identify:

- missing intervals;
- duplicate batches;
- reordered uploads;
- interrupted sessions;
- suspicious impossible gaps.

Sequence gaps are evidence-quality information, not automatically fraud.

## 20. App Lifecycle Diagnostics

Prototype should record important lifecycle transitions around movement gaps, including where available/appropriate:

```text
FOREGROUND
BACKGROUND
SCREEN LOCKED
SERVICE RESTARTED
APP PROCESS RESTARTED
PERMISSION CHANGED
LOCATION UNAVAILABLE
BATTERY RESTRICTION DETECTED
```

The objective is to explain reliability failures during testing, not create permanent employee surveillance metadata without purpose.

## 21. Test Map

The prototype live map needs only enough UI to show:

- Assignment boundary;
- eligible test streets;
- current location;
- local provisional path/coverage indicator;
- server-confirmed coverage after processing;
- uncovered/partial/covered distinction;
- GPS quality;
- sync status.

Raw path display is acceptable in this dedicated engineering prototype. It does not change the product rule that raw breadcrumbs are not normal management/client UI.

## 22. Map Matching Prototype

Server processing must compare GPS evidence to the eligible street network using:

- distance;
- heading where useful;
- sequence continuity;
- topology;
- plausible movement;
- parallel-street ambiguity;
- side-street geometry.

The output is derived traversal evidence, not a direct copy of the GPS path.

## 23. StreetTraversal Prototype Output

Conceptual:

```text
streetTraversalId
searchSessionId
streetSegmentId
firstObservedAt
lastObservedAt
uniqueSupportedMetres
supportedPercent
confidence
algorithmVersion
evidenceBatchIds[]
exceptionFlags[]
```

Repeated movement over the same metres must not inflate unique coverage.

## 24. Side-Street Test

This is a mandatory prototype scenario.

Test route must deliberately:

1. walk along a main street;
2. cross several side-street entrances;
3. enter one side street partially;
4. fully traverse another side street;
5. travel parallel to another nearby street.

Expected result:

- crossed entrances remain uncovered;
- partial entry remains partial where evidence supports it;
- fully traversed street reaches the applicable derived threshold;
- parallel street remains uncovered unless actually traversed.

A false-positive side-street result is a high-severity prototype failure.

## 25. Ground Truth Test Routes

Before each field test, define expected ground truth:

```text
Expected traversed segments
Expected untouched segments
Expected partial segments
Expected route start/end
Known interruption points
Expected app-switch events
```

This allows measured comparison rather than subjective visual judgement.

## 26. Coverage Comparison Metrics

Prototype should calculate at least:

```text
True traversed street metres detected
Missed traversed metres
False covered metres
False covered street segments
Correctly outstanding side streets
Coverage processing latency
Confidence distribution
```

False-positive coverage receives greater weight than conservative false-negative/partial coverage because it can cause Survey Guru to tell operations an area was searched when it was not.

## 27. Battery Metrics

For each run capture:

```text
Device model
Android version
Battery start %
Battery end %
Duration
Distance
Sampling profile
Screen-on duration estimate
Network state
Number of photos/app switches
Battery saver state
```

Compare profiles under similar test routes where practical.

## 28. Reliability Metrics

Track:

```text
Expected session duration
Observed movement duration
Unexplained gaps
Longest unexplained gap
Service restarts
Process deaths
Events captured
Events uploaded
Duplicate retries safely ignored
Sync delay
Crash count
```

## 29. App-Switch Test Script

A standard test should include:

```text
00:00 Start Search
00:10 Lock screen / pocket
00:20 Unlock
00:25 Open camera and capture photo
00:30 Open Premier Power Apps
00:40 Return to Survey Guru
00:45 Open navigation/maps
00:55 Receive/simulate phone interruption
01:00 Disable mobile data
01:20 Continue offline
01:30 Restore connectivity
01:40 Verify backlog sync
02:00 Stop Search
```

Longer and full-shift variants follow after the short controlled test passes.

## 30. Full-Shift Test

Before production acceptance, run a realistic field day with:

- multiple Search Sessions/Assignments;
- multiple outlet/photo interactions;
- app switching;
- lunch/pause behaviour;
- weak connectivity zones;
- screen lock;
- normal phone interruptions;
- battery constraints;
- end-of-day sync.

The device should finish with operationally acceptable battery and no unexplained loss of material field evidence.

## 31. Device Matrix

Initial matrix should include several representative Android classes rather than flagship-only testing:

```text
Low / constrained field device
Typical mid-range field device
Higher-spec reference device
```

Include at least one manufacturer known to apply aggressive battery optimisation if present in the actual field population.

Exact models will be selected from devices Taskraft/TES actually expects surveyors to use.

## 32. Permissions Test

Test:

- permission granted normally;
- precise/approximate implications where applicable;
- background permission flow;
- permission denied;
- permission revoked during session;
- notification permission behaviour where applicable;
- location services disabled/re-enabled.

The app must fail safely and clearly when evidence quality cannot meet the project requirement.

## 33. Privacy Boundary

Movement collection occurs only for a legitimate active Search Session and project purpose.

Prototype should demonstrate that:

- no Search Session = no project movement capture;
- Pause follows defined non-contribution behaviour;
- Complete/Cancel stops capture;
- data is Assignment-scoped;
- Field Worker cannot retrieve another worker's raw data;
- normal management UI receives derived coverage rather than raw trails.

## 34. Security Boundary

The prototype must preserve production architectural principles even though it is a spike:

```text
Android Client
   -> Firebase Auth/session
   -> Survey Guru API
   -> Server resource resolution
   -> Authorisation
   -> Validation/idempotency
   -> Persistence/processing
```

Do not grant broad direct Firestore access to make the prototype easier.

No Firebase Admin credentials or integration secrets may exist in the APK.

## 35. Environment

Prototype should use a dedicated development/test backend and dataset.

It must not write experimental Movement Events, coverage state or test photos into live customer production data.

Environment identity should be obvious in the test application.

## 36. Logging

Engineering logs should support diagnosis without leaking secrets.

Useful diagnostic fields:

- correlation/request ID;
- batch ID;
- Search Session ID;
- app/service lifecycle event;
- upload result;
- processing result;
- algorithm version;
- device/app version.

Do not log authentication tokens.

## 37. Prototype Result Report

Each formal test run should generate a structured result containing:

```text
Test Run ID
Date/time
Tester
Device / Android version
App build
Sampling profile
Assignment/test route
Expected ground truth
Observed coverage
False positives
False negatives
GPS gaps
Lifecycle interruptions
Battery result
Offline/sync result
Exceptions
Pass / Conditional / Fail
Notes
```

## 38. Prototype Acceptance Criteria

Prototype is successful when:

1. background movement survives normal screen lock;
2. app switching does not cause unacceptable evidence loss;
3. Premier Power Apps switching is operationally compatible;
4. offline capture persists through restart;
5. Movement Batches sync idempotently;
6. server rejects spoofed/out-of-scope batches;
7. authoritative coverage is server-derived;
8. side streets are not falsely marked covered;
9. parallel-road ambiguity is handled conservatively;
10. partial traversal remains partial where appropriate;
11. full-shift battery use is operationally acceptable;
12. gaps/failures are diagnosable;
13. worker can clearly see active/paused tracking state;
14. supported device limitations can be documented from evidence.

## 39. Stop / Reconsider Conditions

Pause the chosen implementation direction if:

- Android repeatedly kills the movement service on representative devices despite supported implementation patterns;
- the hybrid bridge/plugin model proves unstable;
- full-shift battery use is unacceptable;
- local persistence loses data under lifecycle stress;
- side-street false positives cannot be reduced to an acceptable operational level;
- framework constraints require unsafe credentials/direct database access;
- reliable behaviour requires excessive user configuration that cannot be operationally managed.

If the hybrid framework is the problem, move more of the movement subsystem into native Kotlin before reconsidering the overall Android-first decision.

## 40. Implementation Sequence

### Spike 1 — Shell & Identity

- Android hybrid shell;
- environment configuration;
- authentication;
- test Assignment package.

### Spike 2 — Native Movement

- Search Session controller;
- foreground/background service;
- local durable movement store;
- diagnostics.

### Spike 3 — Sync

- Movement batching;
- idempotent API ingestion;
- offline retry;
- sequence integrity.

### Spike 4 — Coverage

- test street network;
- map matching;
- StreetTraversal;
- coverage result;
- side-street test.

### Spike 5 — Lifecycle Stress

- lock screen;
- app switching;
- camera;
- Premier Power Apps;
- calls/messages;
- process death;
- connectivity loss.

### Spike 6 — Field Pilot

- representative devices;
- sampling profiles;
- battery comparison;
- full-shift test;
- acceptance report.

## 41. Decisions to Make From Prototype Evidence

After the spike TES can responsibly lock:

1. hybrid framework choice;
2. whether custom Kotlin location plugin is required;
3. supported Android baseline/window;
4. device recommendations/restrictions;
5. movement sampling policy;
6. batch size/frequency;
7. local retention policy;
8. battery thresholds;
9. Search Session pause/Visit movement behaviour;
10. production coverage confidence/threshold parameters;
11. private distribution/update mechanism;
12. whether any MDM/device-management requirement is justified.

## 42. Locked Prototype Decisions v1.0

1. Build the Movement Reliability Prototype before the full field application.
2. Android is the only mobile platform in this prototype.
3. Capacitor is the preferred first hybrid candidate, subject to prototype evidence.
4. Native Kotlin capability may be introduced behind the hybrid bridge where reliability requires it.
5. Search Session is the movement-capture boundary.
6. Movement Events are evidence, not coverage truth.
7. Movement is durably stored locally before upload.
8. Upload uses idempotent Movement Batches.
9. Server performs authorisation, validation, map matching and authoritative coverage derivation.
10. Multiple sampling profiles will be measured before production policy is locked.
11. Side-street and parallel-road false-positive tests are mandatory.
12. App switching to Premier Power Apps is a mandatory test.
13. Screen-lock/background operation is mandatory.
14. Full-shift battery/reliability testing is mandatory.
15. Prototype uses non-production data/environment.
16. No broad direct Firestore access is introduced for convenience.
17. Raw GPS may be visible in engineering diagnostics but does not become normal product UI.
18. Production framework/device/sampling decisions are evidence-driven.

## 43. Follow-On Artefacts

After the prototype results are available, update the materially affected living documents:

- Mobile Capability & Distribution ADR;
- Coverage Model Specification;
- Field Capture & Offline Workflow Specification;
- MVP Persistence Specification;
- API & Authorisation Specification if the measured contract needs adjustment;
- Screen & Navigation Architecture;
- Taskraft/TES Technology Standard where a reusable mobile engineering standard emerges.

A formal **Movement Reliability Pilot Report** should be committed with the measured test results before the complete production field shell is treated as technically proven.

---

## Living Documentation Rule

This technical design is a living TES engineering document. Material discoveries during Android implementation, movement testing, battery testing, app-switch testing, map matching or field piloting must be version-controlled here and propagated to other affected Survey Guru/TES specifications.