# Survey Guru MVP Functional Specification v1.0

**Product Owner:** TES — Task Expert Systems  
**Operational / Field Partner:** Taskraft (Pty) Ltd  
**Status:** MVP Product Baseline / Living Document  
**Version:** 1.1  
**Updated:** 16 September 2026

## 1. Purpose

This document defines the first usable production version of Survey Guru.

The MVP must solve Taskraft's real field-survey workflow exceptionally well while creating the permanent foundations for TES market intelligence, the Coverage Engine and future integration with Fleetwize.

The MVP is not merely a digital questionnaire.

> **Survey Guru MVP is a field-survey operating system built around projects, geography, permanent outlet identity, assignments, visits, evidence, validation and coverage.**

The product must already begin answering three questions:

1. **What have we found?**
2. **Where have we actually searched?**
3. **Which streets/areas remain unsearched?**

Future versions add progressively stronger answers to:

4. **Where should we go next?**
5. **Where is the highest probability of valuable undiscovered outlets?**
6. **What should the client do?**

A core MVP principle is:

> **Survey Guru must know not only where stores are, but where field teams have searched, what remains unknown, and where the highest probability of valuable undiscovered outlets exists.**

The MVP must establish the coverage truth required for progressively stronger opportunity direction.

## 2. MVP Outcome

At the end of MVP development, Taskraft must be able to run a WTS/market-survey project from setup through final export without relying on spreadsheets as the operational system of record.

The system must support:

```text
Create Workspace / Project
        |
Define Survey
        |
Define Geography / Zones / Street Network
        |
Add Field Workers
        |
Create Assignments
        |
Field Workers Survey / Discover Outlets
        |
Live Street Coverage Map
        |
Capture GPS + Movement Evidence + Answers + Photos
        |
Validate Data + Coverage
        |
Track Covered / Partial / Uncovered Streets
        |
Correct Exceptions
        |
Accept Results
        |
Dashboard / Export / Report
```

MVP project success is measured on two dimensions:

1. **Outlet result** — outlets discovered, verified, surveyed and accepted.
2. **Geographic search completeness** — how much of the assigned street network/geography was actually searched.

## 3. MVP Product Principles

1. Mobile-first field experience.
2. Permanent outlet thinking from day one.
3. Survey visit is separate from outlet identity.
4. Geography, street coverage and coverage evidence are first-class.
5. **Live Street Coverage Map is a first-class MVP capability for Field Workers and Supervisors.**
6. Offline-capable field capture and coverage recording.
7. Real-time/near-real-time operational visibility.
8. Data quality moves toward the point of capture.
9. Human-in-the-loop for uncertain matching/QA.
10. Client data boundaries are explicit.
11. API/backend is the security authority.
12. MVP data structures must remain migration-ready for PostgreSQL/PostGIS/H3.
13. Coverage must distinguish unvisited, partially covered, searched-zero-found and searched-with-outlets.
14. Movement tracking exists for legitimate field-coverage evidence and is project/work scoped, not unrestricted employee surveillance.
15. Do not build intelligence theatre: show only metrics/confidence the system can support.

## 4. MVP Users

### TES Platform Administrator
Sets up platform-level organisations/workspaces and manages authorised system configuration.

### Workspace Administrator
Manages workspace membership, project access and authorised workspace configuration.

### Project Manager
Creates/configures projects, surveys, zones, field teams, assignments, progress and exports.

### Field Supervisor
Operational view of surveyor deployment, productivity, live street coverage and exceptions. May be represented initially through Project Manager permissions or a dedicated role if needed.

### Field Worker
Receives assignments, sees live covered/partial/uncovered streets, navigates target geography/outlets, discovers/captures outlets, completes surveys, uploads evidence and corrects returned work.

### QA / Validator
Reviews submitted visits, photographs, GPS, coverage evidence and validation flags; accepts or returns records for correction.

### Analyst
Views accepted/project data, maps, dashboards and authorised analytical exports.

### Client Viewer
Views authorised project progress, maps, accepted results and reports without Taskraft internal management controls.

## 5. Primary MVP Navigation

### Management Web Application
```text
Dashboard
Projects
Map / Coverage
Field Team
QA
Outlets
Reports / Exports
Administration
```
Navigation is permission-aware for UX, but backend authorisation remains independent.

