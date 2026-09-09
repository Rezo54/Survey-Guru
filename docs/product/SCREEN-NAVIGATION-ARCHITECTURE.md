# Survey Guru Screen & Navigation Architecture v1.1

**Product Owner:** TES — Task Expert Systems  
**Operational / Field Partner:** Taskraft (Pty) Ltd  
**Status:** MVP Product Design Baseline / Living Document  
**Version:** 1.1  
**Updated:** 9 September 2026

## 1. Purpose

This document translates the Survey Guru MVP Functional Specification, Coverage Model, Field Capture & Offline Workflow, QA rules and API/Authorisation v1.1 into the concrete application structure users navigate.

It defines management and field surfaces, live street coverage, screen responsibilities, QA/correction workflows, offline/sync states, third-party integration status and role-aware navigation.

> **Navigation controls what a user sees conveniently. The API/backend controls what the user is actually allowed to do.**

Hidden screens/buttons/routes are UX only and never security boundaries.

## 2. Product Surfaces

```text
                     SURVEY GURU
                          |
             +------------+------------+
             |                         |
             v                         v
      MANAGEMENT WEB APP          FIELD WORKER APP
      Desktop / Tablet            Mobile First
             |                         |
      Project control              Today's work
      Live Coverage                Live Street Map
      QA / Reporting              Capture / Corrections
      Integrations                 Offline / Sync
      Administration              Search Sessions
```

The field application is task-focused, not a compressed management application.

The production mobile shell remains subject to the PWA/background-location architecture gate: if target Android testing shows browser/PWA limitations materially compromise credible movement evidence, TES must use appropriate native/hybrid capability rather than weaken coverage requirements.

## 3. UX Principles

1. Management is information-rich; field is task-rich.
2. The Live Street Coverage Map is a first-class MVP screen.
3. Outlet result and geographic search completeness are displayed separately.
4. Offline/local and server-authoritative states are visibly different.
5. Coverage uses state plus labels/patterns, not colour alone.
6. Raw movement is not an ordinary management UI layer.
7. QA is exception-focused and high-throughput.
8. Every metric should drill into an operational action where practical.
9. Integration state never obscures Survey Guru's canonical Visit state.
10. UI visibility never grants authority.

## 4. Management Shell

Desktop shell:

```text
+-------------------------------------------------------------------+
| Survey Guru | Workspace | Search | Notifications | User           |
+--------------+----------------------------------------------------+
| Dashboard    |                                                    |
| Projects     |                                                    |
| Map & Cov.   |                 MAIN CONTENT                       |
| Field Team   |                                                    |
| QA           |                                                    |
| Outlets      |                                                    |
| Reports      |                                                    |
| Admin        |                                                    |
+--------------+----------------------------------------------------+
```

Top-level navigation:

```text
Dashboard
Projects
Map & Coverage
Field Team
QA
Outlets
Reports
Administration
```

## 5. Workspace Context

Workspace selector returns only authorised workspaces. Switching workspace clears project-specific UI context and reloads authorised counts/data.

Global search may include project, outlet, client reference, Field Worker, assignment and Visit. Search is security-scoped server-side.

Notifications include correction/revisit requests, assignment changes, project lifecycle, QA backlog, coverage exceptions, sync failures, integration failures/interface updates, import/export completion and other actionable events.

## 6. Workspace Dashboard

Route: `/dashboard`

Purpose:

> **Tell the user what requires attention across the authorised workspace.**

Core cards should separate operational dimensions:

```text
[Active Projects]
[Today's Accepted Visits]
[Awaiting QA]
[Street Coverage]
[Outstanding Coverage]
[Sync / Integration Attention]
```

Project table example:

```text
Project       Outlet Progress   Street Coverage   QA   Attention
Mahikeng      68%               61%               32   Behind coverage
Nelspruit     42%               38%               84   QA backlog
```

Do not present one blended percentage implying outlets captured equals area searched.

## 7. Projects & New Project Wizard

Routes: `/projects`, `/projects/new`

Project list columns:

```text
Project | Geography | Status | Dates | Outlet Target | Accepted | Street Coverage | Field Workers | QA
```

New Project stepper:

