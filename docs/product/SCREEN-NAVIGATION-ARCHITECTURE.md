# Survey Guru Screen & Navigation Architecture v1.0

**Product Owner:** TES — Task Expert Systems  
**Operational / Field Partner:** Taskraft (Pty) Ltd  
**Status:** MVP Product Design Baseline / Living Document  
**Version:** 1.0  
**Date:** 7 September 2026

## 1. Purpose

This document translates the Survey Guru MVP Functional Specification into the concrete application structure users will navigate.

It defines:

- management application information architecture;
- field-worker PWA architecture;
- project-level navigation;
- map-centred workflows;
- screen responsibilities;
- primary actions;
- role-aware UX;
- responsive behaviour;
- status and notification patterns;
- navigation rules that preserve the strict API security architecture.

> **Navigation controls what a user sees conveniently. The API/backend controls what a user is actually allowed to do.**

The screen architecture must therefore never become a substitute for authorisation.

## 2. Product Surfaces

Survey Guru MVP has two deliberately different product surfaces sharing the same backend/domain model.

```text
                     SURVEY GURU
                          |
             +------------+------------+
             |                         |
             v                         v
      MANAGEMENT WEB APP          FIELD WORKER PWA
      Desktop / Tablet            Mobile First
             |                         |
      Project control              Today's work
      Maps / Coverage              Assignments
      QA / Reporting              Map / Capture
      Administration              Offline / Sync
```

The Field Worker PWA must not simply be a compressed version of the management application.

## 3. Design Principle — Role-Driven Complexity

Management users need breadth and comparison.

Field Workers need focus and speed.

Therefore:

> **Management navigation is information-rich. Field navigation is task-rich.**

A surveyor standing outside a store should never need to understand the entire Survey Guru hierarchy to complete a visit.

## 4. Global Management Shell

Desktop layout:

```text
+-------------------------------------------------------------------+
| Survey Guru | Workspace | Search | Notifications | User           |
+--------------+----------------------------------------------------+
|              |                                                    |
| Dashboard    |                                                    |
| Projects     |                                                    |
| Map          |                 MAIN CONTENT                       |
| Field Team   |                                                    |
| QA           |                                                    |
| Outlets      |                                                    |
| Reports      |                                                    |
| Admin        |                                                    |
|              |                                                    |
+--------------+----------------------------------------------------+
```

Primary shell components:

- persistent left navigation on desktop;
- top application bar;
- workspace selector;
- global search;
- notifications;
- user/profile menu;
- contextual breadcrumbs where useful;
- main content area.

## 5. Management Primary Navigation

Recommended top-level navigation:

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

Items appear according to UX permissions/context but API authorisation is always independently enforced.

## 6. Workspace Selector

Location: top application bar.

Display:

```text
Premier WTS Workspace   v
```

Selecting it shows only authorised workspaces.

Switching workspace:

- clears project-specific UI context;
- reloads workspace-scoped navigation counts;
- reloads authorised dashboard data;
- does not carry filters from another workspace where this could cause confusion;
- does not imply new authority.

Users with one workspace may see its name without a selector.

## 7. Global Search

Search icon/input in management header.

Initial searchable entities:

- project name/code;
- outlet name;
- client customer code;
- Field Worker;
- assignment reference;
- visit reference.

Results are grouped by entity type and security-scoped before being returned.

Example:

```text
Search: Shop ABC

OUTLETS
Shop ABC — Soweto
Shop ABC Supermarket — Diepsloot

VISITS
Shop ABC — 05 Sep 2026 — Accepted
```

## 8. Notifications Centre

Header bell with unread count.

MVP notification types:

- visit returned for correction;
- assignment reassigned;
- project activated/paused;
- QA backlog warning;
- import completed/failed;
- export completed/failed;
- important sync/operational exception where relevant.

Clicking a notification deep-links to the authorised resource.

## 9. Management Dashboard

Route concept:

`/dashboard`

Purpose:

> **Tell the user what requires attention across the current workspace.**

Recommended layout:

