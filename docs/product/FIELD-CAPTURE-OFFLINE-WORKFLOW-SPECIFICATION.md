# Survey Guru Field Capture & Offline Workflow Specification v1.0

**Product Owner:** TES — Task Expert Systems  
**Operational / Field Partner:** Taskraft (Pty) Ltd  
**Status:** MVP Workflow Baseline / Living Document  
**Version:** 1.0  
**Date:** 9 September 2026

## 1. Purpose

This document defines how a Survey Guru Field Worker executes a real field assignment from mobile preparation through search, outlet capture, live street coverage, offline operation, submission, synchronisation, correction and completion.

It translates the MVP Functional Specification, Coverage Architecture and Coverage Model into the behaviour of the Field Worker PWA.

The core objective is:

> **The surveyor must be able to complete the assignment even when connectivity is unreliable, while Survey Guru continuously preserves outlet data, evidence and credible geographic search coverage.**

## 2. Locked Field Experience

The Field Worker must not operate from a questionnaire alone.

The primary experience is:

```text
TODAY
  |
ASSIGNMENT
  |
LIVE MAP
  |
SEARCH STREETS / AREA
  |
DISCOVER OR VERIFY OUTLET
  |
CAPTURE VISIT
  |
RETURN TO LIVE MAP
  |
COMPLETE REMAINING COVERAGE
  |
SYNC / SUBMIT
```

The map and the survey work together throughout the day.

## 3. Primary Mobile Navigation

```text
Today | Assignments | Map | Sync
```

Secondary functions such as Profile, Help and Settings are available without competing with the core field workflow.

## 4. Field Worker Today Screen

The Today screen should answer:

1. What must I do today?
2. Which assignment should I work on now?
3. How much have I completed?
4. Are there corrections requiring attention?
5. Is anything waiting to sync?

Suggested cards:

```text
CURRENT ASSIGNMENT
Mahikeng Zone 04
Street coverage: 64%
Outlets captured: 18
Outstanding streets: 23
[ CONTINUE ]

NEEDS ATTENTION
2 returned visits
1 sync problem

TODAY
Assignments: 2
Visits: 18
New outlets: 7
```

## 5. Assignment Download / Preparation

Before field work, Survey Guru prepares the minimum authorised offline package.

It may include:

- assignment ID and instructions;
- project/zone boundary;
- relevant street/path geometry;
- current server coverage state;
- relevant H3/area coverage state;
- survey definition/version;
- authorised known/seed outlets;
- duplicate-check reference subset where appropriate;
- product/answer option reference data;
- required integration configuration where applicable;
- coverage policy/version;
- local map data/cache permitted by provider licensing;
- sync/version tokens.

The device must not download unrelated workspace/client data or the complete TES outlet universe.

## 6. Assignment Readiness Check

Before Start, show operational readiness:

```text
Survey                 Ready
Assignment map         Ready
Known outlets          Ready
Coverage data          Ready
Offline package        Ready
Location permission    Ready / Action needed
Camera permission      Ready / Action needed
Pending sync           None / Warning
```

A worker should know before leaving connectivity whether the assignment can operate offline.

## 7. Starting an Assignment

Worker selects **Start Assignment**.

The app:

1. confirms authorised assignment;
2. creates/resumes a Search Session;
3. loads the Live Coverage Map;
4. activates project-scoped movement evidence collection according to policy;
5. records local start state;
6. synchronises start event immediately if online or queues it if offline.

Starting an assignment does not grant new access; API authorisation remains authoritative.

## 8. Search Session States

```text
READY
  |
ACTIVE_SEARCH
  |----> VISIT_IN_PROGRESS ---->
  |
  |----> PAUSED ------------->
  |
COMPLETED
```

`CANCELLED` is available for abandoned/invalid sessions.

Coverage evidence normally contributes only while policy permits, primarily `ACTIVE_SEARCH` and any explicitly permitted visit-related movement.

## 9. Pause Behaviour