### Field Worker PWA
```text
Today
Assignments
Map
Capture / Visit
Sync
Profile / Help
```
The field experience should be deliberately simpler than the management application.

## 6. Workspace Selection
Users with access to more than one workspace select an authorised workspace after login or through a workspace switcher. The application displays only workspaces returned by the authorised API. Switching workspace changes application context but does not itself grant permissions.

## 7. Management Home Dashboard
The home dashboard should answer: **What requires my attention right now?** MVP metrics may include active projects, today's submissions, outlets captured, QA backlog, active field workers, unsynchronised activity, projects behind trajectory, overall coverage, uncovered street segments and partially covered segments.

## 8. Project List
Display project name, client/workspace, geography/market, status, dates, expected outlet count, captured/accepted outlet or visit count, street/area coverage status, assigned field workers and progress indicator. Filters include status, client/workspace, geography, date range and project manager.

## 9. Project Creation Wizard
### Step 1 — Project Identity
Project name/code, client organisation, operating organisation, dates, expected outlet count and objective.
### Step 2 — Survey
Choose/create Survey Definition and select/publish version.
### Step 3 — Geography
Define/import project geography, operational zones and street-network context required for coverage.
### Step 4 — Field Team
Add eligible Field Workers.
### Step 5 — Assignment Strategy
Create geographic/outlet assignments.
### Step 6 — Review & Activate
Show configuration summary and validation errors before activation.

## 10. Project Overview
Recommended tabs:
```text
Overview
Map & Coverage
Assignments
Field Workers
Outlets
Visits
QA
Survey
Reports
Settings
```
Overview displays project status, target vs captured, accepted vs QA, expected vs actual, street/area coverage, field-worker activity, recent submissions, corrections and exceptions.

## 11. Survey Builder
Supported types include short/long text, integer/decimal, yes/no, single/multiple choice, date, phone, photo, GPS/location confirmation and optional signature. Configuration includes prompt, help, required state, section, sort order, options, numeric/text constraints, conditional visibility, evidence requirement and observation mapping key.

## 12. Survey Sections
Typical sections include Outlet Identity, Store Classification, Bread Category, Brand Availability, Competitor Activity, Equipment/Displays, Owner/Contact and Evidence.

## 13. Survey Versioning
Draft surveys can be edited. **Published versions are immutable.** Changes create a new version. Visits retain the exact version used.

## 14. Geography Setup
MVP geography supports project boundaries, operational zones, imported boundaries, centroid/bounds, map visualisation, assignment by zone and a usable street-network layer for coverage calculation. GeoJSON and/or KML/KMZ may be supported; CSV latitude/longitude is required for outlet/customer seed data. Professional GIS authoring may remain external initially.

## 15. Coverage Model — Area and Street
Coverage is operational data, not merely map presentation.

Survey Guru must support two complementary coverage views:

### Area / Cell Coverage
```text
Unvisited
In Progress
Searched
Verified
```

### Street Segment Coverage
```text
Uncovered
Partially Covered
Covered
Verified
```

A street segment must not be marked covered merely because a worker passed close to it or crossed its entrance. Coverage is derived from authorised traversal/search evidence and configurable rules such as distance travelled along the segment, proportion traversed, GPS quality, active assignment/search state and related capture evidence.

The exact completion threshold must be configurable and refined through field testing rather than hard-coded into product logic.

The model must preserve:

```text
UNVISITED
    !=
SEARCHED — ZERO OUTLETS FOUND
    !=
SEARCHED — OUTLETS FOUND
```

## 16. Field Worker Management
Project Manager can view/add/remove project workers, status, assigned zones/tasks, productivity, street-coverage contribution, corrections and permitted suspension. Field Workers need not be Taskraft employees.

## 17. Assignment Creation
Types include survey known outlet, discover outlets in zone, verify outlet, re-survey outlet, cover/search zone or street set, QA revisit and anomaly investigation. Assignments support worker, project, zone, optional outlet/street scope, schedule, priority and instructions.

## 18. Bulk Assignment
Support assigning zones/street groups/outlets to workers, distributing selected work and reassigning incomplete coverage. Initial allocation may be deterministic rather than AI-optimised.

## 19. Field Worker — Today Screen
Shows today's assignments, assigned zone/map, priority tasks, known outlets, discovery/coverage tasks, returned corrections, sync status, outlets completed and street/area coverage progress.

