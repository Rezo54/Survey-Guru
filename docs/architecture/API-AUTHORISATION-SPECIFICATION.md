# Survey Guru API & Authorisation Specification v1.0

**Product Owner:** TES — Task Expert Systems  
**Operational / Field Partner:** Taskraft (Pty) Ltd  
**Status:** Approved API & Authorisation Baseline / Living Document  
**Version:** 1.0  
**Date:** 7 September 2026

## 1. Purpose

This specification defines the trusted application boundary for Survey Guru: how authenticated users, field workers, administrators, client users, service identities and future AI agents may request operations against Survey Guru data.

It implements the principles established in the Security Model and MVP Persistence Specification.

> **The Survey Guru API/backend is the primary application authorisation boundary.**

> **The UI is never trusted to grant, restrict or prove access.**

A user who bypasses, modifies or replaces the frontend must gain zero additional authority.

## 2. Core Request Model

Every protected operation follows the same logical sequence:

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
      Validation / Policy
              |
              v
       Domain Service
              |
              v
      Persistence Layer
              |
              v
       Audit / Response
```

No protected persistence access occurs before the required identity and authorisation decisions.

## 3. Trust Boundaries

### Untrusted

- browser;
- mobile/PWA client;
- URL parameters;
- request body;
- hidden fields;
- client-side roles;
- client-side workspace/project IDs;
- local storage;
- cached permissions;
- frontend route guards;
- disabled/hidden buttons;
- client-generated data-right classifications.

### Trusted only after verification

- Firebase Authentication ID token/session;
- server-loaded user record;
- server-loaded memberships;
- server-loaded project participation;
- server-loaded assignment;
- server-loaded resource ownership/scope;
- server configuration;
- service identity credentials.

## 4. API Deployment Direction

MVP may use Next.js server/API routes where appropriate, provided the same authorisation model is applied.

The target scalable service runtime is Google Cloud Run or an equivalent trusted backend environment.

The frontend must interact with a stable Survey Guru application-service contract so that moving backend workloads from Next.js-hosted API routes to Cloud Run does not require redesigning the domain model.

## 5. API Namespace and Versioning

Recommended external namespace:

```text
/api/v1/...
```

Examples:

```text
/api/v1/me
/api/v1/workspaces/{workspaceId}/projects
/api/v1/projects/{projectId}/assignments
/api/v1/assignments/{assignmentId}
/api/v1/visits/{visitId}
```

Breaking contract changes require a versioning/migration strategy rather than silently changing behaviour for deployed field clients.

## 6. Authentication

Firebase Authentication is the initial identity provider.

Protected requests provide a valid Firebase identity token or approved secure server session.

The server verifies at minimum:

- token signature;
- issuer/audience;
- expiry;
- authentication state;
- Firebase UID;
- revocation/session policy where required.

The API then loads the Survey Guru `users/{uid}` record and verifies application status.

A valid Firebase token belonging to a suspended Survey Guru user does not grant Survey Guru access.

## 7. Authentication vs Authorisation

Authentication answers:

> **Who are you?**

Authorisation answers:

> **Are you permitted to perform this exact action on this exact resource in this exact context?**

Authentication alone never grants access to a workspace, project, assignment, client dataset or Market Universe resource.

## 8. Authorisation Context

For protected operations, the API constructs an authoritative context such as:

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
  dataRightsClass
  serviceIdentity
  requestId
```

Only the context needed for the requested operation should be resolved.

## 9. Permission Naming

Permissions use explicit action-oriented keys.

