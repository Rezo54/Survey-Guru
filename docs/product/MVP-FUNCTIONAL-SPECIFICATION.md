# Survey Guru MVP Functional Specification v1.0

**Product Owner:** TES — Task Expert Systems  
**Operational / Field Partner:** Taskraft (Pty) Ltd  
**Status:** MVP Product Baseline / Living Document  
**Version:** 1.0  
**Date:** 7 September 2026

## 1. Purpose

This document defines the first usable production version of Survey Guru.

The MVP must solve Taskraft's real field-survey workflow exceptionally well while creating the permanent foundations for TES market intelligence, the Coverage Engine and future integration with Fleetwize.

The MVP is not merely a digital questionnaire.

> **Survey Guru MVP is a field-survey operating system built around projects, geography, permanent outlet identity, assignments, visits, evidence, validation and coverage.**

The product must already begin answering two questions:

1. **What have we found?**
2. **Where have we actually searched?**

Future versions add progressively stronger answers to:

3. **What don't we know?**
4. **Where should we go next?**
5. **What should the client do?**

## 2. MVP Outcome

At the end of MVP development, Taskraft must be able to run a WTS/market-survey project from setup through final export without relying on spreadsheets as the operational system of record.

The system must support:

```text
Create Workspace / Project
        |
Define Survey
        |
Define Geography / Zones
        |
Add Field Workers
        |
Create Assignments
        |
Field Workers Survey / Discover Outlets
        |
Capture GPS + Answers + Photos
        |
Validate Data
        |
Track Coverage + Progress
        |
Correct Exceptions
        |
Accept Results
        |
Dashboard / Export / Report
```

## 3. MVP Product Principles

1. Mobile-first field experience.
2. Permanent outlet thinking from day one.
3. Survey visit is separate from outlet identity.
4. Geography and coverage are first-class.
5. Offline-capable field capture.
6. Real-time/near-real-time operational visibility.
7. Data quality moves toward the point of capture.
8. Human-in-the-loop for uncertain matching/QA.
9. Client data boundaries are explicit.
10. API/backend is the security authority.
11. MVP data structures must remain migration-ready for PostgreSQL/PostGIS.
12. Do not build intelligence theatre: show only metrics/confidence the system can support.

## 4. MVP Users

### TES Platform Administrator

Sets up platform-level organisations/workspaces and manages authorised system configuration.

### Workspace Administrator

Manages workspace membership, project access and authorised workspace configuration.

### Project Manager

Creates/configures projects, surveys, zones, field teams, assignments, progress and exports.

### Field Supervisor

Operational view of surveyor deployment, productivity, coverage and exceptions. May be represented initially through Project Manager permissions or a dedicated role if needed.

### Field Worker

Receives assignments, navigates to target geography/outlets, discovers/captures outlets, completes surveys, uploads evidence and corrects returned work.

### QA / Validator

Reviews submitted visits, photographs, GPS and validation flags; accepts or returns records for correction.

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

Users with access to more than one workspace select an authorised workspace after login or through a workspace switcher.

The application displays only workspaces returned by the authorised API.

Switching workspace changes the application context but does not itself grant permissions.

## 7. Management Home Dashboard

The home dashboard should answer:

> **What requires my attention right now?**

MVP cards/metrics may include:

- active projects;
- today's submitted visits;
- outlets captured;
- visits awaiting QA;
- rejected/returned visits;
- active field workers;
- unsynchronised field activity where known;
- projects behind expected trajectory;
- coverage summary.

Clicking a metric drills into the relevant authorised project/list.

## 8. Project List

Display:

- project name;
- client/workspace;
- geography/market;
- status;
- start/end dates;
- expected outlet count;
- captured/accepted outlet or visit count;
- coverage status;
- assigned field workers;
- progress indicator.

Filters:

- status;
- client/workspace where applicable;
- geography;
- date range;
- project manager.

## 9. Project Creation Wizard

Project setup should be guided rather than one large form.

### Step 1 — Project Identity

- project name;
- project code;
- client organisation;
- operating organisation;
- start date;
- target completion date;
- expected outlet count;
- project description/objective.

### Step 2 — Survey

Choose:

- existing Survey Definition; or
- create new Survey Definition.

Select/publish the survey version that the project will use.

### Step 3 — Geography

Define/import project geography and operational zones.

### Step 4 — Field Team

Add eligible Field Workers to the project.

### Step 5 — Assignment Strategy

Create geographic/outlet assignments.

### Step 6 — Review & Activate