## 20. Live Street Coverage Map — Field Worker
**This is a first-class MVP capability, not a future analytics feature.**

The Field Worker map must allow the worker to see the assignment being completed geographically while working. It should show only authorised context, including:

- assignment boundary/zone;
- current location where permission granted;
- covered street segments;
- partially covered street segments;
- not-yet-covered street segments;
- known/assigned outlets;
- newly captured outlets where useful;
- selected navigation destination;
- own coverage progress;
- offline/sync state where relevant.

The worker must be able to look at the map and answer:

> **Which streets have I covered, and which streets do I still need to walk/search?**

The map should visually update as valid coverage evidence is recorded. Colour must not be the only status indicator.

Optional MVP map layers may include:
```text
My Coverage
Uncovered Streets
Known Stores
New Stores
Priority Areas (where deterministic evidence supports them)
Team Coverage (only where authorised)
```

Sophisticated predictive opportunity locations are not required for MVP, but the map/data model must support them later.

## 21. Start Assignment
Worker sees assignment type, instructions, zone/outlet/street scope, map, survey, outstanding work and offline state, then selects Start. Start event/time is recorded when possible and activates project-scoped coverage collection where configured.

## 22. Discover Outlet Workflow
Worker reaches an outlet and selects **Add / Discover Store**. This starts a draft Visit and Outlet Candidate workflow; it does **not** immediately create a captured or verified outlet.

The workflow is:

```text
Add / Discover Store
        |
Capture GPS, accuracy and timestamp
        |
Check nearby / possible duplicate outlets
        |
Select existing outlet or continue as a new candidate
        |
Complete the project's published questionnaire
        |
Capture required photographs and other evidence
        |
Review completeness and warnings
        |
Submit Visit
        |
Server validation / QA
        |
Captured candidate or verified existing outlet
```

A store counts as captured only after all project-required questions and evidence have been completed and the Visit has been submitted successfully. A saved draft or partial questionnaire does not count as a captured store.

Typical questionnaire content includes:

- store/trading name and outlet classification;
- owner or responsible-person name and permitted contact details;
- address/location confirmation;
- products, brands and SKUs stocked;
- pack sizes, selling prices and other project-required commercial observations;
- equipment, displays, competitor activity and availability;
- required storefront, interior, shelf, product or price photographs;
- project-specific questions, declarations and consent where applicable.

The exact questions come from the immutable published Survey Version. Survey Guru must not hard-code one universal questionnaire.

## 22.1 Fast Field Capture Without Reducing Evidence

Speed comes from reducing repeated effort, not skipping required questions. The PWA should provide:

- one-tap **Add Store** from the live map;
- automatic assignment, search-session, GPS, timestamp and worker context;
- duplicate checking before the worker completes the full questionnaire;
- prefilled known data when verifying an existing outlet;
- conditional questions that hide irrelevant sections;
- repeatable rows for products, pack sizes and prices;
- camera-first photo capture with preview and retake;
- automatic draft saving and offline continuation;
- clear section progress and a short final review;
- return to the live map immediately after successful submission.

## 22.2 Verify Existing Store

Verification opens the existing authorised outlet details and the project's required questionnaire. Stable details are prefilled, and the worker confirms or corrects them rather than recapturing everything.

Verification still requires fresh project evidence where configured, including current GPS, questionnaire answers, price/stock observations and photographs. Material identity or location changes require a reason and may be routed to QA. Client-side confirmation never bypasses server validation.

## 23. Duplicate / Existing Outlet Check
MVP duplicate prevention uses location/distance, normalised and historical names, client reference, workspace outlet, permitted Market Universe candidates and other authorised identity signals. The nearby-outlet search runs from GPS even when the newly entered store name differs completely from the database name.

The duplicate check should occur immediately after GPS and store-name capture so the worker does not complete a full questionnaire for an outlet that already exists. A same or near-identical location is a strong candidate signal, but it is not proof of the same outlet. The field workflow must allow:

- **Same outlet — name changed / rebranded:** retain the outlet identity, preserve the former name as an alias with history, capture the new name and fresh evidence, and route material changes according to QA policy.
- **New outlet replaced the previous outlet:** close/end-date the previous outlet where authorised and create a new candidate linked to the same premises/location history.
- **Different neighbouring or co-located outlet:** keep separate identities even where GPS coordinates overlap or are imprecise.
- **Unsure:** preserve both the new evidence and candidate matches, then send the identity decision to QA.

