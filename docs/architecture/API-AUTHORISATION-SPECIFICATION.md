# Survey Guru API & Authorisation Specification v1.1

**Product Owner:** TES — Task Expert Systems  
**Operational / Field Partner:** Taskraft (Pty) Ltd  
**Status:** Approved API & Authorisation Baseline / Living Document  
**Version:** 1.1  
**Updated:** 9 September 2026

## 1. Purpose

This specification defines Survey Guru's trusted application boundary: how authenticated users, field workers, administrators, client users, service identities and future AI agents request operations against Survey Guru data.

It aligns the Security Model, Data Model v1.1, Coverage Model, MVP Persistence v1.1, Field Capture/Offline Workflow and QA architecture.

> **The Survey Guru API/backend is the primary application authorisation boundary.**

> **The UI is never trusted to grant, restrict or prove access.**

A caller who bypasses, modifies or replaces the frontend must gain zero additional authority.

## 2. Core Request Model

```text
Client / PWA / Admin UI / Service
              |
              v
        HTTPS Request
              |
              v
      Authentication Gate
              |
              v
       Identity Resolver
              |
              v
      Resource Resolver
              |
              v
     Authorisation Engine
              |
              v
 Validation / Policy / Idempotency
              |
              v
       Domain Service
              |
              v
 Persistence / Background Processing
              |
              v
       Audit / Response
```

No protected persistence operation occurs before the required identity and authorisation decisions.

## 3. Trust Boundaries

Untrusted inputs include browser/PWA state, URL/query/body IDs, hidden fields, client roles, local storage, cached permissions, device-calculated coverage, client data-right values, client QA status and external-system success claims.

Trusted only after verification/resolution:

- verified Firebase identity/session;
- server-loaded Survey Guru user;
- memberships and permissions;
- project participation;
- assignment/resource relationships;
- server coverage policy;
- authoritative lifecycle state;
- service identity credentials;
- server-side integration/rights configuration.

## 4. API Deployment Direction

MVP may use Next.js server/API routes where appropriate, applying this same model. Cloud Run or equivalent trusted backend is the scalable target.

Public application contracts must remain persistence-neutral so Firestore-to-PostgreSQL/PostGIS migration does not require client security redesign.

## 5. Namespace & Contract Versioning

External namespace:

```text
/api/v1/...
```

Breaking contract changes require explicit migration/versioning. Deployed field clients cannot be silently broken.

Responses should include schema/resource versions where offline reconciliation or long-lived clients require them.

## 6. Authentication

Firebase Authentication is the initial identity provider.

The API verifies token/session validity and then resolves the Survey Guru `users/{uid}` record. A valid Firebase identity belonging to a suspended Survey Guru user is denied.

Authentication answers **who are you?** Authorisation answers **may you perform this exact action on this exact resource in this context?**

## 7. Authorisation Context

Conceptually:

```text
AuthContext
  userId
  userStatus
  platformPermissions
  organisationMemberships
  workspaceMembership
  effectivePermissions
  projectParticipation
  fieldWorkerId
  assignmentScope
  resourceScope
  dataDomain
  dataRightsClass
  serviceIdentity
  requestId
```

Resolve only context needed for the operation.

## 8. Decision Function

```text
ALLOW if authenticated
AND user/service active
AND required workspace membership
AND required permission
AND project scope
AND assignment/resource scope
AND data-domain policy
AND data-right policy
AND lifecycle/state permits
AND endpoint-specific policy permits
ELSE DENY
```

Default is `DENY`.

## 9. Resource-First Authorisation

For an object request, load the resource server-side, derive its authoritative workspace/project/assignment/worker/rights relationships, then authorise.

Never authorise `vst_123` because the browser also supplied a workspace ID in which the caller happens to be a member.

Cross-workspace probing should generally return `404` where hiding existence is desirable.

## 10. Scope Hierarchy

```text
Identity
  -> Organisation context
  -> Workspace Membership
  -> Permission
  -> Project Scope
  -> Assignment / Resource Scope
  -> Data Domain
  -> Data Rights
  -> Lifecycle / Policy
```