Examples:

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
assignment.read
assignment.read_own
assignment.create
assignment.update
assignment.reassign
visit.read
visit.read_own
visit.create
visit.update_own
visit.reopen
response.create
response.update_own
evidence.upload
evidence.read
evidence.export
validation.read
validation.create
validation.override
coverage.read
coverage.manage
report.view
report.generate
data.export
market.outlet.lookup
market.outlet.create_candidate
market.outlet.verify
market.outlet.merge
market.coverage.read
market.intelligence.read
market.intelligence.export
market.admin
audit.read
security.manage
```

Roles are bundles of permissions; roles are not a substitute for resource-scope checks.

## 10. Role Baseline

### TES Super Administrator

Platform/security administration with explicitly granted privileged capabilities. Does not automatically imply unrestricted reading of every client-private response.

### TES Platform Administrator

Operational platform administration without automatic unrestricted customer-data access.

### Workspace Administrator

Manages authorised workspace configuration, members and projects.

### Project Manager

Manages allocated projects, field workers, assignments and operational reporting.

### QA / Validator

Reviews submitted visits/evidence and creates validation decisions.

### Analyst

Reads authorised analytical/project data. Export remains a separate permission.

### Client Viewer

Reads specifically authorised client dashboards/results/reports.

### Field Worker

Reads own assignments and required capture context; creates/updates own permitted field records.

## 11. Authorisation Decision Function

Conceptually every operation resolves:

```text
ALLOW if:
  authenticated
  AND user/service active
  AND required workspace membership exists where applicable
  AND required permission exists
  AND project scope permits access where applicable
  AND assignment/resource scope permits access where applicable
  AND data-right/domain policy permits action
  AND resource lifecycle permits action
ELSE DENY
```

Default outcome is **DENY**.

## 12. Resource-First Authorisation

The API must not authorise a resource operation using only IDs supplied by the client.

Example request:

```text
GET /api/v1/visits/vst_123
```

Correct sequence:

1. authenticate caller;
2. load `vst_123` server-side;
3. obtain its authoritative `workspaceId`, `projectId`, `fieldWorkerId`, rights and state;
4. resolve caller's access to that resource;
5. return only authorised fields.

Incorrect sequence:

1. trust `workspaceId=ws_ABC` sent by browser;
2. check membership in `ws_ABC`;
3. return `vst_123` without confirming it belongs there.

## 13. Cross-Workspace Isolation

Workspace isolation is mandatory.

Every workspace-scoped query must include an authoritative workspace constraint derived from the caller/resource context.

The API must never perform a broad lookup and rely on the UI to filter records afterward.

Knowing another workspace's project, outlet, visit or evidence ID must not expose its existence or contents beyond deliberately permitted metadata.

## 14. Project Scope

Workspace access does not necessarily imply access to every project.

The API evaluates:

- workspace membership;
- role/permission;
- project participation/restriction;
- requested action.

Project Managers, analysts and validators may be scoped to selected projects.

## 15. Assignment Scope

Field Worker access is assignment-centric.

Typical Field Worker scope:

```text
Field Worker
  -> own active Project participation
  -> own Assignment
  -> assignment target/zone/outlet context
  -> own Visit
  -> own Responses
  -> own Evidence
  -> correction requests for own returned work