Show project configuration summary and validation errors before activation.

## 10. Project Overview

Each project has a project command centre.

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

Overview displays:

- project status;
- target vs captured;
- accepted vs awaiting QA;
- expected-to-date vs actual where configured;
- coverage summary;
- field-worker activity;
- recent submissions;
- outstanding corrections;
- warnings/exceptions.

## 11. Survey Builder

The MVP requires a practical configurable survey builder.

Supported question types should include at minimum:

- short text;
- long text;
- integer/decimal number;
- yes/no;
- single choice;
- multiple choice;
- date;
- phone number;
- photo;
- GPS/location confirmation;
- optional signature if operationally justified.

Question configuration:

- prompt;
- help text;
- required/optional;
- section;
- sort order;
- allowed options;
- numeric min/max;
- text length;
- conditional visibility where practical;
- evidence/photo requirement;
- observation mapping key where applicable.

## 12. Survey Sections

Questions can be grouped into sections such as:

```text
Outlet Identity
Store Classification
Bread Category
Brand Availability
Competitor Activity
Equipment / Displays
Owner / Contact
Evidence
```

Sections improve mobile usability and future analytics mapping.

## 13. Survey Versioning

Draft surveys can be edited.

Once published:

> **The published version is immutable.**

If questions change, create a new version.

Visits retain the exact survey version used at capture time.

Project Manager must see which version is currently active.

## 14. Geography Setup

MVP geography should support:

- project boundary;
- custom operational zones;
- imported geographic boundaries where supported;
- centroid/bounds;
- map visualisation;
- assignment by zone.

Initial import formats may include GeoJSON and/or KML/KMZ where implementation effort permits. CSV latitude/longitude import is required for outlet/customer seed data.

Complex GIS authoring may remain in ArcGIS/QGIS/other professional tools initially, with Survey Guru importing the resulting operational geography.

## 15. Coverage Grid

When a project is activated, Survey Guru can generate or associate coverage cells across the project geography.

MVP states:

```text
Unvisited
In Progress
Searched
Verified
```

The map must visually distinguish these states.

The purpose is not merely presentation; coverage state is stored as operational data.

## 16. Field Worker Management

Project Manager can:

- view available Field Workers;
- add/remove project participation;
- see status;
- see assigned zones/tasks;
- see current project productivity;
- see outstanding corrections;
- suspend future assignments where permitted.

Survey Guru should not require a Field Worker to be a Taskraft employee.

## 17. Assignment Creation

MVP assignment types:

- survey known outlet;
- discover outlets in zone;
- verify outlet;
- re-survey outlet;
- cover/search zone;
- QA revisit;
- investigate anomaly.

Assignment creation supports:

- Field Worker;
- project;
- zone;
- optional outlet;
- scheduled date;
- due date/time;
- priority;
- instructions.

## 18. Bulk Assignment

Project Manager should be able to assign multiple outlets/zones without manually creating each assignment.

Examples:

- assign Zone A to Worker 1;
- assign Zone B to Worker 2;
- distribute selected outlets across selected workers;
- reassign incomplete tasks.

MVP bulk assignment may use simple deterministic allocation rather than AI optimisation.

## 19. Field Worker — Today Screen

The first screen after field login should answer:

> **What do I need to do today?**

Display:

- today's assignment count;
- assigned zone/map;
- priority tasks;
- known outlets to visit;
- discovery/coverage tasks;
- returned corrections;
- sync status;
- simple progress for the day.

Avoid exposing unnecessary project-wide information.

## 20. Field Map

Field Worker map should show only authorised context:

- assignment zone;
- known assigned outlets;
- own captured outlets/visits where useful;
- current location when permission granted;
- coverage context required for assignment;
- selected navigation destination.

Future versions can show predicted opportunity locations.

## 21. Start Assignment

Worker opens assignment and sees:

- assignment type;
- instructions;
- zone/outlet;
- map;
- survey required;
- outstanding tasks;
- offline availability status.

Worker selects **Start**.

System records start event/time when possible.

## 22. Discover Outlet Workflow

For discovery assignments:

1. worker reaches outlet;
2. selects **Add / Discover Outlet**;
3. app captures current GPS and accuracy;
4. worker enters/confirms outlet name;
5. app checks nearby authorised outlet candidates;
6. worker selects existing candidate or creates candidate workspace outlet;
7. storefront photo captured where required;
8. visit begins/continues;
9. survey completed;
10. submission enters validation/QA.