Workspace membership does not automatically grant all projects. Project access does not automatically grant all assignments. Workspace access does not automatically grant Market Universe access.

## 11. Field Worker Scope

Typical scope:

```text
own active project participation
 -> own Assignment
 -> authorised zone/street/cell/outlet context
 -> own Search Session
 -> own Movement uploads
 -> own Visits/Responses/Evidence
 -> own returned corrections/revisits
 -> authorised derived coverage context
```

Field Workers do not gain project-wide raw movement, all visits, all outlets, QA-only notes or Market Universe access merely because they participate in the project.

## 12. Data Domains & Rights

Domains:

1. TES Platform;
2. Workspace / Client;
3. TES Market Universe.

Rights classes:

```text
CLIENT_PRIVATE
OPERATIONAL_SHARED
TES_REFERENCE_PERMITTED
PUBLIC_OR_LICENSED
```

Rights-sensitive operations include promotion, cross-workspace intelligence, exports, AI processing, external integrations, evidence sharing and future model training.

Client payloads cannot upgrade rights.

## 13. Permission Catalogue

Representative permission keys:

```text
workspace.read
workspace.manage_members
project.read
project.create
project.update
project.archive
survey.read
survey.create
survey.publish
field_worker.read
field_worker.manage
assignment.read
assignment.read_own
assignment.create
assignment.update
assignment.reassign
visit.read
visit.read_own
visit.create
visit.update_own
visit.submit_own
visit.reopen
response.write_own
evidence.upload
evidence.read
evidence.export
search_session.create_own
movement.submit_own
coverage.read
coverage.read_own
coverage.verify
coverage.override
coverage.exception.resolve
qa.read
qa.review
qa.assign
qa.resolve
qa.override
outlet.lookup_workspace
outlet.create_candidate
outlet.identity_review
outlet.merge
market.outlet.lookup
market.promotion.request
market.promotion.approve
integration.read
integration.manage
integration.retry
report.view
report.generate
data.export
audit.read
security.manage
```

Roles bundle permissions but never replace scope checks.

## 14. Response Minimisation

Authorisation controls records **and fields**.

Field Worker map responses receive only assignment-relevant geometry/outlets/coverage. Client viewers need not receive internal QA notes. Analysts may receive pseudonymised worker identity. Raw movement is normally excluded from client/supervisor responses unless a specifically authorised QA/support purpose requires it.

## 15. Standard Errors

```text
400 malformed/invalid request
401 missing/invalid/expired authentication
403 authenticated but forbidden where existence disclosure is acceptable
404 absent or intentionally hidden resource
409 lifecycle/version/idempotency conflict
422 domain validation failure
429 rate/abuse limit
500/503 server/dependency failure
```

Never expose stack traces, credentials or sensitive internal identifiers in production errors.

## 16. Input & Mass-Assignment Protection

Every endpoint defines schema, allowed values, relationship validation, lifecycle transitions and explicit writable fields.

Clients cannot authoritatively set fields such as:

```text
workspaceId/projectId derived from resource
fieldWorkerId ownership
marketOutletId
rights promotion
qaStatus
coverage state/percent/confidence
VERIFIED state
reviewedBy/verifiedBy
integration success
permissions
```

## 17. Idempotency

Retry-prone operations support stable IDs and/or:

```text
Idempotency-Key: <opaque-operation-id>
```

Bind idempotency to caller/service + endpoint/action + authoritative scope.

Required for at least visit creation/submission, evidence registration/finalisation, movement batches, offline sync, corrections, integration jobs, export jobs and promotion requests.

## 18. Concurrency

High-impact mutable resources use optimistic concurrency through `expectedVersion`, `If-Match` or equivalent.

Stale conflicting mutations return `409`, including QA resolution, assignment reassignment, integration profile activation and coverage override.

## 19. Pagination, Filtering & Spatial Bounds

List endpoints are bounded and preferably cursor-paginated.

Only documented filters/sorts are accepted. No generic arbitrary Firestore query API exists.

Spatial endpoints require bounded project/assignment/viewport context and enforce maximum bounds/feature counts.

## 20. Identity & Context API

```text
GET /api/v1/me
GET /api/v1/me/workspaces
GET /api/v1/me/assignments
```