The worker can pause search for lunch, transport, personal break or operational interruption.

While paused:

- new movement does not normally contribute to coverage;
- assignment remains available;
- visit capture may be blocked or require resuming, depending on workflow;
- existing offline data remains safe.

The app should make the tracking/search state obvious.

## 10. Live Street Coverage Map

This is a first-class MVP field screen.

It must show, within authorised assignment scope:

- worker current position;
- assignment/zone boundary;
- covered street/path portions or segments;
- partially covered streets;
- uncovered streets;
- known outlets;
- newly captured outlets where useful;
- selected target/navigation point;
- relevant area/H3 status in hybrid/unmapped geography;
- current overall progress;
- sync/offline indicator.

The map must let the worker answer immediately:

> **Where have I already searched and what have I missed?**

## 11. Map Visual Semantics

Colour may be used, but never alone.

Each coverage state should also differ through line style, pattern, label/icon or other accessible treatment.

Conceptual legend:

```text
COVERED             solid / completed treatment
PARTIAL             distinct partial treatment
UNCOVERED           outstanding treatment
LOCAL PENDING       provisional / unsynced treatment
KNOWN OUTLET        outlet marker
NEW OUTLET          new marker
YOU                 current-position marker
```

Exact visual design belongs in Screen & Navigation Architecture/UI implementation.

## 12. Live Coverage Progress

As the worker walks valid street geometry:

```text
UNCOVERED
   -> PARTIAL
   -> COVERED
```

Local state may update immediately for responsiveness.

The device must not claim `VERIFIED`; verification is server/authorised workflow state.

## 13. Provisional Local Coverage

Offline/local coverage is explicitly provisional.

Conceptual local state:

```text
serverCoverage
+ locally supported pending traversal
= localDisplayCoverage
```

The UI may show a pending marker when a result has not yet been reconciled with the server.

## 14. Server Reconciliation

When connectivity returns, the server:

1. authenticates worker;
2. resolves assignment/resource scope;
3. validates movement batches;
4. applies idempotency;
5. performs authoritative map matching;
6. derives traversal union;
7. recalculates street/area coverage;
8. stores authoritative state/version;
9. returns reconciliation result.

The phone then replaces provisional state with authoritative state.

## 15. Coverage Reconciliation Difference

If local display showed a street complete but server evidence supports only partial coverage, the app must not silently remove completion.

Example:

> **Street coverage needs more walking. GPS evidence confirmed 68% of this street.**

The worker can then return to the outstanding portion.

## 16. Current Position & GPS Quality

The map should show current location and, where useful, a simple GPS-quality state.

Avoid technical noise such as raw satellite diagnostics unless troubleshooting is enabled.

Example:

```text
Location: Good
Location: Weak — move into open area
Location unavailable — coverage recording paused
```

Poor GPS must not falsely award coverage.

## 17. Movement Sampling

Movement sampling follows the active Coverage Policy.

The field app must support configurable/adaptive collection rather than embedding one permanent interval.

Factors may include:

- time since previous sample;
- distance moved;
- GPS quality;
- battery state;
- walking/vehicle mode;
- active search/visit state.

The policy/version is recorded with evidence.

## 18. Side-Street Protection in UX

A worker passing the entrance of an uncovered side street should continue to see that street as outstanding.

This visual behaviour is important: the app should encourage the worker to enter/search it rather than giving the impression that proximity completed it.

## 19. Partial Street Behaviour

If a worker turns back halfway, the map should preserve partial completion.

Where geometry-level coverage is available, show the completed portion and outstanding portion.

Where MVP initially uses segment-level state, show `PARTIAL` and progress percentage/range where helpful.

## 20. Unmapped / Informal Area Workflow

Where source streets/paths are incomplete, the app switches or supplements the map with area/H3 coverage.

The worker still sees:

- assigned boundary;
- movement/search progress;
- covered/search evidence areas;
- remaining cells/areas;
- outlets.

The app must not imply that an area is complete simply because the provider map has no roads.