The app presents nearby candidate names, distance, last known photograph/date and permitted reference details so the worker can make an informed selection. It never silently overwrites a name, merges outlets or treats shared coordinates as conclusive identity.

## 24. Visit Capture
Displays outlet identity, GPS/accuracy, questionnaire sections, section progress, completion requirements, evidence, save/offline status and warnings. Captured data survives navigation between sections, application interruption and permitted offline operation.

A Visit remains a draft while required questionnaire answers or evidence are incomplete. Submission is blocked only by configured `BLOCK` validations; `WARN` and `FLAG_FOR_QA` follow project policy and remain visible in the evidence trail.

## 25. GPS Capture
At visit/coverage capture, record permitted latitude, longitude, accuracy and timestamp. Poor accuracy warns and allows retry. Device GPS and corrected/verified outlet location remain distinct. Manual overrides require reason/audit where enabled.

## 26. Photo Capture
Supports camera-first storefront/question evidence, preview, retake, upload/sync state and mobile-appropriate compression while preserving QA quality. Metadata anticipates future photo-quality intelligence.

## 27. Real-Time Capture Validation
Rules may include required fields/photos, GPS quality, duplicate candidate, format/range, visit duration, impossible movement, outside geography and inconsistent coverage evidence. Severity: `BLOCK`, `WARN`, `FLAG_FOR_QA`.

## 28. Visit Submission
Review required fields, evidence, GPS, warnings and sync state before Submit Visit. Submitted visits become read-only unless returned/reopened by authorised workflow.

## 29. Offline Operation
Core field work and street-coverage evidence must continue during connectivity loss. Minimum authorised offline context includes own assignments, survey version, relevant zone/outlet/street context, coverage state needed for the assignment, unsent responses/evidence and locally recorded traversal evidence. On reconnection, sync through the API and revalidate server-side.

## 30. Sync Centre
Shows `Synced`, `Pending`, `Failed / Needs Attention`, including visit/evidence/coverage sync without exposing technical queue complexity.

## 31. Field Worker Daily Progress
May show assignments, outlets/visits submitted/accepted/returned, pending sync, streets covered, streets partially covered, streets outstanding and percentage of assigned street network searched. Avoid unnecessary competitive gamification.

## 32. Supervisor / Project Operations View
Near-real-time view by worker includes assignments, status, last activity/submission, outlets discovered, covered/partial/uncovered street contribution, area coverage, warnings and exceptions. Supervisors should see geographic gaps before the project falls behind.

## 33. Project Map / Supervisor Live Coverage Map
The management map is a major MVP operational screen and uses the same underlying coverage truth as the Field Worker map.

Layers/toggles include project boundary, zones, coverage cells, street coverage, known/seed outlets, new/accepted outlets, duplicate candidates, QA flags and authorised field activity/trails.

Filters include date, worker, zone, QA state, outlet type/status and coverage state.

The map must make holes obvious: if surrounding streets are covered but specific street segments were not traversed sufficiently, those segments remain visibly outstanding.

## 34. Surveyor Movement / Street Search Evidence
Where project policy permits, Survey Guru collects privacy-conscious movement/search evidence sufficient to establish actual geographic search coverage.

Movement evidence must be used to derive **street-segment traversal**, not merely display breadcrumb dots. The Street Coverage Engine should map-match suitable movement evidence to the street network and calculate coverage confidence/status.

A worker passing near a side street must not automatically mark that street as searched.

Coverage evidence may include:
- sampled GPS events;
- GPS accuracy;
- timestamps;
- active assignment/search state;
- distance/proportion travelled along a street segment;
- direction/traversal pattern;
- outlet visits/captures as supporting evidence;
- server-derived coverage result and confidence.

MVP should favour sufficient sampled evidence over permanent second-by-second surveillance. Tracking is limited to legitimate project/work coverage purposes, with explicit access and retention controls.

A conceptual street traversal record may contain stable street-segment ID, assignment, worker, first/last observed time, proportion traversed, coverage state, confidence and related outlets/visits.

## 35. Coverage Dashboard
Display project area/cells, street segments by coverage state, percentage of assigned street network covered, unvisited/in-progress/searched/verified cells, outlets found by zone/cell/street context, zero-outlet searched geography and last searched time.

Coverage must report both **outlet result** and **geographic search completeness**.