```text
1 Project
2 Survey
3 Geography & Coverage Mode
4 Field Team
5 Assignments
6 Review
```

Geography step defines boundary/zones and relevant coverage mode/policy configuration. Activation is blocked until required configuration passes validation.

## 8. Project Command Centre

Route: `/projects/{projectId}`

Tabs:

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

Settings contains authorised project configuration, coverage policy references and integration linkage where applicable.

## 9. Project Overview

Route: `/projects/{projectId}/overview`

Primary KPIs:

```text
[Outlet Target]
[Captured]
[Accepted]
[Street Network Coverage]
[Outstanding Street Length]
[QA Pending]
```

Coverage wording should be precise, e.g.:

> **94.7% of the eligible assigned street network has sufficient search-coverage evidence under the active project coverage policy.**

Operational attention includes workers/assignments with no activity, uncovered required streets, coverage holes/exceptions, partial streets, sync backlog, corrections, duplicate candidates, QA backlog and integration failures.

## 10. Project Map & Coverage — Core MVP Screen

Route: `/projects/{projectId}/map`

```text
+------------------------------------------------------------------+
| Worker | Zone | Coverage State | QA | Layers | View Outstanding |
+---------------------------------------------+--------------------+
|                                             | Context Panel      |
|                  LIVE MAP                   |                    |
|                                             | Selected street/   |
|                                             | cell/outlet/zone   |
|                                             | evidence summary   |
+---------------------------------------------+--------------------+
```

This screen must make geographic holes obvious. Surrounding coverage must never visually imply an untraversed side street is complete.

## 11. Management Map Layers

Authorised layer set may include:

```text
Project Boundary
Operational Zones
Eligible Street Network
Covered Streets
Partially Covered Streets
Uncovered Streets
Verified Streets
Coverage Cells / H3
Known / Seed Outlets
Newly Discovered Outlets
Accepted Outlets
Duplicate Candidates
QA Flags
Coverage Exceptions
Deterministic Priority Areas
```

Optional authorised operational layer:

```text
Team Coverage Contribution
```

Raw GPS breadcrumb history is **not** a normal layer. Privileged investigation uses a purpose-specific workflow.

## 12. Coverage Visual Language

Street states:

```text
UNCOVERED
PARTIALLY COVERED
COVERED
VERIFIED
```

Area/cell states:

```text
UNVISITED
IN PROGRESS
SEARCHED
VERIFIED
```

Outcome badges separately show:

```text
SEARCHED — ZERO OUTLETS FOUND
SEARCHED — OUTLETS FOUND
```

Confidence is separate from state and may appear as `High / Medium / Low` or a detailed authorised indicator.

Never use colour alone; use line treatment/pattern/icon/text legend.

## 13. View Outstanding

`View Outstanding` is a first-class action on project and field coverage screens.

Management view filters/highlights:

- uncovered required streets;
- partially covered streets;
- unresolved coverage exceptions;
- incomplete cells/areas;
- coverage gaps created by reassignment/reconciliation;
- informal/unmapped areas still requiring search.

It can lead directly to assignment/reassignment where authorised.

## 14. Map Selection Panel

Street example:

```text
Mahlangu Street / Segment SG-ST-...
PARTIALLY COVERED
Supported: 68%
Confidence: Medium
Outstanding: 124 m
Last evidence: Today 14:32
Contributors: 2
Outlets found: 3

[View Outstanding Portion]
[View Exceptions]
[Create / Reassign Work]
```

Cell example:

```text
Cell 8A23
SEARCHED — ZERO OUTLETS FOUND
Coverage: 100%
Confidence: High
Last evidence: Today 14:32
```

Outlet example opens Outlet/Visit actions.

## 15. Coverage Exceptions

Project map and QA can expose exceptions such as:

```text
GPS Jump
Low Accuracy
Parallel Street Ambiguity
Insufficient Traversal
Coverage Hole
Duplicate Batch
Device Conflict
```

These are QA/processing signals, not accusations of misconduct.

The UI should explain what evidence is insufficient and what operational action is needed where possible.

## 16. Assignments

Route: `/projects/{projectId}/assignments`

List and optional map allocation views. Filters include worker, type, zone, date, status, priority and coverage completeness.