```

A Field Worker cannot enumerate all project outlets/visits simply because their assignment belongs to the project.

## 16. Data Domain Scope

Survey Guru distinguishes:

1. TES Platform Domain;
2. Workspace / Client Domain;
3. TES Market Universe.

Workspace access never automatically grants TES Market Universe access.

Market permissions are separately evaluated.

## 17. Data-Rights Policy

Initial classifications:

```text
CLIENT_PRIVATE
OPERATIONAL_SHARED
TES_REFERENCE_PERMITTED
PUBLIC_OR_LICENSED
```

The API must enforce rights-sensitive operations including:

- Market Universe promotion;
- cross-workspace intelligence use;
- analytics export;
- AI processing;
- external integrations;
- evidence export;
- future model training.

A caller cannot upgrade rights classification merely by submitting a different value.

## 18. API Response Minimisation

Authorisation controls both records and fields.

The API returns only fields necessary for the caller's operation.

Examples:

- a Field Worker may need outlet name/location but not client commercial metadata;
- a Client Viewer may need accepted results but not internal QA notes;
- an Analyst may receive pseudonymised field-worker identity where names are unnecessary;
- TES platform administration may require account metadata without client survey answers.

## 19. Standard Error Behaviour

### `400 Bad Request`
Malformed or semantically invalid request.

### `401 Unauthorized`
Authentication missing, invalid or expired.

### `403 Forbidden`
Caller is authenticated but lacks permission where revealing resource existence is acceptable.

### `404 Not Found`
Resource does not exist **or** resource existence should not be disclosed to the caller.

### `409 Conflict`
Lifecycle/state/version/idempotency conflict.

### `422 Unprocessable Entity`
Well-formed request fails domain validation where this distinction is useful.

### `429 Too Many Requests`
Rate/abuse limit reached.

### `500/503`
Unexpected/server/dependency failure. Do not leak internal stack traces or secrets.

Cross-workspace object probing should generally resolve to `404` where hiding existence is desirable.

## 20. Request IDs and Correlation

Every API request receives a server-generated or validated correlation/request ID.

Use it across:

- application logs;
- audit events;
- background jobs;
- error reporting;
- export jobs;
- future distributed services.

Do not treat arbitrary client-supplied request IDs as globally trustworthy identifiers.

## 21. Input Validation

Every endpoint validates:

- schema;
- type;
- length;
- allowed values;
- required fields;
- format;
- lifecycle/state transition;
- resource relationships;
- upload metadata;
- business constraints.

Unknown writable fields should be rejected or ignored according to explicit endpoint policy, never automatically persisted.

## 22. Mass-Assignment Protection

Endpoints use explicit writable-field allowlists.

Example field-worker visit update may allow:

```text
departureAt
responses
evidence references
permitted outlet corrections
```

It must not allow caller control over:

```text
workspaceId
projectId
fieldWorkerId
marketOutletId
dataRightsClass
qaStatus
acceptedAt
reviewedBy
createdBy
permissions
```

## 23. Idempotency

Create/submit operations vulnerable to network retries support idempotency.

Recommended header:

```text
Idempotency-Key: <opaque-client-operation-id>
```

The server binds the key to caller + operation + relevant scope and prevents accidental duplicate processing.

Especially important for:

- visit creation;
- final visit submission;
- evidence registration;
- offline sync batches;
- export requests;
- promotion requests.

## 24. Pagination

List endpoints must use bounded pagination.

Prefer opaque cursor-based pagination for high-volume collections rather than unbounded list responses.

The API defines maximum page sizes and refuses attempts to bypass limits.

## 25. Filtering and Sorting

Clients may request only documented filter/sort fields.

The server translates approved filters into constrained persistence queries.

Do not expose a generic arbitrary Firestore query API to the frontend.

## 26. API Surface — Identity and Context

### `GET /api/v1/me`
Returns minimal authenticated profile and available workspace context.

### `GET /api/v1/me/workspaces`
Returns only workspaces with active authorised membership.

### `GET /api/v1/me/assignments`
Field-worker-oriented endpoint returning only own permitted assignments.

## 27. API Surface — Workspaces

```text
GET    /api/v1/workspaces/{workspaceId}
GET    /api/v1/workspaces/{workspaceId}/members
POST   /api/v1/workspaces/{workspaceId}/members
PATCH  /api/v1/workspaces/{workspaceId}/members/{membershipId}
DELETE /api/v1/workspaces/{workspaceId}/members/{membershipId}
```

Membership writes require explicit administration permission and audit events.

`DELETE` here normally means revoke/deactivate membership, not destroy historical records.

## 28. API Surface — Projects

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

Lifecycle transitions are explicit domain operations rather than arbitrary status-field writes.

## 29. API Surface — Survey Definitions

```text
GET  /api/v1/workspaces/{workspaceId}/surveys
POST /api/v1/workspaces/{workspaceId}/surveys
GET  /api/v1/surveys/{surveyDefinitionId}
POST /api/v1/surveys/{surveyDefinitionId}/versions
GET  /api/v1/survey-versions/{surveyVersionId}
POST /api/v1/survey-versions/{surveyVersionId}/publish
```

Published versions are immutable. Editing requires a new draft version.

Field Workers receive only the published survey version required by their assignment/project.

## 30. API Surface — Field Workers

```text
GET  /api/v1/workspaces/{workspaceId}/field-workers
POST /api/v1/workspaces/{workspaceId}/field-workers
GET  /api/v1/field-workers/{fieldWorkerId}
POST /api/v1/projects/{projectId}/field-workers
```

Personal/HR information returned is minimised according to role.

## 31. API Surface — Assignments

```text
GET   /api/v1/projects/{projectId}/assignments
POST  /api/v1/projects/{projectId}/assignments
GET   /api/v1/assignments/{assignmentId}
PATCH /api/v1/assignments/{assignmentId}
POST  /api/v1/assignments/{assignmentId}/accept
POST  /api/v1/assignments/{assignmentId}/start
POST  /api/v1/assignments/{assignmentId}/reassign
POST  /api/v1/assignments/{assignmentId}/cancel
```

Field Workers use assignment-specific operations only for their own assignment where permitted.

## 32. API Surface — Workspace Outlets

```text
GET  /api/v1/workspaces/{workspaceId}/outlets
POST /api/v1/workspaces/{workspaceId}/outlets
GET  /api/v1/workspace-outlets/{workspaceOutletId}
PATCH /api/v1/workspace-outlets/{workspaceOutletId}
POST /api/v1/workspace-outlets/match
```

Field Worker outlet creation should normally occur through assignment/visit workflow rather than unrestricted workspace-level creation.

## 33. API Surface — Visits

```text
POST /api/v1/assignments/{assignmentId}/visits
GET  /api/v1/visits/{visitId}
PATCH /api/v1/visits/{visitId}
POST /api/v1/visits/{visitId}/submit
POST /api/v1/visits/{visitId}/reopen
```

On creation, the server derives workspace/project/fieldWorker/assignment scope from the authoritative assignment.

Field Workers cannot select another worker's identity in the request body.

## 34. API Surface — Responses

Preferred field workflow allows response changes through the visit boundary:

```text
PUT /api/v1/visits/{visitId}/responses/{questionId}
```

The server verifies:

- caller owns/has permitted access to visit;
- visit lifecycle allows editing;
- question belongs to visit's immutable survey version;
- response matches question type/rules;
- caller may modify that response.

## 35. API Surface — Evidence

Recommended upload sequence:

```text
POST /api/v1/visits/{visitId}/evidence/initiate
PUT/POST <controlled upload mechanism>
POST /api/v1/evidence/{evidenceId}/complete
GET /api/v1/evidence/{evidenceId}/access
```

The initiate operation creates authoritative metadata and an approved object target.

The client does not choose an arbitrary protected storage path.

Access endpoint reauthorises every retrieval and either streams the object or returns a short-lived signed URL.

## 36. API Surface — Validation / QA

```text
GET  /api/v1/projects/{projectId}/qa-queue
GET  /api/v1/visits/{visitId}/validations
POST /api/v1/visits/{visitId}/validations
POST /api/v1/validations/{validationId}/override
POST /api/v1/visits/{visitId}/accept
POST /api/v1/visits/{visitId}/return-for-correction
```

Override operations require stronger permission and audit.

## 37. API Surface — Coverage

```text
GET  /api/v1/projects/{projectId}/coverage
GET  /api/v1/projects/{projectId}/coverage/{coverageCellId}
POST /api/v1/projects/{projectId}/coverage/{coverageCellId}/search-event
POST /api/v1/projects/{projectId}/coverage/{coverageCellId}/verify
```

Field clients may submit authorised search/movement evidence, but the server calculates authoritative coverage state/metrics.

A client cannot simply declare an area `verified` unless its role/action permits that transition.

## 38. API Surface — TES Market Universe

Separate namespace and permissions:

```text
GET  /api/v1/market/outlets/lookup
GET  /api/v1/market/outlets/{outletId}
POST /api/v1/market/promotion-requests
GET  /api/v1/market/promotion-requests/{requestId}
POST /api/v1/market/promotion-requests/{requestId}/approve
POST /api/v1/market/promotion-requests/{requestId}/reject
POST /api/v1/market/outlets/{outletId}/merge
```

Market operations are not automatically available to ordinary workspace users.

Promotion requires rights validation and audit.

## 39. API Surface — Reports and Exports

```text
GET  /api/v1/projects/{projectId}/dashboard
GET  /api/v1/projects/{projectId}/reports
POST /api/v1/projects/{projectId}/reports/generate
POST /api/v1/projects/{projectId}/exports
GET  /api/v1/exports/{exportJobId}
GET  /api/v1/exports/{exportJobId}/access
```

Export requests define permitted scope/fields server-side.

The server must prevent users from requesting unauthorised hidden fields through export parameters.

## 40. Export Security

Export is a privileged data-exfiltration capability.

Required controls include:

- explicit `data.export` or domain-specific export permission;
- workspace/project scope;
- field allowlist;
- rights classification checks;
- optional row/count limits;
- audit event;
- short-lived output access;
- expiration/deletion of generated files according to policy.

Viewing a dashboard never implies export permission.

## 41. Bulk Operations

Bulk endpoints require explicit design. Do not expose generic bulk update/delete APIs.

Every bulk operation defines:

- maximum item count;
- required permission;
- allowed fields/actions;
- transactional/batch behaviour;
- partial-failure semantics;
- idempotency behaviour;
- audit requirements.

High-risk bulk operations may require step-up approval in future.

## 42. Offline Sync API

Recommended conceptual endpoint:

```text
POST /api/v1/sync
```

or resource-specific batch endpoints.

Each offline operation contains:

- local operation ID;
- resource/client reference;
- operation type;
- captured timestamp;
- payload;
- optional previous server version.

Server processes each operation independently through normal authorisation and validation.

Offline storage does not allow the client to bypass current revoked access. If membership/assignment was revoked while offline, sync may be rejected.

## 43. Concurrency / Version Conflicts

Mutable resources should carry a version/revision or update timestamp suitable for optimistic concurrency.

The API may require:

```text
If-Match / expectedVersion
```

or equivalent domain version.

Conflicting edits return `409` rather than silently overwriting accepted server changes.

Published survey versions and accepted historical observations remain immutable except through explicit correction/supersession workflows.

## 44. Rate Limiting and Abuse Protection

Apply endpoint-sensitive controls.

Examples:

- authentication/activation attempts;
- outlet lookup;
- evidence initiation;
- export creation;
- geocoding/routing integrations;
- AI analysis;
- bulk operations.

Rate limits may consider user, service identity, IP/device, workspace and endpoint.

Do not rely solely on IP limits for authenticated abuse prevention.

## 45. Evidence Security

Evidence metadata and object access are authorised separately.

A valid object-storage key does not grant access.

Requirements:

- no permanent public protected URLs;
- short-lived signed URLs only after API authorisation where used;
- content-type/size validation;
- malware/file validation where applicable;
- object ownership tied to authoritative evidence metadata;
- export permission separate from ordinary viewing;
- rights classification applied to evidence.

## 46. Geospatial API Security

Geographic endpoints must not accidentally expose restricted client outlet datasets through map bounding-box queries.

Every map/viewport request is still a protected query.

Example:

```text
GET /api/v1/projects/{projectId}/map/outlets?bbox=...
```

The API first resolves project/workspace access, then performs the bounded spatial query.

Future PostGIS adoption changes the query engine, not the authorisation rule.

## 47. Service-to-Service Authentication

Background jobs, analytics, GIS services and AI services use explicit service identities.

Service identities receive narrowly scoped capabilities rather than impersonating a super administrator.

Examples:

- QA AI: read assigned visit/evidence, create validation result;
- export worker: read authorised export job scope, create output;
- analytics publisher: read approved projection/events, write approved analytical sink;
- market matching worker: read permitted candidate/reference fields, create match proposal.

## 48. AI Agent Authorisation

AI is treated as a caller identity, not as a trusted omnipotent component.

An AI agent receives only the minimum permissions and data needed for its function.

AI recommendations that change rights, merge outlets, override QA, alter membership or perform other high-impact actions require explicit authorised workflow/human approval unless a later approved policy says otherwise.

Standing TES principle:

> **No autonomous agent receives simultaneous authority over code, production credentials and deployment.**

## 49. Break-Glass Access

Exceptional privileged access to restricted customer data requires:

- explicit reason;
- authorised actor;
- temporary elevation;
- limited scope;
- expiry;
- audit event;
- post-event review where appropriate.

Break-glass must not become a routine support mechanism.

## 50. Audit Requirements by Operation

Always audit at minimum:

- workspace membership changes;
- role/permission changes;
- project archive/critical lifecycle changes;
- survey publication;
- visit reopen after submission;
- QA override;
- data export/bulk download;
- evidence bulk export;
- Market Universe promotion;
- outlet merge;
- data-right classification change;
- break-glass access;
- denied privileged attempts;
- service identity/security configuration changes.

Audit events record actor, action, resource, scope, outcome, timestamp and request ID without unnecessarily duplicating sensitive payloads.

## 51. Logging vs Auditing

Operational logs and audit records serve different purposes.

**Logs** support debugging/performance/operations and may be retained for shorter periods.

**Audit records** prove significant actions/security decisions and require stronger integrity/retention controls.

Do not place authentication tokens, passwords, secrets or unnecessary client-sensitive payloads into logs.

## 52. CORS and Browser Security

Production API origins must be explicitly controlled.

Use appropriate protections including:

- HTTPS only;
- secure cookie settings if server sessions are used;
- CSRF protection for cookie-authenticated state-changing requests;
- restrictive CORS rather than wildcard credentialed access;
- security headers;
- content-security policy appropriate to the application;
- upload/content controls.

CORS is not authorisation; direct non-browser calls must still be securely denied when unauthorised.

## 53. Firebase App Check

App Check may be used as an additional abuse-control signal for supported clients.

It does not replace authentication or API authorisation.

A valid App Check assertion means the request likely came from an expected application environment; it does not prove the user may access a workspace/resource.

## 54. Secrets and Configuration

Secrets live in environment/secret management, never GitHub source.

Examples:

- Firebase Admin credentials;
- database credentials;
- signing secrets;
- third-party GIS/geocoding keys;
- AI provider keys;
- email/SMS credentials;
- service credentials.

Production and non-production secrets are separated.

## 55. API Dependency Abstraction

External services are accessed through internal provider interfaces where practical.

Examples:

```text
Geocoder
MapProvider
ObjectStorage
NotificationProvider
AIAnalysisProvider
AnalyticsPublisher
```

This prevents application endpoints from becoming tightly coupled to provider-specific contracts.

## 56. Database Abstraction

API/domain services must not expose Firestore document semantics to the frontend.

Conceptually:

```text
API Controller
    |