Example project result:
```text
Outlets captured / verified: 1,284
Assigned street network searched: 94.7%
Street segments outstanding: 46
```

This implements: **Know what we don't know.**

## 36. Expected vs Actual Progress
Dashboard shows expected total, captured/accepted to date, expected progress, variance, remaining work, street coverage progress and remaining street segments. Estimates are labelled honestly.

## 37. QA Queue
Filters include project, worker, zone, date, validation flag, duplicate candidate, GPS/evidence warning, coverage anomaly and QA status. High-risk items can be prioritised.

## 38. QA Visit Review
Review outlet identity, map/GPS, timestamps, answers, evidence, validations, duplicate candidates, permitted outlet history, worker context and relevant coverage evidence. Actions: Accept, Return for Correction, Flag/Escalate, Resolve Duplicate, Correct permitted reference data.

## 39. Return for Correction
Reasons include photo, GPS, missing/conflicting answer, duplicate, classification, revisit or coverage/search evidence issue. Only permitted fields/workflow reopen.

## 40. Outlet Registry
Search workspace outlets by name, customer code, area, map, type, status and last observed date. Detail shows stable identity/location, aliases, client references, permitted history/evidence, duplicate state and Market Universe linkage status.

## 41. Outlet History
Permanent outlets support longitudinal history; changing observations remain visits/observations rather than overwriting identity.

## 42. Client Customer Seed Import
Import CSV/Excel-compatible customer/outlet data including code, name, lat/long and optional address/route/territory. Flow: upload, map columns, validate, preview, confirm, create candidates, match/duplicate checks and summary. No automatic Market Universe promotion.

## 43. General Data Import
Support controlled known outlet/customer, Field Worker, geography/zone and later template imports. Do not expose arbitrary database imports.

## 44. Reports / Exports
Outputs include visit, outlet, response, QA, coverage and evidence-reference exports plus project summary data. Coverage exports should include street/cell coverage state and stable geographic identifiers where available. Stable IDs support reconciliation.

## 45. Daily Project Report
Include date, active workers, visits submitted/accepted, outlets discovered, cumulative total, target/progress, area/street coverage progress, outstanding streets, QA backlog and exceptions. Delivery may initially be view/download.

## 46. Client Viewer Experience
Potential access includes project status, progress vs target, accepted outlets, authorised map, coverage summary, approved reports and separately authorised exports. Exclude internal QA commentary, worker controls, other clients, unlicensed TES intelligence and internal security controls.

## 47. Notifications
MVP in-app events include assignment/reassignment, returned visit, project state, QA backlog and sync failures. Email/SMS/Slack may follow selectively.

## 48. Search
Management search progressively supports project, outlet, customer code, Field Worker, assignment and visit reference, always security scoped.

## 49. Audit Visibility
Privileged activity view may include project activation, survey publication, reassignment, visit reopening, QA override, import/export, outlet match/merge, Market Universe promotion and material coverage overrides/verification.

## 50. Administration
Initial functions: organisations, workspaces, membership, roles, Field Worker status, permitted platform configuration and project access. Security-sensitive actions are API-authorised/audited.

## 51. Market Universe MVP Scope
MVP prepares for TES Market Universe: permanent market outlet structure, workspace/private structure, permitted matching, uncertain-match review and rights-controlled promotion/link. No automatic client-data leakage.

The existing 80,000+ captured outlet dataset can become an important permitted historical reference layer where provenance/data rights allow, supporting outlet identity, density analysis and future opportunity direction.

## 52. Market Universe Promotion UX
Reviewer compares Workspace Outlet vs possible TES Market Outlet using distance, name similarity, location, evidence, source/rights and confidence. Actions: Link Existing, Create Market Outlet, Not Same, Needs Review. Rights validation remains server-side.

## 53. Initial Rules-Based Intelligence
MVP should use reliable deterministic rules rather than premature AI. Examples include duplicate outlet, GPS outside zone, poor GPS, missing evidence, short visit, impossible travel, behind pace, searched-zero-found cell/street area, high discovery area, incomplete street/zone coverage and deterministic priority areas based on permitted historical outlet/coverage evidence.

This is the starting layer for future Opportunity Direction. It does not claim predictive AI accuracy.