```text
Workspace Dashboard

[Active Projects] [Today's Visits] [Awaiting QA] [Coverage]

Attention Required
-------------------------------------------------------
Mahikeng WTS      Behind plan       View Project
Nelspruit WTS     84 QA pending     Open QA
Zone 14           Low coverage      View Map

Active Projects
-------------------------------------------------------
Project          Progress       Coverage       QA
Mahikeng         68%            61%            32
Nelspruit        42%            38%            84

Recent Activity
-------------------------------------------------------
...
```

Do not overload the workspace dashboard with detailed analytics that belong inside projects.

## 10. Projects Screen

Route:

`/projects`

Functions:

- browse projects;
- filter/sort;
- create project;
- open project;
- identify projects needing attention.

Recommended desktop presentation: table/cards toggle if useful, with table as operational default.

Columns:

```text
Project
Market / Geography
Status
Dates
Target
Accepted
Progress
Coverage
Field Workers
QA Pending
```

Primary action:

`+ New Project`

## 11. New Project Wizard

Route:

`/projects/new`

Stepper:

```text
1 Project
2 Survey
3 Geography
4 Field Team
5 Assignments
6 Review
```

Persistent controls:

`Back` | `Save Draft` | `Continue`

Final step:

`Activate Project`

Activation is disabled until required configuration passes validation.

## 12. Project Command Centre

Route:

`/projects/{projectId}`

Every project opens into a project-specific shell.

Header:

```text
Mahikeng WTS — September 2026
ACTIVE
Premier | Mahikeng | 1 Sep - 15 Oct

[Pause Project] [...] 
```

Project tabs:

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

This is the primary operational workspace for Project Managers/Supervisors.

## 13. Project Overview

Route:

`/projects/{projectId}/overview`

Layout priority:

### Row 1 — Core KPIs

```text
[Target]
[Captured]
[Accepted]
[Coverage]
[QA Pending]
```

### Row 2 — Progress

Target vs actual trajectory chart and simple expected-to-date comparison.

### Row 3 — Operational Attention

Examples:

- workers with no submissions today;
- zones not started;
- high QA rejection;
- sync backlog;
- duplicate candidates;
- project behind plan.

### Row 4 — Map Preview

Compact project map linking to full Map & Coverage screen.

### Row 5 — Recent Activity

Latest submissions/QA/corrections.

## 14. Project Map & Coverage

Route:

`/projects/{projectId}/map`

This is one of Survey Guru's core screens.

Desktop layout:

```text
+---------------------------------------------------------------+
| Filters / Date / Worker / Zone / Layer controls              |
+------------------------------------------+--------------------+
|                                          |                    |
|                                          |  Context Panel     |
|                 MAP                      |                    |
|                                          |  Selected Zone     |
|                                          |  Coverage          |
|                                          |  Outlets           |
|                                          |  Actions           |
|                                          |                    |
+------------------------------------------+--------------------+
```

## 15. Map Layers

Layer control supports:

```text
Project Boundary
Operational Zones
Coverage Cells
Known / Seed Outlets
Newly Discovered Outlets
Accepted Outlets
Duplicate Candidates
QA Flags
Field Activity / Search Evidence
```

Only authorised layers/data are returned by API.

## 16. Map Status Visual Language

Coverage must be understandable without relying only on colour.

States:

```text
Unvisited
In Progress
Searched
Verified
```

Use colour plus pattern/icon/label in legends and selected-cell details.

Outlet markers should distinguish at minimum:

```text
Known / Seed
New Candidate
Accepted
QA Required
Duplicate Candidate
Closed / Inactive where applicable
```

Exact visual colours belong to the later design system, not this architecture specification.

## 17. Map Selection Panel

Selecting a zone/cell/outlet opens a side panel rather than immediately navigating away.

Coverage cell example:

```text
Zone 14 / Cell 8A23
Status: Searched
Last searched: Today 14:32
Search effort: 46 min
Workers: 2
Outlets discovered: 7
Visits: 8

[View Activity]
```

Outlet example:

```text
Shop ABC
Accepted
Last visit: Today 13:45
Worker: ...

[Open Outlet]
[Open Visit]
```

## 18. Assignments Screen

Route:

`/projects/{projectId}/assignments`

Views:

- list/table;
- optional map allocation view.