Primary actions:

```text
+ Create Assignment
Bulk Assign
Reassign Selected
View Outstanding Coverage
```

Assignment Detail shows target geography/outlet, worker, instructions, lifecycle, associated Visits/Search Sessions, coverage progress, sync status and reassignment history.

Reassignment preserves prior valid coverage and makes remaining work clear.

## 17. Field Workers — Management

Route: `/projects/{projectId}/field-workers`

Columns:

```text
Worker
Status
Assigned
Started
Submitted
Accepted
Returned
Last Activity
Street Coverage Contribution
Outstanding Work
Sync Attention
```

Worker detail remains operational, not an HR personnel file.

Management normally sees derived coverage contribution and operational activity summaries, not unrestricted raw movement trails.

## 18. Outlets & Permanent Identity

Routes:

```text
/projects/{projectId}/outlets
/outlets
/outlets/{workspaceOutletId}
```

Outlet Detail tabs:

```text
Overview
Visit History
Evidence
Client References
Match / Identity
```

The UI reinforces:

> **Outlet persists; Visits accumulate.**

Workspace Outlet Registry is not automatically the TES Market Universe.

## 19. Match / Identity Review

Match screen compares candidate and possible existing outlet using authorised identity evidence.

Actions:

```text
Confirm Existing
Confirm New / Keep Separate
Needs Review
Merge (only stronger authorised role)
```

Algorithm confidence can inform but never silently merge permanent outlets.

Field Workers receive simplified `Use Existing / Not the Same` choices and never complex Market Universe merge authority.

## 20. Project Visits & Visit Detail

Routes:

```text
/projects/{projectId}/visits
/visits/{visitId}
```

Visit list columns:

```text
Visit | Outlet | Worker | Zone | Submitted | GPS | Evidence | Validation | QA | Integration
```

Visit Detail layout:

```text
+----------------------------------------------------------------+
| Visit / Outlet / SG Status / Worker / Time                     |
| Integration: Premier WTS — Pending / Synced / Attention        |
+--------------------------------+-------------------------------+
| Survey Responses               | Map / Visit Location          |
| Sections / Repeatable Rows      | Evidence / Photos             |
+--------------------------------+-------------------------------+
| Validation Results | QA History | Corrections | Integration    |
+----------------------------------------------------------------+
```

## 21. Integration Status on Visit

Survey Guru and client-system state are always displayed independently:

```text
Survey Guru     ✓ Accepted
Premier WTS     ✓ Synced
```

or:

```text
Survey Guru     ✓ Accepted
Premier WTS     ⚠ Pending retry
```

or:

```text
Survey Guru     ✓ Accepted
Premier WTS     ⚠ Interface update required
```

A third-party failure must never visually imply Survey Guru lost the Visit.

## 22. QA Top-Level & Project QA

Routes: `/qa`, `/projects/{projectId}/qa`

Workspace QA cards:

```text
Awaiting Review
Blocking / High-Risk
Coverage Exceptions
Duplicate Identity
Returned Corrections
Revisit Required
Integration Attention
Overdue QA
```

Queue filters include project, worker, zone, resource type, severity, rule type, age and status.

## 23. QA Review Workspace

QA is resource-oriented, not Visit-only. A QA work item may concern:

- Visit;
- Outlet identity;
- Evidence/photo;
- GPS/location;
- response inconsistency;
- street/cell coverage;
- duplicate candidate;
- integration exception.

Layout:

```text
+----------------------------------------------------------------+
| QA Item | Severity | Project | Worker | Age                     |
+--------------------------------+-------------------------------+
| Primary Resource                | Evidence / Map / Comparison   |
| Responses / rule findings       | Photos / coverage context     |
+--------------------------------+-------------------------------+
| Rule Result | History | Notes                                  |
+----------------------------------------------------------------+
| [Return for Correction] [Require Revisit] [Resolve] [Next]     |
```

## 24. QA Severity UX

Consistent severity:

```text
BLOCK
WARN
FLAG FOR QA
INFO
```

`BLOCK` prevents the relevant transition where policy requires. UI cannot offer `Continue Anyway` for a server-defined BLOCK.