`/me/assignments` returns only caller-authorised assignments.

## 21. Workspace API

```text
GET    /api/v1/workspaces/{workspaceId}
GET    /api/v1/workspaces/{workspaceId}/members
POST   /api/v1/workspaces/{workspaceId}/members
PATCH  /api/v1/workspaces/{workspaceId}/members/{membershipId}
DELETE /api/v1/workspaces/{workspaceId}/members/{membershipId}
```

Membership writes are audited. DELETE normally means revoke/deactivate.

## 22. Project API

```text
GET   /api/v1/workspaces/{workspaceId}/projects
POST  /api/v1/workspaces/{workspaceId}/projects
GET   /api/v1/projects/{projectId}
PATCH /api/v1/projects/{projectId}
POST  /api/v1/projects/{projectId}/activate
POST  /api/v1/projects/{projectId}/pause
POST  /api/v1/projects/{projectId}/complete
POST  /api/v1/projects/{projectId}/archive
```

Lifecycle transitions are explicit operations.

## 23. Survey API

```text
GET  /api/v1/workspaces/{workspaceId}/surveys
POST /api/v1/workspaces/{workspaceId}/surveys
GET  /api/v1/surveys/{surveyDefinitionId}
POST /api/v1/surveys/{surveyDefinitionId}/versions
GET  /api/v1/survey-versions/{surveyVersionId}
POST /api/v1/survey-versions/{surveyVersionId}/publish
```

Published Survey Versions are immutable.

## 24. Field Worker & Assignment API

```text
GET  /api/v1/workspaces/{workspaceId}/field-workers
POST /api/v1/workspaces/{workspaceId}/field-workers
GET  /api/v1/field-workers/{fieldWorkerId}
POST /api/v1/projects/{projectId}/field-workers

GET   /api/v1/projects/{projectId}/assignments
POST  /api/v1/projects/{projectId}/assignments
GET   /api/v1/assignments/{assignmentId}
PATCH /api/v1/assignments/{assignmentId}
POST  /api/v1/assignments/{assignmentId}/accept
POST  /api/v1/assignments/{assignmentId}/start
POST  /api/v1/assignments/{assignmentId}/reassign
POST  /api/v1/assignments/{assignmentId}/cancel
```

Field Worker self-actions require ownership and valid lifecycle.

## 25. Assignment Package API

Field PWA receives an explicit minimum offline package:

```text
GET /api/v1/assignments/{assignmentId}/package
```

Server verifies caller owns/is permitted for assignment, then returns only necessary:

- assignment/project context;
- immutable survey version;
- zone/boundary;
- eligible street segments/simplified geometry;
- coverage cells/current authorised state;
- coverage policy/version;
- relevant known outlets/duplicate-check subset;
- reference options;
- package/schema/version metadata.

It must not return the entire TES Market Universe for convenience.

## 26. Workspace Outlet & Identity API

```text
GET  /api/v1/workspaces/{workspaceId}/outlets
GET  /api/v1/workspace-outlets/{workspaceOutletId}
PATCH /api/v1/workspace-outlets/{workspaceOutletId}
POST /api/v1/assignments/{assignmentId}/outlet-candidates
POST /api/v1/assignments/{assignmentId}/outlet-match
GET  /api/v1/outlet-candidates/{candidateId}/matches
POST /api/v1/outlet-candidates/{candidateId}/confirm-existing
POST /api/v1/outlet-candidates/{candidateId}/confirm-new
```

Field Worker candidate creation is assignment-scoped.

Matching results are field-minimised and rights-aware. The worker does not receive unrelated client/Market Universe metadata.

## 27. Critical Store Identity Gate

Before a new permanent outlet is accepted, the API may evaluate nearby/similar candidates using permitted signals.

Outcomes:

```text
NO_LIKELY_MATCH
POSSIBLE_MATCH
STRONG_MATCH
CONFIRMED_EXISTING
CONFIRMED_NEW
```

The API never silently merges permanent outlets. High-impact merge/identity resolution requires separately authorised workflow and audit.

## 28. Visit & Response API