## 21. Discovery Trigger

While searching, the worker selects **Add / Discover Outlet**.

The app temporarily transitions:

```text
ACTIVE_SEARCH
   -> OUTLET IDENTITY GATE
   -> VISIT_IN_PROGRESS
   -> ACTIVE_SEARCH
```

Movement/search context is preserved.

## 22. Critical Store Identity Gate

Before creating a new outlet, capture enough information to check identity.

Minimum initial inputs:

- current GPS/location;
- store/outlet name where known;
- project/branch context;
- optional client reference/phone/address signals.

The app requests nearby candidates from authorised local cache/server logic.

Possible result:

```text
STRONG MATCH
POSSIBLE MATCH
NO LIKELY MATCH
```

The worker either selects existing, confirms uncertain candidate through permitted workflow, or creates a new candidate.

**Survey Guru never silently merges outlets.**

## 23. Offline Duplicate Check

When offline, duplicate detection uses the authorised locally cached reference subset.

If confidence cannot be established offline:

- allow capture where project policy permits;
- mark identity as pending server duplicate check;
- never silently merge;
- run authoritative matching during sync;
- route uncertain results to QA.

## 24. Outlet Creation

New candidate captures may include:

- temporary/local stable ID;
- name;
- GPS;
- GPS accuracy;
- storefront photo;
- outlet classification fields;
- worker/session/project provenance;
- local timestamp;
- sync state.

Client-generated IDs must be globally collision-resistant and become idempotent references during sync.

## 25. Visit Start

Once outlet identity is resolved sufficiently, the worker starts the Visit.

The app loads the immutable Survey Version assigned to the project/visit.

Visit status locally progresses:

```text
STARTED
CAPTURING
READY_TO_SUBMIT
SUBMITTED_LOCAL / PENDING_SYNC
SUBMITTED_SERVER
```

Server domain states remain authoritative.

## 26. Survey Section Experience

Survey sections should support quick mobile capture with:

- clear progress;
- required-field indicators;
- conditional questions;
- camera-first evidence;
- numeric/choice controls suited to field use;
- minimal typing;
- back/next without losing answers;
- autosave locally.

## 27. Local Autosave

Every meaningful answer/evidence change should persist locally quickly enough to survive:

- accidental app close;
- browser refresh/PWA restart;
- phone lock;
- temporary OS suspension;
- loss of network.

The worker should not need to press Save after every question.

## 28. Answer Validation

Validation occurs at two layers.

### Device / UX Validation
Immediate checks for required fields, formats, ranges and obvious contradictions.

### Server Validation
Authoritative policy validation, duplicate checks, security scope, cross-record rules, anomaly checks and integration rules.

Client validation improves UX but is never the security boundary.

## 29. GPS at Outlet

At required visit stages, capture location/accuracy/timestamp separately from general movement tracking.

A visit GPS point must not simply reuse an old movement sample without checking freshness/quality.

Worker may retry poor GPS.

Manual correction, where permitted, requires reason and audit.

## 30. Photo Evidence

Photo workflow:

```text
Capture
 -> Preview
 -> Accept / Retake
 -> Compress appropriately
 -> Store locally encrypted/protected as platform permits
 -> Queue upload
 -> Link evidence metadata
```

A visit can remain locally complete while photo upload is pending.

Evidence must never depend on a permanent public URL.

## 31. Repeatable Product / Price Rows

For Premier WTS and similar surveys, the Field Capture engine must support repeatable structured rows rather than flattening each possible product into fixed questions.

Examples:

```text
Product Sales Row
Brand
Product
Daily Sales
```

```text
Price Row
Brand
Product
White/Brown
Product Type
Selling Price
Cost Price
```

Rows support add/edit/delete before submission and stable row IDs for sync/integration idempotency.

## 32. Visit Review

Before submission show:

- outlet identity;
- section completion;
- required unanswered items;
- GPS state;
- photo/evidence state;
- validation warnings;
- duplicate warning;
- integration-required fields;
- offline status.

