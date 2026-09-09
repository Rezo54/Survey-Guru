# ADR — Survey Guru Mobile Capability & Distribution v1.0

**Product Owner:** TES — Task Expert Systems  
**Operational / Field Partner:** Taskraft (Pty) Ltd  
**Status:** Approved Architecture Decision / Living Document  
**Version:** 1.0  
**Date:** 9 September 2026

## 1. Decision

Survey Guru MVP will use an **Android-first native/hybrid field application**.

The management application remains web-based.

**iOS is explicitly outside MVP scope** and may be introduced later when customer/user demand justifies it. The Survey Guru API, domain model, persistence contracts and field-workflow contracts must remain platform-neutral enough to support a future iOS client without redesigning the backend.

Initial Android distribution should favour a **controlled/private operational distribution model** rather than making public Play Store availability a prerequisite for MVP deployment.

> **Reliable field evidence is more important than maintaining a pure-PWA implementation.**

## 2. Context

Live Street Coverage is now a first-class Survey Guru MVP capability. Survey Guru must reliably determine where field teams have searched, which streets remain outstanding and whether coverage evidence is sufficient.

The field application must therefore remain operational while a surveyor:

- walks/drives an assigned area;
- locks the phone or places it in a pocket;
- opens the camera;
- captures evidence;
- opens Premier Power Apps;
- opens a navigation application;
- receives calls/messages;
- moves between foreground/background applications;
- experiences weak or absent connectivity;
- reconnects and synchronises later;
- operates for a substantial part or all of a field shift.

A browser/PWA-only architecture cannot be assumed to satisfy these requirements without evidence.

## 3. Business Rationale

The initial Survey Guru field population is expected to be predominantly Android-based. Supporting iOS in the MVP would add development, testing, signing, deployment, device-behaviour and release-management complexity without a demonstrated immediate field requirement.

Android-first therefore provides:

1. focus on the dominant field-agent device platform;
2. a smaller initial device/OS test matrix;
3. earlier validation of background location and battery behaviour;
4. simpler controlled field rollout;
5. reduced MVP complexity;
6. no backend lock-in because platform-specific capabilities remain behind the mobile client boundary.

## 4. Target Product Architecture

```text
                    SURVEY GURU
                         |
          +--------------+--------------+
          |                             |
          v                             v
  MANAGEMENT WEB APP             ANDROID FIELD APP
   Next.js / Browser              Native/Hybrid Shell
          |                             |
          +--------------+--------------+
                         |
                         v
                  Survey Guru API
                         |
              Authorisation / Domain
                         |
          Data / Storage / Coverage
```

The Android field application may reuse web/TypeScript application logic where appropriate, but native capability is used wherever field reliability requires it.

## 5. Hybrid Direction

The preferred implementation direction is a hybrid mobile shell around reusable TypeScript/web UI/domain-client code, with native Android capability exposed through controlled plugins/modules.

Candidate technologies such as Capacitor should be evaluated during implementation, but this ADR deliberately locks the **capability architecture**, not a specific framework before technical validation.

Framework choice must not become a permanent Survey Guru domain dependency.

## 6. Native Capabilities Required

The Android field layer must support, subject to Android platform rules and user-granted permissions:

- reliable foreground/background location collection for active Search Sessions;
- appropriate Android foreground-service behaviour for ongoing field search;
- camera/photo capture;
- encrypted or appropriately protected local persistence;
- durable offline operation queue;
- background/retry-capable synchronisation;
- network/connectivity awareness;
- battery/power-state awareness where operationally useful;
- application lifecycle recovery;
- safe app switching;
- secure credential/session storage;
- device/app version diagnostics;
- notification capability where operationally useful.

## 7. Background Location Principle

Background movement collection is permitted only for a legitimate active Survey Guru field purpose.

Conceptual lifecycle:

```text
Assignment Ready
      |
Start Assignment
      |
Search Session ACTIVE
      |
Native Location Service Active
      |
Movement Evidence Captured
      |
Pause / Visit / Resume
      |
Complete Search Session
      |
Location Service Stops
```