Filters:

- worker;
- assignment type;
- zone;
- scheduled date;
- status;
- priority.

Primary actions:

```text
+ Create Assignment
Bulk Assign
Reassign Selected
```

## 19. Assignment Detail

Route:

`/assignments/{assignmentId}`

Display:

- type;
- worker;
- project;
- zone/outlet target;
- schedule/due date;
- instructions;
- lifecycle/status history;
- associated visit(s);
- relevant map context;
- reassignment/cancellation actions if authorised.

## 20. Bulk Assignment Workspace

A focused workflow rather than a generic database bulk editor.

Suggested layout:

```text
Unassigned Zones / Outlets        Field Workers
--------------------------        ------------------
Zone A                            Worker 1
Zone B                            Worker 2
Zone C                            Worker 3

Allocation Preview
---------------------------------------------------
Zone A -> Worker 1
Zone B -> Worker 2

[Confirm Assignments]
```

Future optimisation may recommend allocation; MVP allows human-controlled deterministic assignment.

## 21. Project Field Workers

Route:

`/projects/{projectId}/field-workers`

Display:

```text
Worker
Status
Assigned
Started
Submitted
Accepted
Returned
Last Activity
Coverage Contribution
```

Selecting worker opens project-specific worker panel/detail.

## 22. Field Worker Project Detail

Show only operationally relevant information:

- participation status;
- assignments;
- submissions;
- accepted/returned work;
- correction backlog;
- daily activity summary;
- coverage contribution;
- configured quality indicators.

Avoid turning this screen into an HR personnel file.

## 23. Project Outlets

Route:

`/projects/{projectId}/outlets`

Display:

```text
Outlet
Reference
Area / Zone
Source
Status
Last Visit
QA
Match Status
```

Filters:

- known vs discovered;
- zone;
- status;
- QA;
- duplicate/match state;
- outlet type.

Actions:

- open outlet;
- open latest visit;
- review match;
- export if authorised.

## 24. Workspace Outlet Registry

Top-level route:

`/outlets`

Purpose: longitudinal outlet search beyond one project.

Search/filter by:

- outlet name;
- customer code;
- geography;
- type;
- status;
- last observed;
- match state.

This screen displays workspace-authorised outlet knowledge, not automatically the entire TES Market Universe.

## 25. Outlet Detail

Route:

`/outlets/{workspaceOutletId}`

Recommended tabs:

```text
Overview
Visit History
Evidence
Client References
Match / Identity
```

Overview:

- stable outlet name/reference;
- map/location;
- status;
- type;
- first/last observed;
- latest accepted visit summary;
- aliases where permitted;
- Market Universe link state where authorised.

## 26. Outlet Visit History

Timeline presentation:

```text
07 Sep 2026
Mahikeng WTS
Accepted
[Open Visit]

28 Aug 2026
Verification Project
Accepted
[Open Visit]
```

This visually reinforces the core architecture:

> **Outlet persists; visits accumulate.**

## 27. Match / Identity Screen

Used for duplicate resolution and Market Universe linkage where authorised.

Layout:

```text
CURRENT WORKSPACE OUTLET        POSSIBLE MATCH
Shop ABC                        Shop ABC Supermarket
GPS ...                         GPS ...
Photo                           Photo
Client ref ...                  Known aliases ...

Distance: 7m
Name similarity: High
Rule confidence: 94%

[Link Existing]
[Not Same]
[Needs Review]
```

If rights permit creation of a Market Universe outlet, that action appears only to appropriately authorised reviewers.

## 28. Project Visits

Route:

`/projects/{projectId}/visits`

Operational list of field events.

Columns:

```text
Visit
Outlet
Worker
Zone
Submitted
Duration
GPS
Evidence
Validation
QA Status
```

Filters support rapid investigation.

## 29. Visit Detail / Review

Route:

`/visits/{visitId}`

Recommended desktop layout:

```text
+--------------------------------------------------------------+
| Visit / Outlet / Status / Worker / Time                      |
+-------------------------------+------------------------------+
| Survey Responses              | Map / GPS                    |
|                               |                              |
| Sections                      | Evidence                     |
| Answers                       | Photos                       |
|                               |                              |
+-------------------------------+------------------------------+
| Validation Results / QA History                              |
+--------------------------------------------------------------+
```