The worker selects **Submit Visit** only when blocking requirements are satisfied.

## 33. Offline Submission

When offline, Submit means:

> **Complete locally and queue for authoritative server submission.**

The UI must not falsely say the server has accepted it.

Recommended state wording:

```text
Saved on device — waiting to sync
```

Once server accepts:

```text
Survey Guru: Accepted / Submitted
```

Exact accepted-vs-QA terminology follows project workflow.

## 34. Return to Search

After local/server submission, the app returns the worker to the Live Coverage Map at the previous geographic context.

The worker should immediately see:

- newly captured outlet;
- current coverage;
- remaining streets/area;
- next outstanding geography.

This avoids repeatedly returning to menus.

## 35. Known Outlet Verification

For an existing outlet marker, the worker selects it and sees permitted identity/context before starting the assigned survey/verification.

The app must distinguish:

```text
Known outlet — not visited this project
Visited — pending sync
Submitted
Accepted
Returned for correction
```

## 36. Duplicate Visit Protection

Before starting/submitting, check whether the outlet has already been surveyed for the relevant project/period/purpose.

Possible outcomes:

- proceed as first visit;
- legitimate revisit/resurvey;
- correction workflow;
- possible duplicate visit — block/warn/QA according to policy.

Each Visit has an immutable Survey Guru ID.

## 37. Sync Centre

The Sync screen should explain state without technical queue jargon.

Suggested groups:

```text
SYNCED
12 visits
184 coverage updates

WAITING TO SYNC
2 visits
7 photos
1 movement batch

NEEDS ATTENTION
1 visit rejected by server validation
```

## 38. Sync Dependency Order

Dependencies matter.

Conceptually:

```text
Assignment/Search Session context
        |
Outlet identity/candidate
        |
Visit + responses
        |
Evidence uploads
        |
Movement/coverage batches
        |
Integration jobs
```

Actual implementation may parallelise safe operations, but dependent references must remain consistent.

## 39. Idempotent Sync

Every syncable resource/batch uses stable IDs/idempotency keys.

Retrying after timeout must not create:

- duplicate outlet;
- duplicate visit;
- duplicate response;
- duplicate photo metadata;
- duplicated traversal distance;
- duplicate Premier submission.

## 40. Conflict Categories

Possible conflicts include:

```text
SERVER_RESOURCE_CHANGED
ASSIGNMENT_REASSIGNED
OUTLET_MATCH_FOUND
SURVEY_VERSION_INVALID
VISIT_ALREADY_SUBMITTED
COVERAGE_RECONCILED_DIFFERENTLY
EVIDENCE_UPLOAD_FAILED
PERMISSION_REVOKED
PROJECT_CLOSED
```

The app handles each explicitly rather than generic "sync failed" where possible.

## 41. Assignment Reassigned While Offline

A worker may continue offline after the assignment was reassigned centrally.

On reconnect, the server must not blindly accept unauthorised post-reassignment work.

The server evaluates timestamps, assignment history and policy.

Possible outcomes:

- accept evidence captured while assignment was still valid;
- accept but flag for review;
- reject later activity;
- preserve local data for support/appeal without promoting it to authoritative project data.

## 42. Permission Revoked While Offline

Offline access is time/scoped and cannot guarantee instantaneous revocation.

On next server interaction:

- token/context is revalidated;
- revoked user cannot fetch new protected data;
- queued writes are evaluated individually;
- local protected cache follows configured expiry/removal policy.

Offline packages should therefore be minimal and time-bounded where practical.

## 43. Survey Version Changes

Published survey versions are immutable.

An active offline visit remains associated with the version it started under unless an explicit migration/restart rule applies.

New assignments/visits receive the newly activated version according to project policy.

Do not silently transform captured answers into a different questionnaire version.

## 44. Corrections Workflow

If QA returns a Visit:

```text
Returned for Correction
       |
Worker Today / Needs Attention
       |
Open Visit
       |
Affected section highlighted
       |
Correct permitted fields/evidence
       |
Review
       |
Resubmit
```

Only permitted fields reopen.

Original submitted values/history remain auditable.

## 45. Correction Offline Behaviour

Returned corrections may be downloaded into the authorised offline package.

The worker can correct offline where dependencies are available, then queue resubmission.

## 46. Completing an Assignment

Worker selects **Finish / Review Assignment**.

The app checks:

- required outlets/tasks;
- uncovered streets;
- partially covered streets;
- unresolved local visits;
- pending required evidence;
- blocking sync errors;
- project-specific completion policy.

For exhaustive coverage, outstanding required streets prevent normal completion unless an authorised exception/closure path exists.

## 47. Assignment Completion Summary

Example:

```text
Mahikeng Zone 04

Street network searched: 94.7%
Covered: 18.4 km
Outstanding: 1.0 km
Partial streets: 3
Outlets visited: 42
New outlets: 11
Searched-zero-found units: 8
Pending sync: 0

[ VIEW OUTSTANDING ]
[ COMPLETE ASSIGNMENT ]
```

## 48. View Outstanding

This is a key field action.

The app zooms/highlights remaining required street portions/cells so the worker can finish gaps before leaving the area.

This should reduce expensive return visits.

## 49. Show Me Where to Go Next

MVP may support deterministic guidance when reliable.

Action:

**SHOW ME WHERE TO GO NEXT**

Returns an authorised outstanding street/area based on coverage gap, distance, project priority and permitted historical/current outlet intelligence.

The recommendation must explain itself briefly and cannot expand assignment authority.

## 50. Navigation

Survey Guru may hand a selected destination to an approved navigation provider or use in-app map guidance where appropriate.

Navigation and coverage are separate concerns: a navigation route does not itself prove search coverage.

## 51. Battery Management

Field use may last a full working day.

The PWA/mobile architecture should minimise battery drain through adaptive GPS sampling, avoiding unnecessary redraws/network calls, efficient offline storage and pausing collection when search is paused/completed.

Battery optimisation must not silently make coverage unreliable; degraded collection should be visible/flagged.

## 52. Device Storage Management

Offline storage should track approximate local usage and prevent avoidable failures.

Large contributors include photos, map/cache data and unsynced movement.

The app should warn before critical storage shortage and prioritise safe sync/cleanup of already-confirmed data.

Never delete unsynced field evidence merely to free space without explicit safe policy.

## 53. Connectivity States

The app should distinguish practical states such as:

```text
ONLINE
WEAK / INTERMITTENT
OFFLINE
SYNCING
SYNC ATTENTION REQUIRED
```

The field worker should not need to understand network protocol details.

## 54. Background / App Suspension

PWA/browser/mobile OS constraints can interrupt background execution.

The workflow must not assume continuous foreground JavaScript execution.

Implementation must test:

- screen locked;
- browser backgrounded;
- PWA suspended;
- Android battery optimisation;
- OS process restart.

Where platform limitations prevent reliable background tracking, product/technology decisions may require a native wrapper or companion capability. This is an implementation gate, not something to discover after rollout.

## 55. Critical Technical Validation — PWA Location Reliability

Before locking the production mobile shell, TES must run a proof-of-capability on target Android devices to determine whether the chosen PWA/browser approach can reliably collect the movement evidence needed while workers naturally use/lock/background their phones.

Test at minimum:

- foreground map open;
- screen locked;
- switching to camera;
- switching to Premier Power Apps where applicable;
- switching to navigation app;
- temporary phone call/message interruption;
- browser/PWA backgrounded;
- low-power mode;
- one-hour and full-shift sessions.

If PWA limitations materially compromise credible coverage, Survey Guru should adopt an appropriate native/hybrid mobile capability rather than weakening the coverage promise.

## 56. Premier WTS POC Interaction

For the Premier integration POC, a worker may switch between Survey Guru and an authorised Premier Power Apps session while the adapter/interface automation operates.