The application must not implement unrestricted always-on worker tracking.

## 8. Search Session & Tracking UX

When field search is active, the worker must be able to understand that location is being used for coverage calculation.

The UI should expose:

```text
Searching this assignment
Movement is being used to calculate project coverage.

[Pause Search]
```

The worker can see when search is active, paused or complete.

Native background capability does not remove the API rule that GPS samples are evidence rather than authoritative coverage truth.

## 9. Coverage Authority Remains Server-Side

The Android application may calculate/display provisional local progress for usability.

It cannot authoritatively set:

- `COVERED`;
- `VERIFIED`;
- final street traversal percentage;
- final coverage confidence;
- searched-zero-found;
- QA outcome.

Movement Batches are uploaded to the Survey Guru API and authoritative coverage is derived/reconciled server-side.

## 10. Offline Architecture

The Android client must maintain a durable local store for the minimum authorised Assignment package and unsynchronised work.

Offline resources include, where required:

- Assignment;
- immutable Survey Version;
- project/zone boundary;
- relevant Street Segments;
- relevant Coverage Cells;
- current authorised coverage state;
- Coverage Policy/version;
- relevant known outlets/duplicate subset;
- Search Session state;
- Visits/Responses/Repeatable Rows;
- Evidence queue;
- Movement Batches;
- correction/revisit work;
- sync/idempotency metadata.

Offline capability does not mean unrestricted local caching of the TES Market Universe.

## 11. Local Data Protection

Sensitive local data must be protected according to platform capability and data classification.

At minimum:

- authentication secrets/tokens use secure platform storage;
- application data is private to the application sandbox;
- sensitive local databases/files use appropriate encryption/protection where required;
- debug logs do not contain tokens or unnecessary client-sensitive payloads;
- evidence files are not intentionally exposed to public/shared storage;
- logout/revocation/retention behaviour is defined;
- device-loss exposure is considered in the threat model.

## 12. App Switching Requirement

Survey Guru must be explicitly tested while switching between:

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

A normal application switch must not silently destroy an active Visit, pending Evidence, Search Session or unsynchronised Movement Batch.

## 13. Premier WTS Interaction

For the Premier WTS v2.006 proof of concept/fallback workflow, the surveyor may need Survey Guru and Premier Power Apps during the same field task.

The Android architecture must therefore tolerate application switching without losing Survey Guru state.

Survey Guru remains the canonical capture record. Premier WTS integration status remains independent.

## 14. Distribution Decision

MVP distribution should be operationally controlled/private where practical.

Public Google Play Store availability is **not a prerequisite** for Survey Guru MVP field deployment.

The exact distribution mechanism may evolve based on customer ownership of devices, MDM/enterprise-management capability, Android signing/update requirements and commercial rollout model.

The architecture must support controlled installation and controlled update management.

## 15. Public Play Store Later

A public Google Play release may be appropriate when:

- Survey Guru is commercially ready for broader customer adoption;
- self-service installation becomes valuable;
- release/support processes are mature;
- required privacy, permission and store-policy material is ready;
- field reliability has already been proven operationally.

Store publication is a commercial/distribution milestone, not a prerequisite for validating the product architecture.

## 16. iOS Decision

**iOS is deferred.**

No iPhone/iPad field client is required for MVP acceptance.

Future iOS introduction must not require redesign of:

- Survey Guru API contracts;
- authentication/authorisation model;
- Assignment package;
- Search Session model;
- Movement Batch contract;
- Visit/Response/Evidence model;
- offline sync contract;
- Coverage Engine;
- QA/integration workflows.

Platform-specific implementation belongs behind the mobile client boundary.

## 17. Device Support Strategy

TES/Taskraft should establish an initial supported Android device/OS matrix rather than claiming universal Android support immediately.

Field pilot devices should represent:

- lower/mid-range field hardware;
- likely Samsung/other commonly used Android devices;
- multiple Android versions within the intended support window;
- constrained memory/storage;
- different battery-optimisation behaviour;
- weak network conditions.

Exact supported models/versions are an implementation/pilot outcome, not invented in this ADR.

## 18. Battery & Sampling

Survey Guru must balance coverage evidence with battery life.

The application should not assume second-by-second high-accuracy GPS throughout a shift.

Sampling may adapt based on:

- Search Session state;
- movement state;
- GPS quality;
- speed;
- distance moved;
- device/battery state;
- project Coverage Policy.

The server Coverage Engine remains responsible for deciding whether accumulated evidence is sufficient.

## 19. Foreground Service UX

Where Android requires a foreground service/notification for active background location, Survey Guru must present a clear operational notification rather than disguising tracking.

Example intent:

```text
Survey Guru — Search active
Recording movement for Mahikeng WTS coverage.
```

The worker should be able to return to the active Assignment from the notification where practical.

## 20. Failure Recovery

The application must recover safely from:

- process termination;
- application restart;
- OS background restriction;
- device reboot where appropriate;
- network loss;
- failed upload;
- partially uploaded Evidence;
- interrupted Movement Batch submission;
- token/session expiry;
- server conflict;
- storage pressure;
- permission revocation.

Recovery must favour preserving legitimate unsynchronised field evidence without creating duplicate authoritative records.

## 21. Capability Test Matrix

Before production field rollout, test at minimum:

1. foreground walking for one hour;
2. screen locked while walking;
3. phone in pocket with screen off;
4. Survey Guru backgrounded;
5. camera capture during active Search Session;
6. repeated photo capture;
7. switch to Premier Power Apps and return;
8. remain in Premier Power Apps for a realistic capture interval;
9. switch to navigation/maps and return;
10. incoming/outgoing phone call;
11. messaging interruption;
12. weak GPS/urban obstruction;
13. GPS temporarily unavailable;
14. mobile data loss;
15. extended offline operation;
16. reconnection and backlog sync;
17. app process killed and restarted;
18. device lock/unlock cycles;
19. battery saver enabled;
20. low battery;
21. low storage;
22. permission revoked during work;
23. session/token expiry while offline;
24. duplicate Movement Batch retry;
25. partial Evidence upload retry;
26. Assignment reassigned while device offline;
27. full realistic field shift;
28. multiple consecutive field days;
29. local/server coverage reconciliation;
30. no false side-street completion caused by app lifecycle gaps.

## 22. Pilot Measurements

Capture during pilot:

- Movement Events/samples per worker/hour;
- Movement Batch size/frequency;
- GPS quality distribution;
- coverage-processing delay;
- battery consumption/hour and full shift;
- offline storage growth;
- evidence storage growth;
- sync backlog duration;
- application crashes/restarts;
- missed background intervals;
- false-positive/false-negative coverage cases;
- worker support incidents;
- Firestore/API/storage cost implications.

These results determine production sampling and supported-device policy.

## 23. Production Acceptance Gate

Android field architecture is acceptable when the pilot demonstrates that:

1. active Search Sessions remain reliably observable across realistic app lifecycle changes;
2. app switching does not lose Visits/evidence/search state;
3. screen lock does not create unacceptable coverage gaps;
4. offline work persists safely;
5. retries do not duplicate authoritative data;
6. battery consumption supports a realistic shift;
7. background-location behaviour is transparent to workers;
8. side streets are not falsely completed because of sampling/lifecycle artefacts;
9. server reconciliation remains authoritative;
10. device/OS support limits are documented.

## 24. Security Requirements

The mobile layer must preserve Survey Guru's existing security architecture:

- Firebase Authentication establishes identity only;
- Survey Guru API authorises business operations;
- local client role/scope values are not trusted;
- no Firebase Admin credentials on device;
- no production integration secrets embedded in the APK;
- no reusable Premier bearer-token extraction/storage strategy;
- evidence access remains authorised;
- Movement Batch ownership is server verified;
- offline sync is reauthorised/revalidated;
- client cannot set authoritative coverage/QA/integration state.