Application Service
    |
Domain / Policy
    |
Repository Interface
    |
+---+----------------+
|                    |
Firestore          PostgreSQL/PostGIS
MVP                Target
```

This is essential to the planned Firebase-to-PostGIS evolution.

## 57. API Security Test Matrix

Before production, automated/integration tests must prove at minimum:

1. no token -> protected endpoint denied;
2. invalid/expired token -> denied;
3. suspended Survey Guru user -> denied;
4. valid user without workspace membership -> denied;
5. valid user in Workspace A cannot retrieve Workspace B resource by guessed ID;
6. valid user cannot change request `workspaceId` to cross boundary;
7. Field Worker cannot enumerate project-wide assignments;
8. Field Worker cannot retrieve another worker's visit;
9. Field Worker cannot submit another `fieldWorkerId` to take ownership;
10. client role cannot retrieve internal QA-only fields;
11. Analyst read permission does not permit export;
12. workspace permission does not grant Market Universe permission;
13. data-right value in client payload cannot upgrade usage rights;
14. ordinary user cannot approve Market Universe promotion;
15. published survey version cannot be mutated;
16. evidence object cannot be accessed by guessing storage key;
17. signed evidence access expires;
18. hidden/disabled UI controls can be manually invoked without gaining authority;
19. mass-assignment fields are rejected/ignored safely;
20. invalid state transition returns safe error;
21. repeated idempotent submission does not duplicate business action;
22. revoked assignment fails subsequent offline sync where no longer permitted;
23. export cannot request unauthorised fields;
24. bulk operation cannot exceed caller scope;
25. service/AI identity cannot call outside its granted permissions;
26. privileged action creates audit event;
27. cross-workspace probing does not leak sensitive existence/details through errors;
28. direct Firestore/Storage access remains denied for protected data.

## 58. Security Review Gate

No new API endpoint handling protected data is production-ready until its implementation specifies:

```text
Authentication requirement
Required permission(s)
Resource scope
Workspace/project/assignment resolution
Data-right policy
Writable/readable fields
Validation rules
Rate/abuse limits where needed
Audit requirement
Idempotency requirement
Error behaviour
Security tests
```

This checklist should become part of code review and autonomous-agent development mandates.

## 59. API Implementation Build Order

### Foundation
1. `/api/v1` structure
2. token/session verification
3. user-status resolver
4. request/correlation ID
5. standard error envelope
6. schema validation framework

### Authorisation Core
7. workspace membership resolver
8. permission resolver
9. project-scope resolver
10. assignment-scope resolver
11. data-right policy resolver
12. reusable `authorize()` policy layer
13. audit writer

### Operational APIs
14. identity/context
15. workspaces/memberships
16. projects
17. survey definitions/versioning
18. field workers
19. assignments
20. workspace outlets
21. visits/responses
22. evidence
23. validation/QA
24. coverage

### Privileged / Intelligence APIs
25. Market Universe lookup
26. promotion workflow
27. reports/exports
28. bulk operations
29. service/AI identities

### Production Gate
30. rate limiting
31. security test suite
32. direct Firestore/Storage denial tests
33. audit verification
34. load/performance testing
35. incident/logging readiness

## 60. Locked API & Authorisation Decisions

1. API/backend is Survey Guru's primary application security boundary.
2. UI controls never grant authority.
3. Protected business data is API-only by default.
4. Firebase Authentication establishes identity, not workspace authority.
5. Authoritative memberships/permissions are server-loaded.
6. Every protected resource is resolved server-side before authorisation.
7. Workspace isolation is enforced in backend queries and resource checks.
8. Project and assignment scope are independent access dimensions.
9. Field Worker access is assignment-centric.
10. Market Universe permissions are separate from workspace permissions.
11. Data-right classifications are enforced server-side.
12. API responses are field-minimised by role/purpose.
13. Client-supplied security/scope fields are never trusted as authority.
14. Writes use explicit field allowlists.
15. Published survey versions are immutable.
16. Evidence access requires API authorisation; object keys are not credentials.
17. Export is separately permissioned and audited.
18. Bulk operations are explicitly designed, bounded and audited.
19. Offline sync is reauthorised when it reaches the server.
20. Idempotency is required for retry-prone business operations.
21. External/service/AI callers use scoped service identities.
22. AI is not a privileged bypass around normal security.
23. Firestore implementation details do not leak into the public application contract.
24. The API must survive migration from Firestore to PostgreSQL/PostGIS without changing core authorisation principles.
25. Security acceptance tests include direct endpoint invocation with the UI completely bypassed.
26. No autonomous agent receives simultaneous authority over code, production credentials and deployment.

## 61. Next Specification

With the data model, persistence boundary and API security architecture established, the next implementation document should be:

**Survey Guru MVP Functional Specification v1.0**

It will define exactly what the first usable Survey Guru release does for administrators, project managers, field workers, QA users and client viewers, including project setup, questionnaire configuration, territory assignment, field capture, outlet handling, coverage, QA, dashboarding and exports.

---

This is a living TES architecture specification. Material changes must be version-controlled in the Survey Guru repository.