Actions depend on role/state:

- accept;
- return for correction;
- flag/escalate;
- reopen;
- resolve duplicate;
- inspect audit/history.

## 30. QA Top-Level Screen

Route:

`/qa`

Purpose:

> **Show everything requiring quality attention in the current workspace.**

Cards:

```text
Awaiting Review
High-Risk Flags
Returned
Duplicate Review
Overdue QA
```

Queue below with filters by project, worker, zone, validation type and age.

## 31. Project QA Screen

Route:

`/projects/{projectId}/qa`

Same QA workflow scoped to one project.

Prioritisation:

1. blocking/high-risk flags;
2. duplicate identity concerns;
3. GPS/evidence concerns;
4. normal submitted visits.

This enables exception-based QA later without redesigning the screen.

## 32. QA Review Mode

QA should support efficient repeated review.

After accepting/returning one visit, user can move directly to next queued item.

Example footer:

```text
[Return for Correction]       [Accept & Next]
```

Confirmation should be proportional to risk; do not require excessive modal confirmations for routine acceptance.

## 33. Return for Correction Dialog

Structured reasons:

```text
[ ] Photo unclear
[ ] GPS issue
[ ] Missing information
[ ] Conflicting answer
[ ] Wrong classification
[ ] Possible duplicate
[ ] Revisit required
[ ] Other

Notes: ______________________

[Return to Worker]
```

Returned fields/sections should be identifiable where possible.

## 34. Survey Screen

Route:

`/projects/{projectId}/survey`

Shows:

- Survey Definition;
- active version;
- publication state;
- sections/questions;
- version history.

Actions:

```text
Preview
Create New Version
Publish Draft
View Previous Version
```

Published version cannot be edited.

## 35. Survey Builder Layout

Recommended desktop structure:

```text
+----------------+----------------------------+----------------+
| Sections       | Survey Canvas              | Properties     |
|                |                            |                |
| Outlet ID      | Q1 Outlet name             | Type           |
| Category       | Q2 Outlet type             | Required       |
| Evidence       | Q3 Storefront photo        | Validation     |
|                |                            | Options        |
+----------------+----------------------------+----------------+
```

MVP may use simpler forms initially, but the architecture should support this eventual efficient builder layout.

## 36. Survey Preview

Preview should emulate the Field Worker mobile experience.

Project Manager can test:

- section order;
- required fields;
- conditional questions;
- photo requirements;
- validation messages.

Preview never writes production visits.

## 37. Reports Screen

Top-level:

`/reports`

Project-specific:

`/projects/{projectId}/reports`

Display:

- daily summaries;
- generated reports;
- export jobs;
- status;
- creator;
- creation time;
- expiry where applicable.

Primary actions:

```text
Generate Report
Create Export
```

## 38. Export Wizard

Steps:

```text
1 Dataset
2 Filters
3 Fields
4 Evidence Options
5 Review
6 Generate
```

Dataset examples:

- outlets;
- visits;
- responses;
- QA;
- coverage.

Only authorised fields/options are presented, and the API independently revalidates them.

## 39. Field Team Top-Level Screen

Route:

`/field-team`

Workspace-wide operational directory/view.

Display:

- worker;
- organisation;
- active project(s);
- status;
- today's assignments;
- today's submissions;
- correction backlog.

This is not a payroll/HR screen.

## 40. Administration

Route:

`/admin`

Sections may include:

```text
Organisations
Workspaces
Users & Membership
Roles / Access
Configuration
Audit Activity
```

Only authorised administrative sections are returned/displayed.

## 41. User & Membership Administration

Admin should distinguish:

```text
User Identity
Organisation Membership
Workspace Membership
Workspace Role / Permissions
Project Participation
```

Do not collapse these into one generic role dropdown.

This helps preserve the architecture's contextual access model.

## 42. Field Worker PWA Shell

Mobile navigation should use a small bottom navigation bar.

Recommended:

```text
Today     Assignments     Map     Sync
```