WARN may allow continuation. FLAG FOR QA communicates review without exposing sensitive detection logic unnecessarily.

## 25. Correction vs Revisit

Correction means existing Visit data/evidence can be corrected within permitted fields.

Revisit means new physical field observation is required and creates a new linked Visit.

QA actions must therefore distinguish:

```text
Return for Correction
Require Revisit
```

Never use a correction workflow to rewrite history when a new observation is required.

## 26. Return for Correction

Dialog supports structured reason, affected section/field/evidence and reviewer note.

Field Today surfaces returned work prominently and opens directly to affected content.

Original accepted/submitted history remains visible to authorised reviewers.

## 27. Survey Builder & Preview

Routes: `/projects/{projectId}/survey` plus builder/preview.

Published Survey Versions are immutable. Preview emulates mobile question grouping, repeatable rows, required fields, conditional logic, evidence and validation messages without writing production Visits.

## 28. Reports & Exports

Routes: `/reports`, `/projects/{projectId}/reports`

Coverage reports must separate:

```text
Outlet Result
Geographic Search Completeness
```

Example:

```text
Accepted outlets: 1,284
Eligible street network searched: 94.7%
Outstanding street length: 8.6 km
Searched-zero-found units: 132
```

Export wizard remains controlled:

```text
1 Dataset
2 Filters
3 Fields
4 Evidence Options
5 Review
6 Generate
```

Viewing never implies export authority.

## 29. Administration

Route: `/admin`

Sections may include:

```text
Organisations
Workspaces
Users & Membership
Roles / Access
Configuration
Integrations
Audit Activity
```

Identity, organisation membership, workspace membership, role/permissions and project participation remain distinct concepts.

## 30. Integrations Administration

Route concept: `/admin/integrations`

```text
Third-Party Interfaces
  Premier WTS
```

Premier interface screen tabs:

```text
Configuration
Field Mapping
User / External Identity
Interface Version
Sync Status
Update & Test
Reference Screens
Change History
```

Compatibility states:

```text
Compatible
Update Required
Testing
Incompatible
```

Secrets/bearer tokens are never displayed as reusable credentials.

## 31. Field Mobile Shell

Bottom navigation is locked:

```text
Today     Assignments     Map     Sync
```

Header shows profile/help and compact connectivity/location/search-session state where relevant.

The Map remains reachable throughout active fieldwork.

## 32. Field Today

Route: `/field/today`

Priority:

1. Corrections/Revisits needing action;
2. sync items needing attention;
3. today's progress;
4. current/next Assignment.

Example progress:

```text
Assignments completed: 3 / 12
Visits submitted: 8
Assigned street network searched: 67%
Outstanding required street: 4.2 km
Pending sync: 2
```

Outlet and coverage progress remain separate.

## 33. Assignment Readiness

Before `Start Assignment`, show:

```text
Survey               Ready
Assignment Map        Ready
Known Outlets         Ready
Street Coverage       Ready
Offline Package       Ready
Location Permission   Ready
Camera Permission     Ready
Pending Sync          0
```

If required package components are unavailable, explain whether work can proceed safely.

## 34. Search Session Control

Starting a coverage-capable Assignment creates/resumes the Search Session.

Field UI states:

```text
READY
ACTIVE SEARCH
VISIT IN PROGRESS
PAUSED
COMPLETED
```

When active:

```text
Searching this assignment
Movement is being used to calculate project coverage.
[Pause Search]
```

When paused:

```text
Search paused
Movement is not currently contributing to coverage.
[Resume Search]
```

Tracking language must be clear and purpose-limited, not ambiguous always-on surveillance.

## 35. Field Live Street Coverage Map — First-Class MVP

Route: `/field/map`

Primary question:

> **Which streets have I covered, and which streets do I still need to walk/search?**

Required layers:

```text
Assignment Boundary / Zone
Current Position
Uncovered Streets
Partially Covered Streets
Covered Streets
Known / Assigned Outlets
Own Newly Discovered Outlets
Selected Destination
```

Where relevant:

```text
Area/H3 Coverage
Local Pending Coverage
Authorised Team Coverage
Deterministic Priority Areas
```

Primary actions:

```text
Discover Outlet
View Outstanding
Pause / Resume Search
Re-centre
Layer / Legend
```