## 54. Human-in-the-Loop
```text
System detects / recommends
        |
        v
Human reviews
        |
        v
Decision recorded
        |
        v
Future intelligence learns
```
Applies to duplicates, outlet promotion, QA anomalies, coverage exceptions and future opportunity recommendations.

## 55. What MVP Will Not Attempt
To control scope, v1.0 does not need full AI image recognition, machine-learned predictive outlet discovery, prescriptive field-worker route optimisation, Fleetwize route optimisation, fully automated opportunity recommendations, open gig marketplace, advanced certification marketplace, complex billing, universal CRM, payroll/HR, unrestricted real-time employee tracking, ArcGIS replacement or full enterprise warehouse UI.

**This exclusion does not remove Live Street Coverage Map, street traversal/search evidence or deterministic coverage prioritisation from MVP. Those are locked MVP requirements.**

## 56. Performance Expectations
Targets should cover dashboard, assignments, survey opening, offline save, submission, map viewport, live coverage update, street-segment rendering/query, photo upload, QA and exports. Large datasets must use bounded spatial queries/pagination rather than loading an entire workspace or 80,000+ outlet universe into the browser.

## 57. Mobile Usability Requirements
Account for bright outdoor conditions, one-handed use, intermittent network, medium Android devices, camera, GPS delays, accidental navigation, large touch targets, clear save/sync status, minimal typing and readable live coverage status while walking.

## 58. Accessibility / Readability
Use clear contrast, readable text, labels/patterns rather than colour alone, accessible controls, obvious errors and consistent status terminology. Covered/partial/uncovered streets must remain distinguishable without relying solely on colour.

## 59. Data Quality Success Measures
Measure missing responses/evidence, GPS quality, duplicate rate, QA rejection/correction, first-time acceptance, QA turnaround, match confidence, sync failure and coverage-evidence anomalies/confidence.

## 60. Operational Success Measures
Measure:
- outlets/visits per worker/day;
- project completion trajectory;
- percentage of assigned street network covered;
- covered, partially covered and uncovered street segments;
- area/cell coverage percentage;
- searched-zero-found geography;
- discovery rate by zone/coverage unit;
- QA backlog;
- capture-to-accept time;
- spreadsheet/manual steps removed;
- client reporting time.

A project should be able to report outlet output and geographic search completeness together.

## 61. MVP Acceptance Scenario
The MVP is functionally successful when Taskraft can:
1. create a client workspace/project;
2. configure/publish a survey;
3. import known client outlets;
4. define/import project geography and usable street context;
5. divide geography into operational zones/coverage units;
6. add Field Workers;
7. allocate zones/outlets/street search work;
8. workers receive assignments on mobile;
9. worker operates online or offline;
10. worker opens the live map and sees covered, partially covered and not-yet-covered streets;
11. valid movement/search evidence updates street coverage while working;
12. a skipped street remains visibly outstanding rather than being inferred covered from proximity;
13. worker discovers a new outlet;
14. system checks nearby duplicates;
15. worker captures GPS, answers and photographs;
16. worker submits/syncs visit and coverage evidence;
17. automated rules flag anomalies;
18. QA accepts or returns work;
19. corrected work can be resubmitted;
20. management/supervisor sees team live progress and street coverage;
21. searched-zero-found remains distinguishable from unvisited and searched-with-outlets;
22. accepted outlet/visit history persists beyond the project;
23. client viewer sees authorised results/coverage;
24. project manager exports authorised client-ready outlet and coverage data;
25. no user bypasses workspace/project/assignment boundaries by manipulating UI/API IDs.

## 62. Recommended MVP Build Phases
### Phase 1 — Platform Foundation
Authentication, organisations/workspaces, roles, API authorisation, audit, management shell.

### Phase 2 — Project, Survey & Geographic Foundation
Projects, survey builder/versioning, geography/zones, street-network/coverage-unit foundation, imports, Field Workers.

### Phase 3 — Assignment, Field PWA & Live Street Coverage
Assignment engine, Today screen, **Live Street Coverage Map**, street state rendering, current position, movement/search evidence capture, offline coverage state, visit capture, GPS, responses, evidence and sync.

### Phase 4 — Outlet Identity & QA
Outlet registry, duplicate matching, validations, QA/corrections, accepted visits and Market Universe controlled linkage.

### Phase 5 — Coverage Engine & Operations
Street map-matching/coverage derivation, area/cell aggregation, covered/partial/uncovered states, searched-zero-found distinction, supervisor live map, worker/project progress, coverage exceptions and deterministic priority-area support.