Profile/help is accessed from the header/menu rather than consuming a primary bottom-navigation slot.

Example:

```text
+-----------------------------+
| Survey Guru          [User] |
+-----------------------------+
|                             |
|       SCREEN CONTENT        |
|                             |
+-----------------------------+
| Today | Tasks | Map | Sync  |
+-----------------------------+
```

## 43. Field Today Screen

Route concept:

`/field/today`

Top:

```text
Good morning, [Name]
Monday, 7 September
[Online / Offline]
```

Priority order:

### Corrections

Returned work appears first if action is required.

### Today's Progress

```text
3 / 12 assignments completed
8 visits submitted
2 pending sync
```

### Next Assignments

Cards showing:

- type;
- outlet/zone;
- priority;
- approximate distance where available;
- status;
- primary action.

## 44. Field Assignment Card

Known outlet:

```text
SURVEY OUTLET
Shop ABC
Zone 4
1.2 km

[Open]
```

Coverage assignment:

```text
SEARCH ZONE
Zone 14
Coverage: 34%
Priority: High

[Open Map]
```

Returned visit:

```text
CORRECTION REQUIRED
Shop XYZ
Reason: Storefront photo unclear

[Fix Visit]
```

## 45. Field Assignments Screen

Route:

`/field/assignments`

Tabs/filters:

```text
Today
Upcoming
Completed
Corrections
```

Only the worker's authorised assignments are returned.

## 46. Field Assignment Detail

Display:

- assignment type;
- target outlet/zone;
- instructions;
- due information;
- map preview;
- survey type;
- offline readiness.

Primary action varies:

```text
Start Assignment
Navigate
Continue
Submit Correction
```

## 47. Field Map

Route:

`/field/map`

Designed for outdoor mobile use.

Show only necessary authorised layers:

- assigned zone;
- known assigned outlets;
- own discovered outlets;
- current location;
- required coverage context.

Primary floating action when discovery permitted:

`+ Discover Outlet`

## 48. Discover Outlet Screen

Flow:

```text
Capture Location
      |
Nearby Match Check
      |
Confirm Existing / New Candidate
      |
Storefront Evidence
      |
Begin Survey
```

Screen 1:

```text
Discover Outlet

GPS: 5 m accuracy ✓

Outlet name
[________________]

[Check Nearby Outlets]
```

## 49. Nearby Outlet Match Screen

If candidates exist:

```text
Possible Existing Outlet

Shop ABC
7 m away
Last observed: 28 Aug

[Use Existing]
[Not the Same]
```

If multiple candidates exist, show concise cards sorted by confidence/distance.

Do not make the Field Worker decide complex permanent Market Universe merges.

## 50. Field Visit Screen

Route:

`/field/visits/{visitId}`

Mobile layout:

```text
Shop ABC
GPS 6m ✓        Saved locally ✓

Progress 8 / 12
-----------------------------
Outlet Identity        ✓
Store Classification   ✓
Bread Category         3/5
Competitors             -
Evidence                -
-----------------------------

[Continue Survey]
```

This section summary lets a worker see completeness without scrolling through an entire long form.

## 51. Mobile Question Screen

One question or small logical group at a time where practical.

Example:

```text
Bread Category

Which bread brands are currently available?

[ ] Blue Ribbon
[ ] Albany
[ ] Sasko
[ ] Other

[Back]                 [Next]
```

For fast surveys, grouped questions may be more efficient than strictly one question per page. The builder should allow the UX to balance speed and clarity.

## 52. Field Photo Screen

```text
Storefront Photo *

[ Camera Preview ]

Photo must clearly show the storefront and signage.

[Retake]             [Use Photo]
```

After capture:

```text
Saved on device
Upload pending
```

when offline.

## 53. GPS Quality UI

Use understandable states:

```text
Location accurate ✓
Improving location...
Poor location accuracy — Retry
Location unavailable
```

Show numerical accuracy where useful, but workers should not need GIS knowledge to interpret it.

## 54. Capture Validation UI

Severity patterns:

### Blocking

```text
Cannot submit yet
Storefront photo is required.
```

### Warning