## 23. Duplicate / Existing Outlet Check

MVP must include basic duplicate prevention from day one.

Signals may include:

- distance;
- normalised outlet name;
- known client reference;
- existing workspace outlet;
- permitted Market Universe candidate.

Example UX:

```text
Possible existing outlet
Shop ABC
7 m away
Last observed: 28 Aug 2026

[Use Existing] [Not the Same]
```

MVP confidence may be rules-based rather than AI-based.

If uncertain, system can flag for QA rather than force an irreversible merge.

## 24. Visit Capture

A visit should display:

- outlet identity;
- capture GPS/accuracy;
- survey sections;
- completion indicator;
- required photo status;
- save/offline status;
- validation warnings.

The worker can move between sections without losing captured data.

## 25. GPS Capture

At visit start/capture, record where permitted:

- latitude;
- longitude;
- accuracy;
- timestamp.

The UI should warn when GPS accuracy is poor and allow retry.

The system must distinguish captured device GPS from manually corrected/verified outlet location.

Manual location overrides require reason and later audit/QA where enabled.

## 26. Photo Capture

MVP should support camera-first capture for required evidence.

Requirements:

- storefront photo where project requires it;
- question-specific photos;
- preview before acceptance;
- retake;
- upload/sync status;
- compressed/mobile-appropriate file handling while preserving adequate QA quality.

Future AI photo-quality checks should be anticipated in metadata/workflow.

## 27. Real-Time Capture Validation

Initial validation rules should include where applicable:

- required question missing;
- required photo missing;
- poor/missing GPS;
- duplicate candidate nearby;
- invalid phone/number format;
- value outside configured range;
- visit duration anomaly;
- impossible movement between consecutive visits;
- outlet outside assigned geography beyond tolerance.

Rules may produce:

```text
BLOCK
WARN
FLAG_FOR_QA
```

Not every anomaly should prevent field submission.

## 28. Visit Submission

Before submission show a concise review:

- required fields complete;
- evidence complete;
- GPS state;
- warnings;
- sync state.

Worker selects **Submit Visit**.

Submitted visits become read-only to Field Worker unless returned for correction or explicitly reopened by an authorised user.

## 29. Offline Operation

Field Worker must be able to continue core assigned work during connectivity loss.

Offline package includes only minimum authorised context:

- own assignments;
- required survey version;
- relevant zone/outlet context;
- unsent responses/evidence.

UI clearly shows:

- online/offline;
- saved locally;
- pending sync count;
- sync failure;
- successfully synced.

When connection returns, operations sync through the authorised API and are revalidated.

## 30. Sync Centre

Field app includes a simple Sync screen showing:

```text
Synced
Pending
Failed / Needs Attention
```

User can retry failed items.

Do not require the worker to understand technical queue terminology.

## 31. Field Worker Daily Progress

Field Worker may see own project/day metrics such as:

- assignments completed;
- outlets/visits submitted;
- accepted;
- returned;
- pending sync.

Avoid competitive/gamified metrics in MVP unless operationally justified.

## 32. Supervisor / Project Operations View

Project Manager/Supervisor needs near-real-time operational visibility.

Display by worker:

- assigned tasks;
- started;
- submitted;
- accepted;
- returned;
- last submission time;
- outlets discovered;
- approximate coverage contribution;
- warnings/exceptions.

The system should help identify workers who need assistance before the project falls behind.

## 33. Project Map

The management map is a major MVP screen.

Layers/toggles:

- project boundary;
- operational zones;
- coverage cells;
- known/seed outlets;
- newly discovered outlets;
- accepted outlets;
- duplicate candidates;
- QA flags;
- field-worker activity/trails where permitted and configured.

Filters:

- date;
- worker;
- zone;
- QA state;
- outlet type/status;
- coverage state.

## 34. Surveyor Movement / Search Evidence

Where project policy permits, Survey Guru should collect privacy-conscious movement/search evidence sufficient to determine whether geography was actually searched.

MVP should favour sampled location events or coverage events over permanent second-by-second surveillance.

The purpose is operational coverage evidence, not employee monitoring unrelated to the survey.

Movement data has explicit retention and access controls.

## 35. Coverage Dashboard

Display at minimum:

- project area/cells;
- unvisited cells;
- in-progress cells;
- searched cells;
- verified cells;
- percentage searched/verified;
- outlets found by zone/cell;
- zero-outlet searched cells;
- last searched time.

This becomes the first practical implementation of Survey Guru's principle:

> **Know what we don't know.**