### Phase 6 — Reporting & Client View
Coverage/outlet exports, daily summary, client viewer, operational KPIs and production hardening.

## 63. Production Readiness Gate
Before live use:
- API authorisation tests pass;
- cross-workspace isolation passes;
- protected direct Firestore/Storage access denied;
- offline visit and coverage sync tested under realistic interruption;
- duplicate/idempotency handling tested;
- evidence access tested;
- backup/restore tested;
- survey immutability tested;
- QA/correction tested;
- export permissions tested;
- data-right/Market Universe boundary tested;
- live street coverage and map performance tested at expected project scale;
- street traversal rules field-tested against real walking behaviour;
- passing near/crossing a street does not falsely mark it covered;
- covered/partial/uncovered states remain usable offline and reconcile correctly after sync;
- mobile usability field-tested;
- production logging/alerting available;
- secrets/environment separation verified.

## 64. Locked MVP Functional Decisions
1. Survey Guru MVP is a field-survey operating system, not a questionnaire app.
2. Taskraft must be able to run a real WTS project end-to-end inside the product.
3. Outlet is permanent; Visit is time-bound.
4. Workspace/private outlet and TES Market Universe outlet remain distinct.
5. Geography and coverage are MVP features, not future add-ons.
6. **Live Street Coverage Map is a first-class MVP capability for Field Workers and Supervisors.**
7. Field Workers must see covered, partially covered and not-yet-covered streets on the live map.
8. Street coverage is derived from traversal/search evidence; proximity alone cannot mark a street covered.
9. Unvisited, searched-zero-found and searched-with-outlets are distinct operational truths.
10. Field Worker experience is assignment-centric and mobile-first.
11. Offline fieldwork includes coverage evidence and map state required for the assignment.
12. Basic duplicate matching exists from MVP.
13. GPS and evidence are first-class capture components.
14. Data-quality rules operate during/after capture.
15. QA and correction are formal workflows.
16. Published survey versions are immutable.
17. Management receives near-real-time operational and geographic coverage progress.
18. Client Viewer receives a deliberately restricted client-facing experience.
19. Export is authorised separately from viewing.
20. Market Universe promotion is explicit and rights-controlled.
21. Initial intelligence is rules-based where rules can deliver reliable value.
22. Human review remains available for uncertain decisions.
23. Machine-learned prediction, prescriptive routing and Fleetwize optimisation are future layers, but deterministic priority guidance may be introduced in MVP where evidence supports it.
24. Movement tracking is for legitimate project coverage/search evidence, with scoped access and retention; unrestricted employee tracking is not MVP scope.
25. The UI cannot bypass API/backend security.
26. MVP persistence must remain migration-ready for PostgreSQL/PostGIS/H3.
27. MVP success is measured by both outlet result and geographic search completeness.
28. The existing 80,000+ outlet history should be usable as a permitted intelligence/reference layer without loading the entire dataset into field clients.

## 65. Next Product Design Documents
The MVP Functional Specification should now be translated into implementation-ready design through:

1. **Survey Guru Screen & Navigation Architecture v1.0** — update Field Map and Supervisor Map around live street coverage.
2. **Survey Guru Field Capture & Offline Workflow Specification v1.0** — include offline movement/coverage evidence, sync/conflict behaviour and map-state reconciliation.
3. **Survey Guru QA & Validation Rules Specification v1.0** — exact capture and coverage validation rules, thresholds and exceptions.
4. **Survey Guru Coverage, Field Tracking & Opportunity Direction Architecture** — authoritative architecture for street network, traversal evidence, Coverage Engine, live maps, historical 80,000+ outlet intelligence and future opportunity direction.
5. **Survey Guru Coverage Model Specification v1.0** — H3/grid strategy plus street-segment model, map matching, state transitions, coverage confidence and metrics.
6. **Survey Guru Import & Export Specification v1.0** — stable IDs, geographic/coverage exports and client-ready outputs.

After these are locked, implementation can proceed with substantially less rework.

---

## Living Documentation Rule

This is a living TES product specification. Material scope, workflow, architecture, security, data, integration or operating-model discoveries must be version-controlled in the relevant Survey Guru/TES repository document rather than remaining only in chat or informal notes. Where a decision affects more than one specification, each materially affected living document should be updated or cross-referenced.