```text
GPS accuracy is 48 m.
Try again before submitting.

[Retry GPS] [Continue Anyway]
```

where project policy allows continuation.

### QA Flag

```text
Saved — this visit may be reviewed by QA.
```

Avoid exposing internal fraud/security rules unnecessarily.

## 55. Visit Review & Submit

Before final submission:

```text
Visit Review

Required questions       ✓
Storefront photo         ✓
GPS                      ✓
Warnings                 1

1 warning:
Possible existing outlet nearby

[Review Warning]

[Submit Visit]
```

Submission is explicit; accidental navigation must not silently submit.

## 56. Submitted Visit Screen

```text
Visit Submitted

Shop ABC
14:42

Status: Waiting for QA

[Back to Today]
```

If offline:

```text
Saved for Sync
This visit will submit when a connection is available.
```

The UI must clearly distinguish locally completed from server-confirmed submitted.

## 57. Correction Workflow

Returned item opens directly to the reason and affected section.

```text
Correction Required

Shop ABC

Reason:
Storefront photo unclear

QA note:
Please retake the front of the store showing the trading name.

[Retake Photo]
```

After correction:

`Review Correction -> Resubmit`

## 58. Field Sync Screen

Route:

`/field/sync`

Simple status groups:

```text
All Synced ✓
```

or

```text
Pending (3)
- Shop ABC visit
- Shop XYZ photo
- Zone 14 search activity

Needs Attention (1)
- Visit SG-VST-...   [Retry]
```

Include:

`Sync Now`

when manual retry is appropriate.

## 59. Offline Banner

When offline, show a persistent but non-obstructive banner:

```text
Offline — your work is being saved on this device.
```

When connection returns:

```text
Back online — syncing 4 items...
```

Then:

```text
All work synced ✓
```

## 60. Field Profile / Help

Accessible from header/user menu.

Functions:

- worker name/reference;
- current organisation;
- app version;
- connectivity/sync diagnostics;
- basic capture help;
- sign out;
- future device registration/support info.

Do not expose unnecessary administrative profile editing.

## 61. Responsive Management Behaviour

Management app should support desktop and tablet well.

On smaller screens:

- left navigation collapses;
- tables may become cards or horizontally scroll with prioritised columns;
- map side panels become bottom sheets;
- filters become drawers;
- critical actions remain reachable.

Complex project administration need not be optimised for small phones to the same degree as the Field PWA.

## 62. URL / Deep-Link Architecture

Stable routes should permit bookmarks and notification deep-links.

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
/field-team
/reports
/admin

/field/today
/field/assignments
/field/assignments/{assignmentId}
/field/map
/field/visits/{visitId}
/field/sync
```

Route existence does not grant access. API security and server-side page protections apply.

## 63. Breadcrumbs

Use breadcrumbs for management depth, e.g.:

```text
Projects > Mahikeng WTS > Visits > SG-VST-001842
```

Avoid breadcrumbs in the Field PWA where they add complexity without field value.

## 64. Status Vocabulary

Status terms must remain consistent across screens.

Project:

`Draft | Configured | Active | Paused | Completed | Archived`

Assignment:

`Assigned | Accepted | In Progress | Submitted | Completed | Reassigned | Cancelled`

Visit:

`Capturing | Saved Offline | Syncing | Submitted | Review Required | Correction Required | Accepted`

Coverage:

`Unvisited | In Progress | Searched | Verified`

Evidence:

`Pending Upload | Uploaded | Validating | Accepted | Replacement Required`

Do not invent different synonyms on different screens.

## 65. Empty States

Every operational screen should explain what to do when empty.

Example Projects:

```text
No projects yet
Create your first Survey Guru project to begin configuring fieldwork.