## 36. Expected vs Actual Progress

Project can optionally define expected outlet count and project dates.

Dashboard shows:

- expected total;
- captured to date;
- accepted to date;
- expected progress by current date;
- variance;
- estimated remaining work using simple rules.

MVP should label estimates clearly and avoid pretending simple projections are AI predictions.

## 37. QA Queue

QA user sees submitted visits requiring review.

Filters:

- project;
- worker;
- zone;
- submission date;
- validation flag;
- duplicate candidate;
- GPS warning;
- evidence warning;
- QA status.

Prioritise flagged/high-risk visits above clean visits where configured.

## 38. QA Visit Review

Single review screen should bring together:

- outlet identity;
- map/GPS;
- visit timestamps;
- survey answers;
- photos/evidence;
- automated validation results;
- duplicate candidates;
- previous outlet history where authorised;
- worker information required for QA.

Actions:

```text
Accept
Return for Correction
Flag / Escalate
Resolve Duplicate
Correct permitted reference data
```

## 39. Return for Correction

QA selects reason(s), for example:

- photo unclear;
- GPS issue;
- missing answer;
- conflicting answer;
- duplicate outlet;
- incorrect classification;
- revisit required.

Field Worker sees returned item prominently on Today screen.

Only fields permitted by the correction request/lifecycle should reopen.

## 40. Outlet Registry

Management users with permission can search workspace outlets by:

- name;
- client customer code;
- area;
- map;
- outlet type;
- status;
- last observed date.

Outlet detail should show:

- stable identity/location;
- aliases;
- client references;
- project/visit history permitted in current workspace;
- latest evidence where authorised;
- duplicate/match state;
- Market Universe linkage status where user has permission.

## 41. Outlet History

A permanent outlet must support longitudinal history.

Example:

```text
Outlet: SG-OUT-0001842

Aug 2026 - Project A - Visit accepted
Sep 2026 - Project B - Visit accepted
Nov 2026 - Verification visit
```

Changing observations are viewed through visits/observations rather than overwriting outlet identity.

## 42. Client Customer Seed Import

Project Manager can import a CSV/Excel-compatible dataset of known client customers/outlets.

Minimum useful fields:

- customer code;
- customer name;
- latitude;
- longitude;
- optional address/area;
- optional route/territory/reference fields.

Import flow:

1. upload;
2. map columns;
3. validate;
4. preview errors;
5. confirm import;
6. create workspace outlet/client reference candidates;
7. match/duplicate checks;
8. show import result summary.

Imports are audited and do not automatically promote records into TES Market Universe.

## 43. General Data Import

MVP should support controlled imports required for real projects, particularly:

- known outlet/customer lists;
- Field Worker setup where needed;
- geography/zone definitions;
- project configuration templates later.

Do not expose generic arbitrary database imports.

## 44. Reports / Exports

MVP outputs should include:

- visit-level CSV/XLSX-compatible export;
- outlet-level export;
- response export;
- QA status export;
- coverage summary export;
- evidence/photo reference export where authorised;
- project summary report data.

Exported datasets include stable IDs so data can be reconciled across exports.

## 45. Daily Project Report

MVP should be capable of producing a daily project summary containing:

- date;
- active workers;
- visits submitted;
- visits accepted;
- outlets discovered;
- cumulative total;
- target/progress;
- coverage progress;
- QA backlog;
- key exceptions.

Initial delivery may be download/view; automated email/Slack distribution can follow once core reporting is stable.

## 46. Client Viewer Experience

Client Viewer should see a clean client-facing version of project information.

Potential MVP access:

- project status;
- progress vs target;
- accepted outlet count;
- map of authorised accepted data;
- coverage summary;
- approved reports;
- authorised exports if separately granted.

Do not expose:

- Taskraft internal QA commentary;
- worker management controls;
- other clients;
- TES Market Universe intelligence not licensed/authorised;
- internal data-right/security controls.

## 47. Notifications

MVP in-app notifications/events should cover important workflow changes such as:

- assignment created/reassigned;
- visit returned for correction;
- project activated/paused;
- QA backlog warning;
- sync failure requiring worker action.

Email/SMS/Slack notifications can be added selectively where operational value justifies them.

## 48. Search

Management search should progressively support:

- project;
- outlet;
- customer code;
- Field Worker;
- assignment;
- visit reference.

Search remains workspace/security scoped.

## 49. Audit Visibility

Privileged users should have an appropriate audit/activity view for significant events.