## 25. Build & Release Separation

Development, test/staging and production mobile builds must use separated backend/environment configuration.

Experimental builds must not accidentally point at production customer data.

Release signing credentials and production deployment authority must be protected separately from autonomous code-generation access.

Standing principle:

> **No autonomous agent receives simultaneous authority over code, production credentials and deployment.**

## 26. Consequences

### Positive

- credible Live Street Coverage becomes technically achievable;
- better offline reliability;
- robust camera/local storage integration;
- controlled Android-first test matrix;
- no unnecessary iOS MVP burden;
- future iOS remains possible through platform-neutral backend contracts.

### Costs / Risks

- Android build/signing/release pipeline is required;
- native/hybrid plugins increase technical surface area;
- background-location permissions and OS behaviour require ongoing testing;
- battery optimisation differs by manufacturer;
- mobile release management becomes a formal engineering responsibility;
- device support policy must be maintained.

These costs are accepted because reliable field evidence is a core product requirement.

## 27. Rejected Alternative — Pure PWA by Default

Rejected as the locked production assumption.

A PWA may still contribute reusable UI/application code, but TES will not weaken background-location, offline or coverage requirements merely to preserve a browser-only implementation.

## 28. Rejected Alternative — Android + iOS MVP

Rejected because current field demand does not justify the added implementation/test/release complexity.

iOS remains a future option.

## 29. Rejected Alternative — Public Store First

Rejected as an MVP prerequisite.

Initial objective is controlled operational validation. Public store distribution may follow commercial readiness.

## 30. Locked Decisions v1.0

1. Survey Guru field MVP is Android-first.
2. iOS is outside MVP scope.
3. Future iOS remains architecturally possible.
4. Field client uses native/hybrid capability rather than assuming pure PWA sufficiency.
5. Framework choice is not yet permanently locked.
6. Background location is required for active Search Sessions where Coverage Policy requires movement evidence.
7. Tracking is purpose-limited, visible and controllable.
8. Server remains authoritative for coverage.
9. Local coverage may be provisional only.
10. Offline persistence is mandatory.
11. App switching to Premier Power Apps/navigation/camera must be supported.
12. Public Google Play release is not required for MVP validation.
13. Controlled/private Android distribution is preferred initially where practical.
14. Supported Android devices/versions will be defined from field pilot evidence.
15. Battery/sampling policy will be field-tested rather than guessed.
16. Full-shift testing is mandatory.
17. Background/lock-screen/app-switch testing is mandatory.
18. Mobile client contains no production backend/admin credentials.
19. Environment separation applies to mobile builds.
20. Autonomous agents do not receive code + production credentials + deployment authority simultaneously.

## 31. Follow-On Work

1. Select and prototype the Android hybrid shell/framework.
2. Build a minimal **Movement Reliability Prototype** before the full field UI.
3. Establish target-device pilot matrix.
4. Test background GPS, app switching, offline persistence and battery behaviour.
5. Define Android signing and controlled distribution process.
6. Feed measured results back into Coverage Policy, Field Workflow and Persistence specifications.
7. Only then lock production sampling and device-support parameters.

The recommended first implementation spike is deliberately small:

```text
Login
 -> Download Test Assignment
 -> Start Search Session
 -> Background Location
 -> Lock / App Switch / Camera / Premier
 -> Stop Search Session
 -> Upload Movement Batch
 -> Server Map-Match
 -> Compare Expected vs Actual Coverage
```

This proves the hardest field capability before TES invests in the complete mobile application.

---

## Living Documentation Rule

This ADR is a living TES architecture decision. Material changes to supported mobile platforms, background-location strategy, distribution, offline capability, device support, signing/release or field privacy must be version-controlled here and reflected in other materially affected Survey Guru/TES documents.