## 36. Local Pending Coverage

Offline/local traversal can update the map provisionally.

The visual language distinguishes:

```text
SERVER CONFIRMED
LOCAL — WAITING TO SYNC
```

A locally green/complete-looking street must not be represented as `VERIFIED`.

After sync, authoritative server coverage replaces/reconciles local provisional state.

## 37. Coverage Reconciliation UX

If server calculation differs materially from local display, explain it.

Example:

```text
Street coverage needs more walking.
GPS evidence confirmed 68% of this street.

[Show Outstanding Portion]
```

Do not silently reduce a worker's apparent completion without explanation.

## 38. Side-Street Protection UX

A side street crossed at its entrance remains visibly outstanding.

The map must not visually fill nearby streets based merely on proximity.

If map matching is uncertain:

```text
Coverage not confirmed here
Walk further along this street to complete it.
```

This behaviour is a core MVP acceptance criterion.

## 39. Informal / Unmapped Area UX

For `AREA_PRIMARY` or `HYBRID` zones, map uses area/H3 search coverage and movement-supported progress rather than pretending an incomplete road network is exhaustive.

Worker sees clear area cells/coverage guidance and can still discover outlets normally.

## 40. Discover Outlet & Identity Gate

Flow:

```text
Capture Location
 -> Outlet Name / minimum identity
 -> Nearby Match Check
 -> Strong / Possible / No likely match
 -> Use Existing / Confirm Not Same
 -> Candidate + Storefront Evidence
 -> Begin Visit
```

Offline uncertain match may show:

```text
Saved as candidate
Final duplicate check will run when synced.
```

Never silently merge.

## 41. Field Visit

Route: `/field/visits/{visitId}`

Header should show:

```text
Shop ABC
GPS: Good
Saved locally ✓
Search: Visit in progress
```

Visit sections display completion. Repeatable product/price rows are first-class for Premier-style surveys.

Autosave must make app switching, lock/suspension and connectivity loss recoverable subject to the mobile architecture capability decision.

## 42. Validation UX

### BLOCK

```text
Cannot submit yet
Storefront photo is required.
```

### WARN

```text
GPS accuracy is weak.
Try again before submitting.
[Retry GPS] [Continue]
```

only where policy allows.

### FLAG FOR QA

```text
Saved — this item may be reviewed by QA.
```

Internal fraud/security rules should not be unnecessarily exposed.

## 43. Visit Review & Offline Submit

Review includes required answers, GPS, evidence, warnings, identity state and integration-required fields.

When offline, `Submit Visit` means:

> **Complete locally and queue for authoritative server submission.**

UI wording:

```text
Saved on device — waiting to sync
```

not `Accepted` or server-submitted.

After local completion, return directly to the Live Map in the previous assignment context.

## 44. Correction Field UX

Returned Visit opens the affected section/field/evidence directly.

Only permitted correction fields are editable. Unaffected accepted content should be read-only or clearly protected.

Flow:

```text
Correction Required
 -> Affected Section
 -> Fix
 -> Review Correction
 -> Resubmit
```

## 45. Revisit Field UX

A revisit appears as a new Assignment/task linked to the prior Visit:

```text
REVISIT REQUIRED
Shop ABC
Reason: GPS/location confirmation required
Original visit: 8 Sep 2026

[Open Map]
[Start Revisit]
```

It creates a new Visit rather than reopening history as if it were the same physical observation.

## 46. Sync Centre

Route: `/field/sync`

Groups:

```text
SYNCED
WAITING TO SYNC
NEEDS ATTENTION
```

Items may include:

```text
Visit
Photo / Evidence
Outlet Candidate
Movement Batch / Coverage
Correction
Integration handoff status where worker is permitted to see it
```

Per-operation result can show:

```text
Synced
Accepted for processing
Retrying
Conflict
Rejected
Needs attention
```

`Sync Now` is available where useful.

## 47. Connectivity Banner

Offline:

```text
Offline — your work is being saved on this device.
```

Reconnect:

```text
Back online — syncing 4 items...
```

Success:

```text
All work synced ✓
```

Persistent warnings should be reserved for actionable states rather than creating banner fatigue.