[Create Project]
```

Example Field Today:

```text
No assignments for today
You're up to date. Pull down to refresh if your supervisor has just assigned work.
```

Empty states should not look like application errors.

## 66. Loading States

Use skeleton/loading indicators for expected short waits.

For slow background processes such as exports/imports:

- create a job;
- show status;
- allow user to leave screen;
- notify on completion.

Do not keep users staring at a blocking spinner during long processing.

## 67. Error States

Errors should be actionable and not expose backend internals.

Examples:

```text
We couldn't load this project.
[Retry]
```

```text
You no longer have access to this assignment.
Return to Today.
```

```text
This visit changed while you were offline.
Review the latest version before resubmitting.
```

## 68. Confirmation Patterns

Use confirmation for high-impact actions:

- project archive;
- survey publish;
- assignment cancellation/reassignment where work exists;
- QA override;
- outlet identity merge;
- Market Universe promotion;
- bulk export;
- membership revocation.

Routine actions should not be slowed by unnecessary confirmation dialogs.

## 69. Unsaved Work Protection

Management forms warn before abandoning meaningful unsaved changes.

Field capture automatically persists locally as the worker progresses.

A field worker should not lose a survey because they accidentally close the app, switch screens or temporarily lose connectivity.

## 70. Permission-Aware UX

Examples:

- Client Viewer does not see Field Team management actions;
- Analyst may see reports but not assignment controls;
- Field Worker receives no management shell;
- QA sees review actions only where permitted;
- Market Universe actions appear only to separately authorised users.

However:

> **Hidden controls are convenience, not security.**

Every corresponding API operation must independently reject unauthorised callers.

## 71. Client Viewer Navigation

Client Viewer can use a simplified management shell:

```text
Dashboard
Projects
Map
Reports
```

Within project:

```text
Overview
Map
Accepted Results
Reports
```

Taskraft internal QA/worker management and TES Market Universe controls remain absent.

## 72. Map Technology Abstraction

The UI architecture should not bind product navigation to a single GIS vendor.

Conceptual map components consume Survey Guru APIs/layers:

```text
SurveyGuruMap
CoverageLayer
OutletLayer
ZoneLayer
FieldActivityLayer
```

The underlying map rendering provider may be evaluated separately (e.g. MapLibre/other suitable provider), while ArcGIS remains available for professional GIS workflows and PostGIS/H3 form the long-term TES geospatial data/intelligence core.

## 73. Screen-Level Data Loading Principle

Screens request purpose-specific API views rather than downloading whole collections.

Examples:

```text
Project Overview -> project summary API
Project Map -> bounded/layer API
QA -> paginated QA queue API
Field Today -> own-assignment summary API
Outlet Detail -> authorised outlet detail API
```

This improves security, performance and migration readiness.

## 74. Analytics Interaction Principle

MVP dashboards should favour actionable drill-down.

Example:

`84 Awaiting QA` -> opens filtered QA queue.

`12 Unvisited Cells` -> opens map filtered to unvisited.

`Worker has 5 Corrections` -> opens that worker's correction queue.

A metric without an operational path should be questioned before adding it.

## 75. Screen Inventory — Management MVP

Required management screens:

1. Login/authentication
2. Workspace Dashboard
3. Projects
4. New Project Wizard
5. Project Overview
6. Project Map & Coverage
7. Project Assignments
8. Assignment Detail
9. Bulk Assignment
10. Project Field Workers
11. Field Worker Project Detail
12. Project Outlets
13. Workspace Outlet Registry
14. Outlet Detail
15. Match / Identity Review
16. Project Visits
17. Visit Detail
18. Workspace QA
19. Project QA
20. QA Review / Correction
21. Project Survey
22. Survey Builder
23. Survey Preview
24. Reports
25. Export Wizard
26. Field Team
27. Administration
28. Users / Membership
29. Audit Activity
30. Import Wizard
31. Import Result / Error Review

## 76. Screen Inventory — Field MVP

Required field screens:

1. Login/authentication
2. Today
3. Assignments
4. Assignment Detail
5. Field Map
6. Discover Outlet
7. Nearby Match Check
8. Visit Summary
9. Survey Question / Section Capture
10. Photo Capture
11. GPS Retry/Status
12. Visit Review
13. Submitted / Saved for Sync
14. Correction Detail
15. Sync Centre
16. Profile / Help

## 77. Critical End-to-End Navigation — Project Manager

```text
Login
 -> Dashboard
 -> Projects
 -> New Project
 -> Configure Survey
 -> Define Geography
 -> Add Field Team
 -> Create Assignments
 -> Activate
 -> Project Overview
 -> Map / Monitor
 -> QA / Exceptions
 -> Reports / Export