```text
POST /api/v1/assignments/{assignmentId}/visits
GET  /api/v1/visits/{visitId}
PATCH /api/v1/visits/{visitId}
POST /api/v1/visits/{visitId}/submit
POST /api/v1/visits/{visitId}/reopen

PUT    /api/v1/visits/{visitId}/responses/{questionId}
PUT    /api/v1/visits/{visitId}/response-rows/{rowId}
DELETE /api/v1/visits/{visitId}/response-rows/{rowId}
```

On visit creation, workspace/project/worker are derived from Assignment.

Response API verifies immutable Survey Version membership and type/rule constraints.

Repeatable row deletion during editable field capture is logical removal/supersession where history is required; accepted historical records are not destructively rewritten.

## 29. Evidence API

```text
POST /api/v1/visits/{visitId}/evidence/initiate
POST /api/v1/evidence/{evidenceId}/complete
GET  /api/v1/evidence/{evidenceId}/access
```

Initiate creates authoritative metadata and controlled object target. Complete verifies expected object/integrity metadata before marking upload complete.

Object keys are not credentials. Access is reauthorised every time; API may stream or issue short-lived signed access.

## 30. Search Session API

```text
POST /api/v1/assignments/{assignmentId}/search-sessions
GET  /api/v1/search-sessions/{searchSessionId}
POST /api/v1/search-sessions/{searchSessionId}/start
POST /api/v1/search-sessions/{searchSessionId}/pause
POST /api/v1/search-sessions/{searchSessionId}/resume
POST /api/v1/search-sessions/{searchSessionId}/complete
```

Server derives worker/project/assignment and locks the applicable Coverage Policy version.

A worker cannot open a Search Session for another worker's Assignment.

## 31. Movement Batch API

Preferred endpoint:

```text
POST /api/v1/search-sessions/{searchSessionId}/movement-batches
```

Request contains stable batch/device ID, sequence range, capture interval, policy-compatible Movement Events and idempotency key.

Server verifies:

- Search Session ownership;
- Assignment/project scope;
- capture timestamps;
- event count/size limits;
- coordinate/range validity;
- sequence/idempotency;
- session state and offline-authority policy;
- rate/abuse limits.

Client cannot submit authoritative street matches, coverage percentages or VERIFIED state.

Successful ingestion may return `ACCEPTED_FOR_PROCESSING` before derived coverage is complete.

## 32. Movement Privacy API Rule

There is intentionally no ordinary endpoint such as:

```text
GET /api/v1/projects/{projectId}/all-worker-gps-trails
```

Raw movement retrieval requires a specific QA/security/support purpose, stronger permission, bounded worker/time/resource scope and audit where appropriate.

Normal management maps consume derived coverage and current operational state rather than unrestricted historical trails.

## 33. Field Coverage API

```text
GET /api/v1/assignments/{assignmentId}/coverage
GET /api/v1/assignments/{assignmentId}/street-segments
GET /api/v1/assignments/{assignmentId}/coverage/changes?sinceVersion=...
```

Returns assignment-bounded authoritative coverage plus version metadata.

A field response may include:

```text
coverageVersion
streetSegments[]
  projectStreetSegmentId
  simplifiedGeometry
  state
  percent
  confidence
cells[]
  coverageCellId/h3Index
  state
  percent
syncMetadata
```

Local provisional coverage remains device-side and is reconciled against this authoritative response.

## 34. Supervisor Coverage API

```text
GET /api/v1/projects/{projectId}/coverage
GET /api/v1/projects/{projectId}/coverage/summary
GET /api/v1/projects/{projectId}/coverage/map?bbox=...
GET /api/v1/projects/{projectId}/coverage/exceptions
GET /api/v1/projects/{projectId}/coverage/snapshots
```

Supervisor/project endpoints require project-level coverage permission and return bounded/aggregated data.

Raw street-network coverage and any weighted-priority coverage must be clearly distinguishable.

## 35. Coverage Verification & Override API

```text
POST /api/v1/coverage/{resourceType}/{resourceId}/verify
POST /api/v1/coverage/{resourceType}/{resourceId}/override
POST /api/v1/coverage-exceptions/{exceptionId}/resolve
```

Verification and override are different operations.