## 48. Premier Field Integration Status

Where the worker is allowed to see client sync status, show independent compact state after Survey Guru submission:

```text
Survey Guru  ✓ Submitted
Premier WTS  ... Pending
```

then:

```text
Premier WTS  ✓ Synced
```

For the v2.006 UI-adapter POC, `Synced` is shown only after final `Submit Surveys` confirmation.

If the interface changed:

```text
Premier WTS  ⚠ Interface update required
Your Survey Guru visit is safe.
```

## 49. Field Profile / Diagnostics

Profile/help may show worker identity, organisation, app version, package version, connectivity, sync diagnostics, location permission/state, storage/battery warnings where useful, basic help and sign out.

Do not expose administration or secrets.

## 50. Status Vocabulary v1.1

Project:
`Draft | Configured | Active | Paused | Completed | Archived`

Assignment:
`Assigned | Accepted | In Progress | Submitted | Completed | Reassigned | Cancelled`

Search Session:
`Ready | Active Search | Visit In Progress | Paused | Completed | Cancelled`

Visit:
`Capturing | Saved Offline | Syncing | Submitted | Review Required | Correction Required | Accepted`

Street Coverage:
`Uncovered | Partially Covered | Covered | Verified`

Area Coverage:
`Unvisited | In Progress | Searched | Verified`

Evidence:
`Pending Upload | Uploaded | Validating | Accepted | Replacement Required`

QA:
`Awaiting Review | Claimed | Correction Required | Revisit Required | Resolved`

Integration:
`Pending | Syncing | Synced | Action Required | Interface Update Required`

## 51. Permission-Aware UX

Examples:

- Field Worker receives no management shell;
- Client Viewer receives simplified project/results/map/report shell;
- Analyst can view authorised analytics without automatically exporting;
- QA sees only permitted project/resources/actions;
- raw movement controls are absent from ordinary users;
- Market Universe actions appear only to separately authorised roles;
- coverage override is hidden unless specifically permitted.

> **Hidden controls are convenience, not security.**

## 52. Client Viewer Navigation

Simplified shell:

```text
Dashboard
Projects
Map
Reports
```

Project:

```text
Overview
Map
Accepted Results
Reports
```

Client Map defaults to derived coverage/results. Taskraft/TES internal QA, worker-management, raw movement and Market Universe controls remain absent unless explicitly authorised.

## 53. Deep Links

Conceptual routes:

```text
/dashboard
/projects
/projects/new
/projects/{projectId}/overview
/projects/{projectId}/map
/projects/{projectId}/assignments
/projects/{projectId}/field-workers
/projects/{projectId}/outlets
/projects/{projectId}/visits
/projects/{projectId}/qa
/projects/{projectId}/survey
/projects/{projectId}/reports
/projects/{projectId}/settings

/outlets
/outlets/{workspaceOutletId}
/visits/{visitId}
/assignments/{assignmentId}
/qa
/qa/{qaWorkItemId}
/field-team
/reports
/admin
/admin/integrations
/admin/integrations/{integrationProfileId}

/field/today
/field/assignments
/field/assignments/{assignmentId}
/field/map
/field/visits/{visitId}
/field/corrections/{correctionId}
/field/revisits/{revisitTaskId}
/field/sync
```

Route existence never grants access.

## 54. Responsive Management

Desktop/tablet are primary. On smaller screens navigation collapses, tables prioritise columns, map side panels become bottom sheets and filters become drawers.

Field map/capture is separately mobile-optimised.

## 55. Empty, Loading & Error States

Empty states explain next action rather than looking broken.

Long operations become jobs/status rather than blocking spinners.

Errors are actionable and safe:

```text
You no longer have access to this assignment.
Return to Today.
```

```text
This visit changed while you were offline.
Review the latest version before resubmitting.
```

```text
Coverage could not be confirmed for part of this street.
Show outstanding area.
```

## 56. Unsaved Work & Recovery

Management warns before abandoning meaningful unsaved edits.

Field capture autosaves locally. A worker should not lose a Visit because the app closes, network disappears or another approved app is opened.

Mobile capability testing must explicitly validate lock-screen/background/app-switch behaviour before production architecture is locked.