```

## 78. Critical End-to-End Navigation — Field Worker

```text
Login
 -> Today
 -> Assignment
 -> Map / Navigate
 -> Discover or Select Outlet
 -> Duplicate Check
 -> Visit
 -> Survey
 -> Photos / GPS
 -> Review
 -> Submit
 -> Sync if needed
 -> Today
```

## 79. Critical End-to-End Navigation — QA

```text
Login
 -> QA Queue
 -> Visit Review
 -> Evidence / GPS / Responses
 -> Accept
      OR
 -> Return for Correction
 -> Next Visit
```

## 80. Critical End-to-End Navigation — Coverage Investigation

```text
Project Overview
 -> Coverage metric
 -> Map filtered to Unvisited/Searched
 -> Select Zone/Cell
 -> Inspect search effort/outlets
 -> Review worker activity
 -> Create/Reassign coverage assignment
```

This is a foundational Survey Guru operational loop.

## 81. Critical End-to-End Navigation — Outlet Identity

```text
Duplicate Flag
 -> Match Review
 -> Compare locations/names/evidence
 -> Link Existing
      OR
 -> Keep Separate
      OR
 -> Escalate
 -> Record decision
```

Future AI confidence can plug into this flow without replacing human review.

## 82. MVP UX Acceptance Criteria

The navigation design is successful when:

1. Project Manager can reach any major project operation within a small number of predictable clicks.
2. Field Worker can begin today's work immediately after login.
3. Field Worker can complete a normal visit without entering management screens.
4. Offline/sync status is always understandable.
5. QA can review consecutive visits efficiently.
6. Map/coverage drill-down connects directly to operational actions.
7. Outlet history clearly distinguishes outlet identity from visits.
8. Client Viewer cannot accidentally enter Taskraft internal workflows.
9. Status vocabulary is consistent.
10. Direct URL manipulation provides no extra authority.
11. Large project screens use bounded/paginated data rather than whole-dataset loading.
12. Critical errors provide a clear recovery path.

## 83. Locked Screen & Navigation Decisions

1. Survey Guru has separate management and Field Worker experiences.
2. Field PWA is task-focused, not a compressed admin application.
3. Management shell uses workspace context and project command centres.
4. Project Map & Coverage is a core operational screen.
5. Project-level tabs are Overview, Map & Coverage, Assignments, Field Workers, Outlets, Visits, QA, Survey, Reports and Settings.
6. Field bottom navigation is Today, Assignments, Map and Sync.
7. Returned corrections appear prominently on Field Today.
8. Field capture autosaves locally.
9. Locally completed and server-submitted states are visibly different.
10. Outlet duplicate checking occurs before blindly creating a new outlet.
11. Complex outlet merge/promotion decisions are not delegated to ordinary Field Workers.
12. QA is designed for exception-based/high-throughput review.
13. Coverage metrics drill into map/cell details and operational action.
14. Client Viewer receives a simplified restricted shell.
15. Export uses a controlled wizard, not generic database download.
16. Stable deep links are supported, but routes do not grant access.
17. Map implementation is provider-abstracted.
18. Screens consume purpose-specific APIs, not direct broad database collections.
19. UX permissions never replace API/backend authorisation.
20. Screen architecture is designed to accept future AI recommendations without restructuring the core workflow.

## 84. Next Product Specification

The next design document should be:

**Survey Guru Field Capture & Offline Workflow Specification v1.0**

It should define in implementation detail:

- assignment download/readiness;
- local device data model;
- survey autosave;
- offline outlet creation;
- GPS capture/retry;
- evidence/photo queue;
- visit state machine;
- sync queue;
- idempotency;
- partial upload failure;
- conflict handling;
- revoked assignment behaviour;
- app restart/recovery;
- worker-facing error states;
- server acknowledgement states;
- data cleanup after successful sync.

This is the highest-risk operational area of the MVP because Survey Guru must work reliably where field connectivity is poor.

---

This is a living TES product-design specification. Material screen, workflow or navigation changes must be version-controlled in the Survey Guru repository.