Verification confirms evidence under authorised process. Override exceptionally changes derived current state without deleting source evidence.

Overrides require stronger permission, reason, expected version, audit and retained previous state.

Field Workers cannot set `VERIFIED`.

## 36. Searched-Zero-Found Rule

There is no field endpoint that simply sets `searchedZeroFound=true`.

It is server-derived only after qualifying search/coverage evidence is satisfied, relevant pending outlet submissions are reconciled and qualifying outlet count is zero.

This prevents unvisited areas from being represented as searched-zero-found.

## 37. Validation & QA API

```text
GET  /api/v1/projects/{projectId}/qa-queue
GET  /api/v1/qa-work-items/{qaWorkItemId}
POST /api/v1/qa-work-items/{qaWorkItemId}/claim
POST /api/v1/qa-work-items/{qaWorkItemId}/resolve
POST /api/v1/qa-work-items/{qaWorkItemId}/return-for-correction
POST /api/v1/qa-work-items/{qaWorkItemId}/require-revisit
GET  /api/v1/resources/{resourceType}/{resourceId}/validation-results
```

Validation Results are normally generated by server rules/services and authorised validators, not arbitrary field-worker payloads.

QA response minimisation hides sensitive/internal fields from roles that do not need them.

## 38. QA Severity Enforcement

The API enforces the rule severity model:

```text
BLOCK
WARN
FLAG_FOR_QA
INFO
```

`BLOCK` can prevent the relevant transition. `WARN` may allow progression while preserving warning. `FLAG_FOR_QA` creates/reuses review workflow. `INFO` records non-blocking context.

The frontend cannot downgrade a rule severity.

## 39. Correction API

```text
GET  /api/v1/visits/{visitId}/correction-request
POST /api/v1/visits/{visitId}/corrections
POST /api/v1/visits/{visitId}/corrections/{correctionId}/submit
```

Field Worker can correct only authorised returned work and permitted fields.

Server preserves original values/revision lineage and re-runs relevant validation.

Accepted historical data is not silently overwritten.

## 40. Revisit API

```text
GET  /api/v1/revisit-tasks/{revisitTaskId}
POST /api/v1/revisit-tasks/{revisitTaskId}/create-assignment
POST /api/v1/revisit-tasks/{revisitTaskId}/complete
```

A revisit creates a new Visit linked to the original. It does not rewrite history to pretend the first visit did not occur.

## 41. Market Universe API

```text
GET  /api/v1/market/outlets/lookup
GET  /api/v1/market/outlets/{outletId}
POST /api/v1/market/promotion-requests
GET  /api/v1/market/promotion-requests/{requestId}
POST /api/v1/market/promotion-requests/{requestId}/approve
POST /api/v1/market/promotion-requests/{requestId}/reject
POST /api/v1/market/outlets/{outletId}/merge
```

Market operations use separate permissions and rights validation.

Merge never occurs merely because an algorithm reports a strong match.

## 42. Integration API

```text
GET   /api/v1/workspaces/{workspaceId}/integrations
GET   /api/v1/integrations/{integrationProfileId}
PATCH /api/v1/integrations/{integrationProfileId}
POST  /api/v1/integrations/{integrationProfileId}/test
POST  /api/v1/integrations/{integrationProfileId}/activate
GET   /api/v1/visits/{visitId}/integration-jobs
POST  /api/v1/integration-jobs/{integrationJobId}/retry
```

Integration configuration is privileged and audited.

Secrets/tokens are never returned in ordinary API responses.

## 43. Premier WTS Integration Rule

Survey Guru acceptance and Premier WTS sync are independent states.

```text
Survey Guru: ACCEPTED
Premier WTS: PENDING / SYNCING / SYNCED / ACTION_REQUIRED
```

For Premier WTS v2.006, an adapter cannot set `SYNCED` merely because fields were populated. It requires confirmation of the final Premier `Submit Surveys` operation.

A failed Premier sync does not discard the Survey Guru Visit.

Retries are idempotent and use the authorised user's/client integration context.

## 44. Reports & Exports API