## 57. Screen-Level Data Loading

Purpose-specific APIs only:

```text
Project Overview -> project summary
Project Map -> bounded coverage/map API
Field Map -> assignment package + coverage changes
QA -> paginated QA work items
Visit -> authorised visit projection
Sync -> per-operation sync state
Integration -> authorised integration projection
```

Do not download broad Firestore collections and filter them in UI.

## 58. Management MVP Screen Inventory v1.1

1. Login/authentication
2. Workspace Dashboard
3. Projects
4. New Project Wizard
5. Project Overview
6. Project Live Map & Coverage
7. Coverage Outstanding View
8. Coverage Exception Detail
9. Project Assignments
10. Assignment Detail
11. Bulk Assignment
12. Project Field Workers
13. Field Worker Project Detail
14. Project Outlets
15. Workspace Outlet Registry
16. Outlet Detail
17. Match / Identity Review
18. Project Visits
19. Visit Detail
20. Workspace QA
21. Project QA
22. QA Work Item Review
23. Correction Review
24. Revisit Review
25. Project Survey
26. Survey Builder
27. Survey Preview
28. Reports
29. Export Wizard
30. Field Team
31. Administration
32. Users / Membership
33. Integrations
34. Premier WTS Interface Detail
35. Audit Activity
36. Import Wizard
37. Import Result / Error Review

## 59. Field MVP Screen Inventory v1.1

1. Login/authentication
2. Today
3. Assignments
4. Assignment Detail / Readiness
5. Search Session Start/Pause state
6. Live Street Coverage Map
7. View Outstanding
8. Discover Outlet
9. Nearby Match Check
10. Visit Summary
11. Survey Section / Question Capture
12. Repeatable Product / Price Rows
13. Photo Capture
14. GPS Status/Retry
15. Visit Review
16. Submitted / Saved for Sync
17. Correction Detail
18. Revisit Detail
19. Sync Centre
20. Coverage Reconciliation Message
21. Profile / Help / Diagnostics

## 60. End-to-End — Project Manager

```text
Login
 -> Dashboard
 -> New/Open Project
 -> Survey
 -> Geography + Coverage Mode
 -> Field Team
 -> Assignments
 -> Activate
 -> Overview
 -> Live Map / View Outstanding
 -> Reassign gaps / resolve exceptions
 -> QA
 -> Reports / Export
```

## 61. End-to-End — Field Worker

```text
Login
 -> Today
 -> Assignment Readiness
 -> Start Assignment / Search Session
 -> Live Map
 -> Walk/Search Outstanding Streets
 -> Discover / Select Outlet
 -> Identity Gate
 -> Visit
 -> Survey / Evidence
 -> Review
 -> Save/Submit
 -> Return to Live Map
 -> Continue Outstanding Coverage
 -> Sync
 -> Complete Assignment
```

## 62. End-to-End — QA

```text
QA Queue
 -> QA Work Item
 -> Responses / Evidence / Map / Validation
 -> Resolve
      OR Return for Correction
      OR Require Revisit
      OR Escalate authorised identity/coverage exception
 -> Next
```

## 63. End-to-End — Coverage Investigation

```text
Project Overview
 -> Street Coverage KPI
 -> View Outstanding
 -> Map
 -> Select uncovered/partial street
 -> Inspect confidence/exceptions
 -> Review derived worker contribution
 -> Create/Reassign work
 -> Field sync/traversal
 -> Server recalculation
 -> Map updates
```

## 64. End-to-End — Premier Integration

```text
Accepted Survey Guru Visit
 -> Integration Job
 -> Premier Adapter
 -> Populate authorised WTS flow
 -> Final Submit Surveys
 -> Confirm success
 -> Premier WTS ✓ Synced
```

Failure path:

```text
Survey Guru ✓ Accepted
Premier WTS ⚠ Pending / Action Required
 -> Retry / Interface Update
```

No recapture of canonical Survey Guru data.

## 65. MVP UX Acceptance Criteria v1.1

The design is successful when:

1. Field Worker can immediately identify today's work.
2. Live Street Coverage Map is reachable throughout active fieldwork.
3. Worker can distinguish covered, partial and outstanding streets without colour alone.
4. Crossing a side street does not visually mark it covered.
5. Local pending coverage is distinguishable from server-confirmed coverage.
6. Material reconciliation differences are explained.
7. Worker can pause/resume Search Session and understand movement purpose.
8. Offline Visit and coverage work survives restart/connectivity loss.
9. Worker returns to previous map context after Visit.
10. View Outstanding identifies remaining geography clearly.
11. Informal/unmapped area mode does not falsely imply complete road coverage.
12. Outlet identity check occurs before new permanent identity.
13. QA can process Visit, identity, evidence and coverage exceptions efficiently.
14. Correction and revisit are visibly distinct.
15. Survey Guru and Premier statuses are independent.
16. Premier failure never appears as loss of Survey Guru Visit.
17. Supervisor can see geographic holes without raw GPS trails.
18. Outlet result and geographic completeness are reported separately.
19. Client Viewer cannot enter internal QA/worker/raw movement workflows.
20. Direct URL/UI manipulation gives no extra authority.
21. Large maps/lists use bounded/paginated APIs.
22. Field PWA/native capability gate is tested under lock/background/app switching before production.

## 66. Locked Screen & Navigation Decisions v1.1

1. Separate management and field experiences remain.
2. Field bottom navigation remains Today, Assignments, Map, Sync.
3. Live Street Coverage Map is a first-class MVP capability.
4. Map answers “what have I covered and what remains?”
5. Street coverage states are Uncovered, Partial, Covered, Verified.
6. Area states remain Unvisited, In Progress, Searched, Verified.
7. Searched-zero-found is visually distinct from unvisited.
8. View Outstanding is first-class.
9. Local pending coverage is visually distinct from server-confirmed state.
10. Field Worker never sees local provisional state as VERIFIED.
11. Coverage reconciliation differences are explained.
12. Search Session start/pause/resume is visible and purpose-limited.
13. Side-street proximity cannot visually imply completion.
14. Informal/unmapped areas support area/hybrid coverage UX.
15. Raw movement trails are not normal management/client UI.
16. Management consumes derived coverage by default.
17. Outlet identity gate precedes new outlet creation.
18. Permanent outlet merges remain stronger-authority operations.
19. Corrections preserve history; revisits create new linked Visits.
20. QA is resource-oriented and exception-based.
21. BLOCK validation cannot offer a UI bypass.
22. Survey Guru and third-party integration states are independent.
23. Premier WTS Synced requires final Submit Surveys confirmation for v2.006 adapter flow.
24. Field work returns to Live Map after Visit.
25. Offline and server-submitted states remain visibly distinct.
26. Outlet result and geographic completeness are separate KPIs.
27. Client Viewer uses simplified restricted navigation.
28. Export remains a controlled separately authorised workflow.
29. Stable deep links do not grant authority.
30. Screens use purpose-specific APIs rather than broad database downloads.
31. Map provider remains abstracted from TES domain truth.
32. PWA/background location reliability is an architecture gate, not assumed.
33. If PWA reliability is inadequate, native/hybrid capability is preferred over weakening coverage requirements.
34. UX permissions never replace backend/API authorisation.

## 67. Next Implementation Design Work

The major product, data, persistence, API, coverage, field workflow and navigation baselines are now mutually aligned enough to move into implementation-oriented design.

Recommended next artefacts:

1. **Mobile Capability & Background Location ADR v1.0** — test and decide PWA vs native/hybrid capability for credible field movement collection.
2. **Import & Export Specification v1.0** — project setup, seed outlet import, validation, mappings and controlled exports.
3. **PostgreSQL/PostGIS Logical Schema v1.0** — future spatial persistence target mapped from stable domain/API contracts.
4. Detailed endpoint request/response contracts can then be produced alongside implementation.

The Mobile Capability ADR is the highest-risk immediate decision because Live Street Coverage is now locked into the MVP and must work during camera use, screen lock, Premier Power Apps switching, navigation and unreliable connectivity.

---

## Living Documentation Rule

This is a living TES product-design specification. Material screen, workflow, navigation, coverage, QA, offline, integration or security changes must be version-controlled here and in other materially affected Survey Guru/TES documents rather than remaining only in chat or informal notes.