MVP does not require exposing raw technical logs.

Relevant business events may include:

- project activated;
- survey version published;
- assignment reassigned;
- visit reopened;
- QA override;
- import/export;
- outlet match/merge;
- Market Universe promotion where applicable.

## 50. Administration

Initial administration functions:

- organisations;
- workspaces;
- workspace membership;
- role assignment;
- Field Worker status;
- permitted platform configuration;
- project access.

Security-sensitive actions are independently API-authorised and audited.

## 51. Market Universe MVP Scope

The MVP must prepare for the TES Market Universe but does not need to expose the entire future intelligence platform.

MVP requirements:

- permanent TES market outlet structure exists;
- workspace/private outlet structure exists;
- matching service can consider permitted candidates;
- authorised user can review uncertain matches;
- rights-controlled promotion/link process exists;
- no automatic client-data leakage into Market Universe.

## 52. Market Universe Promotion UX

Where authorised, a reviewer sees:

```text
Workspace Outlet
  vs
Possible TES Market Outlet

Distance
Name similarity
Location
Evidence
Source/rights information
Confidence
```

Actions:

```text
Link Existing
Create Market Outlet
Not Same
Needs Review
```

Rights validation occurs server-side regardless of UI option.

## 53. Initial Rules-Based Intelligence

MVP intelligence should focus on useful deterministic rules rather than premature AI.

Examples:

- possible duplicate outlet;
- GPS outside zone;
- poor GPS accuracy;
- missing storefront photo;
- unusually short visit;
- impossible travel between visits;
- worker/project behind expected pace;
- searched cell with zero outlets;
- high discovery cell;
- incomplete zone coverage.

These rules create structured validation/intelligence data that future models can learn from.

## 54. Human-in-the-Loop

For uncertain decisions:

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

This applies especially to duplicate matching, outlet promotion, QA anomalies and future opportunity recommendations.

## 55. What MVP Will Not Attempt

To control scope, v1.0 does not need to provide:

- full AI image recognition;
- predictive outlet discovery;
- prescriptive field-worker routing;
- Fleetwize route optimisation;
- fully automated opportunity recommendations;
- open gig-worker marketplace;
- advanced certification marketplace;
- complex client billing;
- universal CRM;
- payroll/HR functionality;
- unrestricted real-time employee tracking;
- replacement for ArcGIS Pro;
- full enterprise data warehouse UI.

The architecture must support these future directions without forcing them into MVP.

## 56. Performance Expectations

MVP should feel responsive under normal project operations.

Targets should be defined during technical implementation for:

- dashboard load;
- assignment list;
- survey form opening;
- offline save;
- submission;
- map viewport query;
- photo upload;
- QA queue;
- export generation.

Large datasets must use pagination/bounded map queries rather than loading an entire workspace into the browser.

## 57. Mobile Usability Requirements

Field UI must account for:

- bright outdoor conditions;
- one-handed use where practical;
- intermittent network;
- inexpensive/medium Android devices;
- camera use;
- GPS delays;
- accidental navigation;
- large touch targets;
- clear save/sync status;
- minimal typing.

Use controlled options and defaults where they improve data quality.

## 58. Accessibility / Readability

Management and field interfaces should use:

- clear contrast;
- readable text sizes;
- labels rather than colour alone;
- accessible form controls;
- obvious error messages;
- consistent status terminology.

## 59. Data Quality Success Measures

MVP should make it possible to measure:

- missing required responses;
- missing evidence;
- GPS quality;
- duplicate rate;
- QA rejection/return rate;
- correction rate by reason;
- accepted-first-time rate;
- average QA turnaround;
- outlet match confidence distribution;
- sync failure rate.

These metrics help improve field processes and future AI.

## 60. Operational Success Measures

Measure:

- outlets/visits per worker/day;
- project completion trajectory;
- coverage percentage;
- searched-zero-found geography;
- discovery rate by zone;
- QA backlog;
- time from capture to accepted result;
- number of spreadsheet/manual steps removed;
- time to produce client reporting.

## 61. MVP Acceptance Scenario

The MVP is functionally successful when Taskraft can perform the following end-to-end scenario:

1. create a client workspace/project;
2. configure/publish a survey;
3. import known client outlets;
4. define/import project geography;
5. divide geography into operational zones/coverage cells;
6. add Field Workers;
7. allocate zones/outlets;
8. workers receive assignments on mobile;
9. worker operates online or offline;
10. worker discovers a new outlet;
11. system checks for nearby duplicates;
12. worker captures GPS, answers and photographs;
13. worker submits/syncs visit;
14. automated rules flag anomalies;
15. QA accepts or returns the visit;
16. corrected work can be resubmitted;
17. management sees live progress and coverage;
18. searched areas with zero outlets remain distinguishable from unvisited areas;
19. accepted outlet/visit history persists beyond the project;
20. client viewer can see authorised results;
21. project manager can export an authorised client-ready dataset;
22. no user can bypass workspace/project/assignment boundaries by manipulating the UI or API IDs.

## 62. Recommended MVP Build Phases

### Phase 1 — Platform Foundation

- authentication;
- users/organisations/workspaces;
- membership/roles;
- API authorisation;
- audit foundation;
- management shell/navigation.

### Phase 2 — Project & Survey Configuration

- projects;
- survey builder/versioning;
- geography/zones;
- imports;
- Field Workers.

### Phase 3 — Assignment & Field PWA

- assignment engine;
- Today screen;
- field map;
- visit capture;
- GPS;
- responses;
- photos/evidence;
- offline storage/sync.

### Phase 4 — Outlet Identity & QA

- workspace outlet registry;
- duplicate matching;
- validations;
- QA queue;
- corrections;
- accepted visits;
- Market Universe controlled linkage.

### Phase 5 — Coverage & Operations

- coverage cells;
- searched/unvisited distinction;
- management map;
- field-worker/project progress;
- exception dashboard.

### Phase 6 — Reporting & Client View

- exports;
- daily project summary;
- client viewer;
- operational KPIs;
- production hardening.

## 63. Production Readiness Gate

Before using Survey Guru MVP for a live client project:

- API authorisation security tests pass;
- cross-workspace isolation passes;
- direct protected Firestore/Storage access is denied;
- offline sync tested under realistic network interruption;
- duplicate/idempotency handling tested;
- evidence upload/access tested;
- backup/restore procedure tested;
- survey version immutability tested;
- QA/correction workflow tested;
- export permissions tested;
- data-right/Market Universe promotion boundary tested;
- map/coverage performance tested at expected project scale;
- mobile usability field-tested;
- production logging/alerting available;
- secrets and environment separation verified.

## 64. Locked MVP Functional Decisions

1. Survey Guru MVP is a field-survey operating system, not a questionnaire app.
2. Taskraft must be able to run a real WTS project end-to-end inside the product.
3. Outlet is permanent; Visit is time-bound.
4. Workspace/private outlet and TES Market Universe outlet remain distinct.
5. Geography and coverage are MVP features, not future add-ons.
6. Searched-zero-found must be distinguishable from unvisited.
7. Field Worker experience is assignment-centric and mobile-first.
8. Offline fieldwork is required.
9. Basic duplicate matching exists from MVP.
10. GPS and evidence are first-class capture components.
11. Data-quality rules operate during/after capture.
12. QA and correction are formal workflows.
13. Published survey versions are immutable.
14. Management receives near-real-time operational progress.
15. Client Viewer receives a deliberately restricted client-facing experience.
16. Export is authorised separately from viewing.
17. Market Universe promotion is explicit and rights-controlled.
18. Initial intelligence is rules-based where rules can deliver reliable value.
19. Human review remains available for uncertain decisions.
20. AI prediction, opportunity recommendation and Fleetwize optimisation are future layers, not MVP scope.
21. The UI cannot bypass API/backend security.
22. MVP persistence must remain migration-ready for PostgreSQL/PostGIS/H3.

## 65. Next Product Design Documents

The MVP Functional Specification should now be translated into implementation-ready product design through:

1. **Survey Guru Screen & Navigation Architecture v1.0** — complete management and Field Worker screen inventory, navigation, layouts and role visibility.
2. **Survey Guru Field Capture & Offline Workflow Specification v1.0** — detailed mobile states, offline queue, sync/conflict behaviour, GPS/photo capture and field errors.
3. **Survey Guru QA & Validation Rules Specification v1.0** — exact initial rules, thresholds, severity and correction workflow.
4. **Survey Guru Coverage Model Specification v1.0** — H3/grid strategy, search evidence, state transitions and coverage metrics.
5. **Survey Guru Import & Export Specification v1.0** — column mapping, validation, stable IDs, error handling and client-ready outputs.

After those are locked, repository/application scaffolding and phased implementation can begin with substantially less rework.

---

This is a living TES product specification. Material scope or workflow changes must be version-controlled in the Survey Guru repository.