```text
GET  /api/v1/projects/{projectId}/dashboard
GET  /api/v1/projects/{projectId}/reports
POST /api/v1/projects/{projectId}/reports/generate
POST /api/v1/projects/{projectId}/exports
GET  /api/v1/exports/{exportJobId}
GET  /api/v1/exports/{exportJobId}/access
```

Export is a separate data-exfiltration permission. Server enforces field allowlists, rights, scope, row/count limits where appropriate, audit and short-lived output access.

Viewing does not imply exporting.

## 45. Offline Sync API

The MVP may expose a coordinated endpoint:

```text
POST /api/v1/sync
```

plus resource-specific batch endpoints.

Each operation includes stable local/domain ID, operation type, capture time, payload, idempotency key and optional previous server version.

Every operation is independently reauthenticated, reauthorised and validated on arrival.

Offline capture does not create permanent authority. However, sync policy must distinguish legitimate evidence captured while an Assignment was valid from malicious activity after revocation. The server uses capture timestamps, assignment validity/history, session state and policy rather than blindly accepting or rejecting solely on current UI state.

## 46. Offline Sync Result

Sync returns per-operation results rather than one ambiguous success flag:

```text
operationId
status
serverResourceId
serverVersion
errorCode
message
retryable
```

Possible states:

```text
SYNCED
ACCEPTED_FOR_PROCESSING
RETRY
CONFLICT
REJECTED
NEEDS_ATTENTION
```

Partial failure does not cause successful unrelated operations to be duplicated on retry.

## 47. Evidence Security

Evidence metadata and object access are authorised separately.

Requirements:

- no permanent public protected URLs;
- controlled upload target;
- content type/size/integrity checks;
- object ownership bound to Evidence record;
- short-lived access after authorisation;
- export permission separate from view;
- rights classification enforced.

## 48. Geospatial Security

Every map/viewport request is protected.

A bounding box never becomes authority.

Server first resolves project/assignment scope, then executes bounded spatial query and filters fields/domains.

Future PostGIS adoption changes query engine, not authorisation.

## 49. Raw Movement Security

Raw movement is purpose-limited and more sensitive than derived coverage.

A raw-movement access operation must specify:

- permission;
- legitimate operational/QA/security purpose;
- project/worker/time bounds;
- returned fields;
- audit requirement;
- retention implications.

Client Viewer access to derived coverage never implies raw Movement Event access.

## 50. Service-to-Service Identities

Background workers use explicit scoped service identities.

Examples:

```text
Coverage Processor:
  read authorised movement batches/events
  write traversal/derived coverage/exceptions

QA Rule Engine:
  read authorised submitted resources
  write validation results/QA triggers

Integration Worker:
  read authorised canonical visit projection
  update integration job/attempt

Export Worker:
  read approved export scope
  write protected output

Market Matcher:
  read permitted identity fields
  create match proposal
```

None impersonates a super administrator.

## 51. AI Agent Authorisation

AI is a scoped caller identity, not a security bypass.

AI may propose QA findings, outlet matches, opportunity priorities or recommendations only within granted data scope.

High-impact rights changes, outlet merges, QA overrides, membership changes or coverage overrides require explicit authorised workflow unless a later approved policy safely delegates them.

Standing principle:

> **No autonomous agent receives simultaneous authority over code, production credentials and deployment.**

## 52. Break-Glass Access

Exceptional restricted-data access requires reason, authorised actor, limited scope, expiry, audit and appropriate post-event review.

Break-glass is not routine support access.

## 53. Logging & Audit

Always audit at minimum:

- membership/permission changes;
- project critical lifecycle changes;
- survey publication;
- visit reopen/correction after submission;
- QA override;
- coverage verification/override;
- raw movement privileged access where policy requires;
- export/bulk download;
- Market Universe promotion/merge;
- data-right changes;
- integration configuration/activation;
- break-glass;
- denied privileged attempts;
- service identity/security configuration.

Operational logs must not contain authentication tokens, secrets or unnecessary client-sensitive payloads.

## 54. CORS / Browser / App Check

Use HTTPS, controlled origins, secure cookies if applicable, CSRF protection for cookie-authenticated mutations, restrictive credentialed CORS and appropriate security headers/CSP.

CORS is not authorisation.