Coverage/search evidence must not falsely stop or create gaps merely because the worker temporarily changes application context for legitimate workflow steps.

This must be included in the mobile capability test.

## 57. Premier Submission Status

Survey Guru and Premier status remain independent:

```text
Survey Guru: Accepted
Premier WTS: Synced
```

or:

```text
Survey Guru: Accepted
Premier WTS: Pending retry
```

or:

```text
Survey Guru: Accepted
Premier WTS: Action required
```

or:

```text
Survey Guru: Accepted
Premier WTS: Interface update required
```

Premier failure never destroys the Survey Guru Visit.

## 58. Final Premier Submit Surveys Step

Where the adapter uses Premier WTS v2.006 workflow, a successful client sync is not assumed merely because individual WTS/GT Price forms were populated.

The adapter must complete/confirm the final staged **Submit Surveys** action and resulting success state before marking `Premier WTS: Synced`.

## 59. Security Boundary

The field UI is never the authority.

The backend independently authorises every protected read/write based on identity, workspace, role/permission, project, assignment/resource scope and data-right classification.

Manipulating local storage, route parameters, hidden controls or request IDs must not expand access.

## 60. Local Data Protection

Offline data may contain client and movement information.

Implementation must use platform-appropriate protections, minimise cached data, avoid secrets in client bundles, avoid persistent reusable third-party bearer tokens, expire stale offline packages where practical and clear protected local data on sign-out/revocation according to policy.

## 61. Authentication Offline

Offline work may continue for a bounded period after successful authenticated preparation, subject to project/security policy.

The app must not invent new permissions offline.

Server sync always revalidates current identity/authority.

## 62. Audit Events

Important events may include:

- assignment downloaded;
- search started/paused/completed;
- offline package prepared;
- visit started/submitted/resubmitted;
- outlet candidate created;
- duplicate decision;
- manual GPS correction;
- sync conflict;
- coverage reconciliation exception;
- assignment completion attempt with gaps;
- integration submission/retry.

Raw high-frequency movement samples should not each become heavyweight audit events; they remain operational evidence under appropriate storage policy.

## 63. Field Worker Privacy UX

The app should clearly indicate when active field-search movement is being collected for coverage.

The worker should be able to pause according to operational policy.

Avoid ambiguous always-on tracking behaviour.

Derived coverage should be the default management/client view rather than exposing raw movement unnecessarily.

## 64. Error Recovery Principle

The worker's captured work should survive recoverable failures.

Examples:

- network timeout -> queue/retry;
- photo upload failure -> keep local photo and retry;
- server unavailable -> retain local submission;
- Premier unavailable -> SG accepted, integration pending;
- map-matching uncertainty -> partial/needs more coverage, preserve evidence;
- app restart -> restore local assignment/visit state.

## 65. User-Facing Error Language

Errors should tell the worker what to do.

Preferred:

> **Photo saved on your phone. It will upload when your connection improves.**

> **This street still needs more coverage. Continue further along the street.**

> **This visit is saved. Survey Guru will retry submission automatically.**

Avoid raw backend error codes unless support/debug detail is explicitly opened.

## 66. Data Loss Prevention Tests

Before field release test:

- kill app during question capture;
- kill app during photo capture;
- lose network during Submit;
- duplicate Submit tap;
- phone restart with unsynced visit;
- storage pressure;
- expired authentication;
- assignment reassignment;
- server timeout after write succeeds;
- evidence upload succeeds but acknowledgement is lost;
- movement batch retries;
- Premier sync fails after Survey Guru acceptance.

No test should produce silent duplicate records or silent loss of captured work.

## 67. Field Pilot Operational Test

Pilot with real surveyors, not only developers.

Observe:

- can worker understand covered vs outstanding streets?
- do they notice missed side streets?
- does map help rather than distract?
- how often is GPS weak?
- battery use over full shift;
- offline behaviour;
- how often workers switch apps;
- camera workflow speed;
- duplicate-check usefulness;
- correction comprehension;
- time required per outlet;
- sync reliability at end of day.