Firebase App Check may be used as an abuse-control signal but never replaces identity/resource authorisation.

## 55. Secrets

Secrets belong in approved environment/secret management and are separated by environment.

Never store production credentials, Firebase Admin credentials, signing secrets, GIS keys, AI keys, SMS/email credentials or Premier/client tokens in source or ordinary API configuration documents.

## 56. Provider & Persistence Abstraction

```text
API Controller
    |
Application Service
    |
Domain / Policy
    |
Repository / Provider Interfaces
    |
+---+-----------------------+
|                           |
Firestore MVP        PostgreSQL/PostGIS target
```

Provider interfaces should similarly isolate geocoder, map provider, object storage, notifications, integrations and analytics.

## 57. Rate & Abuse Controls

Endpoint-sensitive limits may consider user/service identity, workspace, device, IP and endpoint.

Particularly protect authentication/activation, outlet matching, movement ingestion, evidence initiation, export, integration retries, geocoding/routing and AI analysis.

Movement limits must allow legitimate offline batch catch-up without enabling unbounded payload abuse.

## 58. API Security Test Matrix v1.1

Before production, prove at minimum:

1. no/invalid/expired token denied;
2. suspended user denied;
3. user without workspace membership denied;
4. Workspace A user cannot retrieve Workspace B resource by guessed ID;
5. changing client `workspaceId/projectId/fieldWorkerId` cannot cross scope;
6. Field Worker cannot enumerate project-wide assignments;
7. Field Worker cannot retrieve another worker's Visit/Search Session;
8. Field Worker cannot create Search Session for another Assignment;
9. Field Worker cannot submit another worker's Movement Batch;
10. client-submitted street match/coverage percent/state is ignored/rejected;
11. Field Worker cannot set `COVERED` or `VERIFIED` directly;
12. crossing/nearby side street cannot be forced covered by payload;
13. duplicate Movement Batch is idempotent;
14. oversized/invalid movement batch safely rejected;
15. offline sync after authority change follows historical-authority policy and cannot escalate scope;
16. assignment package excludes unrelated Market Universe/client data;
17. raw movement unavailable through ordinary coverage endpoints;
18. raw movement privileged access is bounded and authorised;
19. Field Worker cannot silently merge outlet candidates;
20. client cannot upgrade data-right classification;
21. workspace permission does not grant Market Universe permission;
22. published Survey Version cannot be mutated;
23. evidence cannot be accessed by guessed object key;
24. signed evidence access expires;
25. BLOCK validation cannot be bypassed by direct endpoint invocation;
26. client cannot downgrade validation severity;
27. QA user cannot act outside assigned/project scope;
28. ordinary QA user cannot perform stronger override without permission;
29. correction cannot overwrite historical accepted values without lineage;
30. revisit creates linked new Visit rather than replacing original;
31. Survey Guru Visit remains accepted if Premier integration fails;
32. integration job cannot be marked SYNCED without authoritative adapter confirmation;
33. repeated integration retry is idempotent;
34. Analyst read permission does not grant export;
35. export cannot request hidden/unauthorised fields;
36. cross-workspace spatial bbox cannot leak outlets/coverage;
37. service/AI identity cannot call outside granted scope;
38. mass-assignment security fields rejected;
39. stale high-impact update returns conflict;
40. privileged action creates audit event;
41. hidden/disabled UI control invocation grants no additional authority;
42. direct Firestore/Storage protected access remains denied.

## 59. Endpoint Production Gate

No protected endpoint is production-ready until documented with:

```text
Authentication requirement
Required permission(s)
Resource resolution sequence
Workspace/project/assignment scope
Data-domain and rights policy
Readable fields
Writable fields
Lifecycle/state rules
Validation rules
Idempotency
Concurrency/version behaviour
Rate/payload limits
Audit requirement
Error behaviour
Security tests
```

This checklist applies equally to human-written and autonomous-agent-generated endpoints.

## 60. Implementation Build Order v1.1

### Foundation
1. `/api/v1` structure
2. authentication/session verification
3. user-status resolver
4. request/correlation ID
5. error envelope
6. schema validation
7. idempotency utility