## 68. MVP Acceptance Scenario

A successful field-day scenario:

1. worker signs in while connected;
2. downloads authorised assignment;
3. readiness check passes;
4. worker starts assignment;
5. map shows all assigned outstanding streets;
6. worker begins walking;
7. streets progressively change to partial/covered;
8. crossing a side street does not mark it complete;
9. connectivity is lost;
10. map, movement evidence and survey continue offline;
11. worker discovers an outlet;
12. offline identity check runs;
13. worker captures GPS, answers, product rows and photos;
14. visit is submitted locally;
15. worker returns directly to map;
16. worker completes more streets;
17. app is backgrounded/locked and behaves according to validated mobile capability;
18. connectivity returns;
19. queued visits/evidence/movement sync idempotently;
20. server reconciles coverage;
21. uncertain duplicate is sent to QA if required;
22. Survey Guru visit remains safe even if Premier sync is pending;
23. worker selects View Outstanding;
24. remaining streets are highlighted;
25. worker closes gaps;
26. completion summary shows outlet and geographic result separately;
27. supervisor sees consistent authoritative progress.

## 69. Locked Workflow Decisions

1. The field workflow is map-and-assignment centric, not questionnaire centric.
2. Live Street Coverage Map is continuously accessible during assignment execution.
3. Search Session state controls whether movement contributes to coverage.
4. Worker can pause legitimate tracking/search collection.
5. Offline operation is a core requirement, not graceful degradation.
6. Assignment packages contain only minimum authorised data.
7. Local coverage may be optimistic/provisional; server reconciliation is authoritative.
8. Reconciliation differences are explained to the worker.
9. Store identity check occurs before creating a new permanent outlet candidate.
10. Offline duplicate checking is provisional where the server cannot be reached.
11. Visits autosave locally.
12. Offline Submit means queued locally, not falsely server-accepted.
13. After a visit, the worker returns directly to the map/search context.
14. Repeatable product/price rows are supported.
15. Sync is idempotent and dependency-aware.
16. Reassignment/revocation conflicts are resolved server-side, not trusted from stale local state.
17. Published survey versions remain immutable through offline workflows.
18. Corrections reopen only permitted fields/evidence.
19. View Outstanding is a first-class end-of-assignment action.
20. Navigation does not equal coverage evidence.
21. Battery/storage constraints are operational design requirements.
22. PWA/background location reliability is a production architecture gate.
23. If PWA limitations undermine coverage credibility, TES will use a suitable native/hybrid capability rather than weaken the product requirement.
24. Premier sync status remains separate from Survey Guru acceptance.
25. Final Premier `Submit Surveys` confirmation is required before marking Premier synced.
26. Raw movement access is more restricted than derived coverage.
27. Field movement collection is project/work scoped and visibly active to the worker.
28. Recoverable technical failures must preserve captured work.

## 70. Required Cross-Document Updates

This specification materially affects:

- `SCREEN-NAVIGATION-ARCHITECTURE.md`
- `DATA-MODEL-ENTITY-ARCHITECTURE.md`
- `MVP-PERSISTENCE-SPECIFICATION.md`
- `API-AUTHORISATION-SPECIFICATION.md`
- `THIRD-PARTY-INTEGRATION-PREMIER.md`
- future `QA-VALIDATION-RULES-SPECIFICATION.md`
- future mobile/PWA technology implementation decision record.

The most important new architecture gate is the real-device validation of background/PWA location behaviour before production mobile technology is locked.

---

## Living Documentation Rule

This is a living TES specification. Material discoveries or decisions affecting field capture, offline operation, mobile technology, GPS/coverage behaviour, outlet identity, evidence, sync, privacy, security, corrections or third-party integration must be version-controlled here and in other materially affected Survey Guru/TES documents rather than remaining only in chat or informal notes.