### Authorisation Core
8. workspace membership resolver
9. permission resolver
10. project resolver
11. assignment/resource resolver
12. data-right policy
13. reusable authorisation layer
14. audit writer
15. concurrency/version utility

### Field MVP
16. identity/context
17. project/survey reads
18. assignment APIs
19. assignment package
20. outlet candidate/matching gate
21. visits/responses/response rows
22. evidence upload/access
23. search sessions
24. movement batch ingestion
25. field coverage reads
26. offline sync/reconciliation

### Management / QA
27. supervisor coverage/map/summary
28. coverage exceptions
29. validation results
30. QA queue/work items
31. corrections/revisits
32. coverage verification/override

### Integration / Intelligence
33. Market Universe promotion/identity administration
34. Premier/client integration jobs
35. reports/exports
36. service/AI identities

### Production Gate
37. rate/abuse limits
38. direct API bypass security suite
39. Firestore/Storage denial tests
40. audit verification
41. field/offline load tests
42. movement cost/performance tests
43. incident/logging readiness

## 61. Locked API & Authorisation Decisions v1.1

1. API/backend is Survey Guru's primary application security boundary.
2. UI controls never grant authority.
3. Protected business data is API-only by default.
4. Firebase Authentication establishes identity, not business authority.
5. Memberships/permissions/resource relationships are server-loaded.
6. Protected resources are resource-first authorised.
7. Workspace, project, assignment, domain and rights scopes are independently enforced.
8. Field Worker access is assignment-centric.
9. Assignment package is minimum-data and never a convenient Market Universe dump.
10. Search Session scopes legitimate field search activity.
11. Movement Batch submission is worker/session scoped and idempotent.
12. Movement Events are evidence; clients cannot submit authoritative coverage truth.
13. Authoritative coverage is server-derived.
14. Field Workers cannot set VERIFIED.
15. Raw movement is more restricted than derived coverage.
16. Live field coverage is assignment-bounded and versioned for reconciliation.
17. Supervisor map queries are project/viewport bounded.
18. Searched-zero-found is server-derived and cannot be set directly.
19. Validation severity is server-controlled.
20. BLOCK validation cannot be bypassed by UI manipulation.
21. QA corrections preserve revision lineage.
22. Revisit creates a new linked Visit.
23. Outlet identity matching never silently merges permanent outlets.
24. Workspace Outlet and Market Outlet authority remain separated.
25. Data-right promotion is explicit and audited.
26. Survey Guru acceptance and third-party integration state are independent.
27. Premier WTS SYNCED requires confirmed final Submit Surveys success.
28. Integration retries are idempotent and scoped.
29. Evidence object keys are never access credentials.
30. Export is separately permissioned and audited.
31. Offline operations are reauthorised/revalidated on sync using historical authority and capture context where applicable.
32. Partial sync results are explicit per operation.
33. Writes use explicit field allowlists.
34. High-impact mutable actions use optimistic concurrency.
35. Spatial bounding boxes are query constraints, never authority.
36. Service/AI identities are explicitly scoped.
37. Firestore semantics do not leak into public API contracts.
38. API authorisation survives migration to PostgreSQL/PostGIS.
39. Security tests bypass the UI and directly attack protected endpoints.
40. No autonomous agent receives simultaneous authority over code, production credentials and deployment.

## 62. Required Follow-On Alignment

This v1.1 update should be reflected next in:

- `SCREEN-NAVIGATION-ARCHITECTURE.md` — live field/supervisor coverage, QA, correction, integration and sync surfaces;
- future PostgreSQL/PostGIS Logical Schema;
- future Import & Export Specification;
- implementation endpoint contracts as development begins.

The next highest-value architecture update is **Screen & Navigation Architecture v1.1**, because the backend capabilities and security boundaries are now sufficiently locked to define exactly what each role sees and how the field/supervisor workflows expose coverage, QA and sync without confusing UI visibility with authority.

---

## Living Documentation Rule

This is a living TES architecture specification. Material changes affecting endpoints, authorisation, coverage, offline sync, movement, QA, outlet identity, integrations, rights, security, exports or service/AI authority must be version-controlled here and in other materially affected Survey Guru/TES documents rather than remaining only in chat or informal notes.
