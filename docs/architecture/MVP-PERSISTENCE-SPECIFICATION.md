# Survey Guru MVP Persistence Specification v1.0

**Product Owner:** TES — Task Expert Systems  
**Operational / Field Partner:** Taskraft (Pty) Ltd  
**Status:** Approved MVP Persistence Baseline / Living Document  
**Version:** 1.0  
**Date:** 7 September 2026

## 1. Purpose

This specification translates the Survey Guru Data Model, Security Model and Data Persistence & GIS Architecture into the concrete persistence design for the first production-capable MVP.

The objective is to get Survey Guru operational quickly using Firebase capabilities while preserving a clean migration path to PostgreSQL/PostGIS, H3 and BigQuery.

> **Firestore is an MVP persistence implementation. It is not the canonical definition of the Survey Guru domain.**

> **Protected business data is API-only by default. The browser/UI does not receive general-purpose authority to read or write Firestore directly.**

## 2. MVP Stack Boundary

```text
Next.js + TypeScript / PWA
          |
          | HTTPS + Firebase ID token/session
          v
Survey Guru API / Server Layer
          |
          +-- verify identity
          +-- resolve membership
          +-- resolve permission
          +-- resolve project/assignment scope
          +-- enforce data rights
          +-- validate payload
          +-- audit privileged actions
          |
          v
Firebase Admin SDK
          |
     +----+-----+
     |          |
 Firestore   Storage
 metadata    evidence
```

Firebase Authentication provides identity. Application authority is resolved from backend data, not UI state or untrusted client claims.

## 3. Access Policy

### 3.1 Default Rule

All Survey Guru business collections are **API-only** for end-user application access.

The frontend must not use broad Firestore client SDK reads/writes for:

- organisations;
- workspaces;
- memberships;
- projects;
- survey definitions/versions;
- field workers;
- assignments;
- visits;
- responses;
- observations;
- evidence metadata;
- validations;
- workspace outlets;
- TES Market Universe outlets;
- coverage;
- exports;
- audit events;
- rights/promotion workflows.

If a future direct-client exception is introduced, it must be explicitly documented, independently protected by Firebase Security Rules and security-tested. Direct access is never enabled merely for development convenience.

### 3.2 Firebase Admin SDK

Admin SDK credentials are server-only. They must never be shipped to the browser, committed to GitHub or exposed through public environment variables.

## 4. ID Strategy

### Users
`users/{firebaseUid}` uses Firebase Authentication UID as the document key.

### Domain Entities
All other durable domain entities use application-generated immutable IDs, preferably ULID-compatible identifiers or an equivalent portable scheme.

Examples:

- `org_...`
- `ws_...`
- `prj_...`
- `srv_...`
- `svv_...`
- `fw_...`
- `asn_...`
- `vst_...`
- `wso_...`
- `out_...`
- `obs_...`
- `evd_...`
- `val_...`

Firestore auto-ID semantics must not become a domain dependency.

## 5. Collection Strategy

Prefer top-level collections for operational entities that require cross-project, cross-worker or administrative querying.

Each operational record carries explicit scope references such as `workspaceId`, `projectId` and `fieldWorkerId` where applicable.

This deliberate denormalisation supports efficient Firestore querying and backend authorisation while remaining straightforward to migrate into relational foreign keys later.

Nested subcollections are used sparingly where the data is structurally inseparable and normally read through its parent.

## 6. Core MVP Collections

```text
users
organisations
organisationMemberships
workspaces
workspaceMemberships
projects
surveyDefinitions
surveyVersions
surveySections
surveyQuestions
geographies
projectZones
fieldWorkers
projectFieldWorkers
assignments
workspaceOutlets
clientOutletReferences
visits
responses
observations
evidence
validations
coverageCells
projectCoverage
marketOutlets
outletAliases
marketPromotionRequests
roleDefinitions
exportJobs
auditEvents
```

Future collections may include opportunities, recommendations, model runs, certifications, device registrations and retention/deletion workflows.

## 7. `users`

Key: Firebase UID.

Core fields:

```text
uid
email
phoneNumber
displayName
status
createdAt
updatedAt
lastLoginAt
```

`status` may include:

`pending | active | suspended | archived`

A user profile is not itself an authorisation grant. Authority comes through memberships and permissions.

## 8. `organisations`

Core fields:

```text
organisationId
legalName
displayName
organisationType
status
createdAt
updatedAt
archivedAt
```

Organisation types may include TES, Taskraft, client, contractor/partner or other approved participant types.

## 9. `organisationMemberships`

Core fields:

```text
organisationMembershipId
organisationId
userId
roleKey
status
createdAt
updatedAt
```

Organisation membership does not automatically grant workspace access.

## 10. `workspaces`

Workspace is a major client/security boundary.

Core fields:

```text
workspaceId
name
workspaceOwnerOrgId
operatingOrgId
status
dataRegion
createdAt
updatedAt
archivedAt
```

Example: Premier WTS Workspace may be owned by Premier, operated by Taskraft and technologically provided by TES.

## 11. `workspaceMemberships`

Authoritative contextual access record.

Core fields:

```text
workspaceMembershipId
workspaceId
userId
organisationId
roleKeys[]
explicitPermissions[]
status
validFrom
validUntil
createdAt
updatedAt
```

Common query/index dimensions:

- `userId + status`
- `workspaceId + status`
- `workspaceId + userId`

The API must load authoritative membership rather than trust workspace/role supplied by the frontend.

## 12. `projects`

Core fields:

```text
projectId
workspaceId
clientOrgId
operatingOrgId
name
projectCode
surveyDefinitionId
activeSurveyVersionId
projectGeographyId
status
startDate
endDate
expectedOutletCount
createdBy
createdAt
updatedAt
completedAt
archivedAt
```

Lifecycle:

`draft -> configured -> active -> paused -> completed -> archived`

## 13. Survey Definition Collections

Use separate top-level collections rather than deeply nesting all questionnaire data. This keeps IDs portable and supports future relational migration.

### `surveyDefinitions`

```text
surveyDefinitionId
workspaceId
name
description
status
currentPublishedVersionId
createdBy
createdAt
updatedAt
```

### `surveyVersions`

```text
surveyVersionId
surveyDefinitionId
workspaceId
versionNumber
status
publishedAt
publishedBy
createdAt
```

Published versions are immutable.

### `surveySections`

```text
sectionId
surveyVersionId
workspaceId
title
sortOrder
```

### `surveyQuestions`

```text
questionId
surveyVersionId
sectionId
workspaceId
questionKey
questionType
prompt
required
sortOrder
validationRules
optionDefinitions
observationMapping
```

## 14. Geography Collections

### `geographies`

Reference/administrative geography.

```text
geographyId
name
geographyType
parentGeographyId
countryCode
geometryReference
centroid
boundingBox
sourceType
sourceId
usageRights
createdAt
updatedAt
```

Firestore stores an MVP-friendly representation/reference. Complex authoritative polygon geometry is designed for later PostGIS migration.

### `projectZones`

```text
zoneId
workspaceId
projectId
name
zoneType
geometryReference
centroid
status
createdAt
updatedAt
```

Zones are operational and may not align with administrative boundaries.

## 15. `fieldWorkers`

Field Worker is a platform operating identity, not synonymous with Taskraft employee.

```text
fieldWorkerId
organisationId
userId
workerType
status
displayName
contactReference
createdAt
updatedAt
```

Possible `workerType`:

`employee | contractor | certified_regional | probationary | trainer | validator`

Sensitive HR information should not be duplicated unnecessarily into Survey Guru.

## 16. `projectFieldWorkers`

Explicit project participation.

```text
projectFieldWorkerId
workspaceId
projectId
fieldWorkerId
roleKey
status
validFrom
validUntil
createdAt
updatedAt
```

Project participation is not sufficient by itself to access every project record; assignment scope still applies.

## 17. `assignments`

Core fields:

```text
assignmentId
workspaceId
projectId
fieldWorkerId
assignmentType
targetType
targetId
zoneId
status
priority
scheduledDate
dueAt
acceptedAt
startedAt
submittedAt
completedAt
createdBy
createdAt
updatedAt
```

Assignment types include outlet survey, discovery, verification, re-survey, coverage zone, QA revisit and anomaly investigation.

Common indexes:

- `fieldWorkerId + status + scheduledDate`
- `projectId + status`
- `projectId + zoneId + status`
- `workspaceId + projectId + assignmentType + status`

## 18. Workspace Outlet vs TES Market Outlet

This distinction is mandatory for data-rights integrity.

### `workspaceOutlets`

Represents an outlet/location known inside a specific workspace. It may be client-private and therefore unable to enter TES's permanent Market Universe.

Core fields:

```text
workspaceOutletId
workspaceId
canonicalName
location
locationAccuracy
address
outletType
status
marketOutletId
matchStatus
matchConfidence
dataRightsClass
sourceType
sourceId
firstObservedAt
lastObservedAt
createdAt
updatedAt
```

`marketOutletId` is nullable and is populated only after an authorised match/promotion process.

### `marketOutlets`

TES Market Universe outlet record, available only where usage rights permit.

```text
outletId
canonicalName
location
outletType
status
firstDiscoveredAt
lastVerifiedAt
locationConfidence
geographyIds[]
h3Indexes
sourceSummary
dataRightsClass
createdAt
updatedAt
```

Market Universe access is server-only and separately permissioned.

## 19. `outletAliases`

```text
outletAliasId
outletId
aliasName
sourceType
sourceId
firstSeenAt
lastSeenAt
confidence
```

## 20. `clientOutletReferences`

Maps client identifiers to workspace/permitted market outlet identities.

```text
clientOutletReferenceId
workspaceId
clientOrgId
workspaceOutletId
marketOutletId
clientCustomerCode
clientCustomerName
status
createdAt
updatedAt
```

Common index:

`workspaceId + clientCustomerCode`

## 21. `visits`

A visit is a physical field event and must remain separate from the outlet.

Core fields:

```text
visitId
workspaceId
projectId
assignmentId
fieldWorkerId
workspaceOutletId
marketOutletId
surveyVersionId
status
arrivalAt
departureAt
submittedAt
captureLocation
captureGpsAccuracy
deviceReference
syncStatus
qaStatus
dataRightsClass
createdAt
updatedAt
```

Common indexes:

- `projectId + status + submittedAt`
- `fieldWorkerId + submittedAt`
- `workspaceOutletId + submittedAt`
- `assignmentId`
- `projectId + qaStatus + submittedAt`

## 22. `responses`

Raw questionnaire answer.

```text
responseId
workspaceId
projectId
visitId
surveyVersionId
questionId
valueType
value
answeredAt
answeredBy
status
dataRightsClass
createdAt
updatedAt
```

The API validates response type and question/version membership before writing.

Raw response is not automatically TES Market Universe intelligence.

## 23. `observations`

Structured factual assertion derived from field capture, rules, QA or future AI.

```text
observationId
workspaceId
projectId
visitId
workspaceOutletId
marketOutletId
observationType
observationKey
value
sourceType
sourceId
observedAt
fieldWorkerId
confidence
dataRightsClass
usageRights
createdAt
```

Observations preserve provenance.

## 24. `evidence`

Metadata only; binary objects reside in Storage.

```text
evidenceId
workspaceId
projectId
visitId
workspaceOutletId
questionId
observationId
evidenceType
storageObjectKey
contentType
sizeBytes
checksum
capturedAt
captureLocation
captureGpsAccuracy
status
validationStatus
dataRightsClass
createdBy
createdAt
updatedAt
```

Evidence lifecycle:

`captured -> uploaded -> validating -> accepted`

or

`rejected | replacement_required`

## 25. Storage Object Strategy

Protected evidence must not use permanent public URLs.

Conceptual object key:

```text
{environment}/workspaces/{workspaceId}/projects/{projectId}/visits/{visitId}/evidence/{evidenceId}/{opaqueFilename}
```

The path is organisational convenience, not authority.

Access options:

1. preferred strict mode: authorised API proxies/streams access; or
2. API performs authorisation and issues a short-lived signed URL.

The API must never accept an arbitrary storage path and return it without resolving the authoritative evidence record and caller permissions.

## 26. `validations`

Every meaningful QA check can be stored independently.

```text
validationId
workspaceId
projectId
visitId
evidenceId
observationId
validationType
validationMode
ruleOrModelId
outcome
confidence
reason
correctiveAction
reviewerUserId
createdAt
```

`validationMode`:

`automated | manual | ai_assisted`

## 27. Coverage Collections

### `coverageCells`

Defines reusable or project-generated spatial cells.

```text
coverageCellId
geographyId
h3Index
h3Resolution
geometryReference
centroid
createdAt
```

### `projectCoverage`

Project-specific state for a coverage cell.

```text
projectCoverageId
workspaceId
projectId
coverageCellId
zoneId
state
visitCount
outletsDiscovered
searchEffortSeconds
lastSearchedAt
lastFieldWorkerId
coverageConfidence
createdAt
updatedAt
```

MVP states:

`unvisited | in_progress | searched | verified`

This is how Survey Guru distinguishes searched-zero-found from unknown/unvisited.

## 28. `marketPromotionRequests`

Controlled bridge from workspace knowledge into TES Market Universe.

```text
promotionRequestId
workspaceId
workspaceOutletId
proposedMarketOutletId
actionType
dataRightsClass
rightsBasis
matchConfidence
status
requestedBy
requestedAt
reviewedBy
reviewedAt
decisionReason
```

Actions may include:

`create_market_outlet | link_existing | merge_candidate | reject`

Promotion is server-controlled and auditable.

## 29. `roleDefinitions`

Role templates may be represented as controlled configuration.

```text
roleKey
scopeType
displayName
permissions[]
status
version
updatedAt
```

High-risk role/permission changes are server-only and audited.

Roles are convenience bundles; the API ultimately evaluates permissions and resource scope.

## 30. `exportJobs`

Exporting is not treated as ordinary reading.

```text
exportJobId
workspaceId
projectId
requestedBy
exportType
filters
requestedFields
includeEvidence
status
outputStorageKey
expiresAt
createdAt
startedAt
completedAt
```

API requires explicit export permission and checks requested fields/data domains before generating output.

Large exports should be asynchronous.

## 31. `auditEvents`

Server-only, append-oriented security and operational audit trail.

```text
auditEventId
occurredAt
actorType
actorId
action
resourceType
resourceId
workspaceId
projectId
requestId
outcome
reasonCode
changeSummary
ipMetadata
deviceMetadata
```

Do not unnecessarily copy sensitive business payloads into audit records.

Audit examples:

- membership/role change;
- denied privileged access;
- export;
- bulk operation;
- visit reopened;
- QA override;
- outlet merge;
- Market Universe promotion;
- data-right change;
- break-glass access;
- service identity/credential lifecycle event where applicable.

Ordinary application users cannot edit/delete audit events.

## 32. Data-Rights Field

Where a record can carry client/market intelligence, include:

```text
dataRightsClass
```

Initial values:

- `CLIENT_PRIVATE`
- `OPERATIONAL_SHARED`
- `TES_REFERENCE_PERMITTED`
- `PUBLIC_OR_LICENSED`

Additional metadata may include rights basis, source and permitted uses where needed.

The API may make a rights classification more restrictive through normal workflows but must not allow arbitrary privilege-like upgrading into TES-permitted use without an authorised rights process.

## 33. Server-Derived Fields

The following must never be trusted merely because the frontend submits them:

```text
workspaceId
projectId
organisationId
fieldWorkerId
userId
role
permissions
dataRightsClass
marketOutletId
createdBy
approvedBy
qaStatus
promotion status
```

For each operation, the API derives or validates scope from authoritative records.

Example: when a field worker submits a visit, the API loads the assignment, obtains its workspace/project/fieldWorker target and writes those values itself.

## 34. Field-Level Write Whitelisting

Every endpoint/service operation defines exactly which fields a caller may modify.

Example: Field Worker visit correction may permit questionnaire responses and replacement evidence but not:

- `workspaceId`;
- `projectId`;
- `fieldWorkerId`;
- QA acceptance;
- data-right classification;
- Market Universe link;
- audit fields.

This prevents mass-assignment vulnerabilities.

## 35. API Authorisation Context

For each protected request the API constructs a server-side context similar to:

```text
AuthenticatedUser
  -> User status
  -> Organisation memberships
  -> Workspace membership
  -> Effective permissions
  -> Project participation
  -> Assignment scope
  -> Resource data rights
  -> Requested action
```

Authorization occurs before database mutation/read output.

Knowing a valid Firestore document ID grants no access.

## 36. Firebase Authentication and Claims

Firebase ID tokens establish authenticated identity.

Custom claims may be used for coarse platform hints/bootstrap where useful, but must not be the sole authoritative source for rapidly changing workspace/project permissions because claims can become stale.

Authoritative workspace membership and resource scope remain in backend data.

Suspended/revoked users must be denied even if an older client UI still displays previously visible options.

## 37. Firebase Security Rules Strategy

Because business data is API-only, Firestore/Storage Rules should default to denying direct client access to protected collections/objects.

Any deliberate direct-client exception must:

- be collection/path-specific;
- require authentication;
- independently validate scope;
- expose only necessary fields/actions;
- have emulator/security tests;
- be documented in this specification.

There are no broad MVP exceptions by default.

## 38. Service Identities

Separate identities should be used as architecture grows:

- runtime API service;
- deployment/migration service;
- scheduled/background jobs;
- analytics export;
- AI/QA services;
- backup/restore processes.

Do not give every service a universal Firebase/Google Cloud administrator identity.

The standing TES principle applies:

> **No autonomous agent receives simultaneous authority over code, production credentials and deployment.**

## 39. Transactions and Consistency

Use Firestore transactions/batches where a business operation requires atomic consistency within Firebase limits.

Examples:

- assignment lifecycle transition plus related metadata;
- approved promotion/link plus audit event;
- membership change plus audit event;
- visit finalisation plus submission status.

Audit creation for privileged actions should be coupled as tightly as practical to the action being recorded.

## 40. Idempotency

Mobile/offline/retry-prone writes should support idempotency.

API requests that create visits, responses/evidence metadata or submission transitions should carry a client-generated operation/idempotency key where duplicate retries could otherwise create duplicate records.

The server remains responsible for final durable IDs and duplicate protection.

## 41. Offline Fieldwork

Survey Guru is expected to operate in areas with unreliable connectivity.

Offline capture must therefore be supported at application level without granting uncontrolled direct Firestore authority.

The field application may securely cache only the minimum necessary:

- own assignments;
- relevant survey version;
- required outlet/zone context;
- unsynchronised responses;
- evidence awaiting upload.

When connectivity returns, synchronisation occurs through the authorised API.

Server-side validation is repeated during sync; offline acceptance by the UI is not final authority.

## 42. Firestore Index Baseline

Likely composite indexes include:

```text
workspaceMemberships: userId, status
workspaceMemberships: workspaceId, status
assignments: fieldWorkerId, status, scheduledDate
assignments: projectId, status
assignments: projectId, zoneId, status
visits: projectId, status, submittedAt
visits: fieldWorkerId, submittedAt
visits: workspaceOutletId, submittedAt
visits: projectId, qaStatus, submittedAt
clientOutletReferences: workspaceId, clientCustomerCode
projectCoverage: projectId, state
validations: projectId, outcome, createdAt
exportJobs: workspaceId, status, createdAt
```

Indexes should be created from actual API query patterns and reviewed for cost/scale. Avoid indexing large fields that are never queried.

## 43. Geospatial MVP Representation

Firestore is not the final spatial query engine.

MVP point records may carry:

```text
latitude
longitude
geohash
h3Index(es)
gpsAccuracy
```

Polygons should have a portable GeoJSON representation or protected object/reference form plus centroid/bounding metadata required for MVP queries.

Complex radius, polygon, topology and spatial-join workloads should progressively move to PostGIS rather than accumulating Firestore workarounds.

## 44. PostGIS Migration Mapping

Firestore collection names deliberately correspond to future relational concepts.

Examples:

```text
workspaceOutlets -> workspace_outlets
marketOutlets -> market_outlets
visits -> visits
responses -> responses
observations -> observations
coverageCells -> coverage_cells
projectCoverage -> project_coverage
```

Portable IDs allow references to survive migration.

Domain/application services should use repository/service interfaces so a future implementation can replace Firestore repositories with PostgreSQL repositories without rewriting the UI/domain workflow.

## 45. BigQuery Boundary

MVP does not require BigQuery to run field operations.

When introduced, BigQuery receives authorised analytical projections/events rather than uncontrolled copies of every Firestore document.

Workspace/data-right classifications must be carried into analytical datasets. Cross-client aggregation is permitted only where contractual/legal/data-right rules allow it.

## 46. Retention and Deletion

Normal operational deletion should use status/archive/supersede patterns.

Hard deletion is reserved for controlled retention/privacy/legal workflows.

Evidence retention may differ from observation/report retention and must be configurable as client requirements mature.

A future retention/deletion job model should be added before automated destructive retention is enabled.

## 47. Backups and Recovery

Production persistence must have documented backup/restore procedures before critical client operations rely on it.

Backups must respect environment and access separation. Restore procedures should be tested rather than assumed.

Migration to PostGIS must include equivalent database backup, point-in-time recovery and restoration testing.

## 48. Environment Separation

Use separate environments:

```text
DEVELOPMENT
STAGING / TEST
PRODUCTION
```

Separate Firebase projects/databases/storage/credentials should be used where practical and mandatory before sensitive production client data is introduced.

Development defaults to synthetic/test data.

Production credentials are not stored in GitHub or developer source files.

## 49. Mandatory Persistence Security Tests

Before production release verify at minimum:

1. browser cannot directly enumerate protected Firestore collections;
2. browser cannot directly retrieve protected Storage objects;
3. unauthenticated API calls are denied;
4. changing workspace/project/document IDs cannot cross boundaries;
5. Field Worker can retrieve only authorised assignments/context;
6. submitted role/workspace/fieldWorker/data-right fields cannot elevate access;
7. client viewer cannot access another client workspace;
8. read permission does not imply export;
9. workspace permission does not imply TES Market Universe permission;
10. signed evidence URLs, if used, are short-lived and issued only after authorisation;
11. revoked/suspended membership loses API access;
12. Market Universe promotion requires rights validation;
13. privileged operations produce audit events;
14. duplicate/retried mobile submissions do not create uncontrolled duplicate visits;
15. published survey versions cannot be modified.

## 50. MVP Persistence Build Order

Recommended implementation order:

### Foundation
1. Firebase projects/environments
2. Firebase Authentication
3. server Firebase Admin setup
4. API authentication middleware
5. users/organisations/workspaces/memberships
6. permission resolver and audit foundation

### Project Configuration
7. projects
8. survey definitions/versions/sections/questions
9. geography/project zones
10. field workers/project participation

### Field Operations
11. assignments
12. workspace outlets
13. visits
14. responses
15. evidence upload/access
16. validations

### Coverage / Market Foundation
17. coverage cells/project coverage
18. client outlet references
19. Market Universe read/matching service
20. controlled promotion workflow

### Operations
21. dashboard query services
22. exports
23. security/performance testing
24. backup/restore validation

## 51. Locked MVP Persistence Decisions

1. Firebase accelerates MVP but does not define the permanent domain model.
2. Protected business data is API-only by default.
3. Firebase Auth proves identity; backend membership/permissions prove authority.
4. Firestore Admin SDK is server-only.
5. Durable domain IDs are portable and immutable.
6. Top-level operational collections are preferred for queryability/migration.
7. Workspace outlet data is explicitly separated from TES Market Universe outlet data.
8. A workspace outlet may remain client-private indefinitely.
9. Market Universe promotion is explicit, rights-checked and audited.
10. Raw responses do not automatically become TES intelligence.
11. Evidence binary data lives in protected object storage.
12. Permanent public evidence URLs are prohibited.
13. Export permission is separate from view/read permission.
14. Scope/security fields are server-derived or independently validated.
15. Endpoint writes use field-level whitelists.
16. Firestore/Storage client rules deny protected direct access by default.
17. Offline capture syncs through the API and is revalidated server-side.
18. Geospatial fields are migration-ready; complex GIS belongs in PostGIS.
19. H3/geohash may support MVP coverage/search but do not replace PostGIS.
20. BigQuery is an authorised analytics projection, not an uncontrolled client-data lake.
21. Development, staging/test and production are separated.
22. Significant privileged actions are auditable.
23. No autonomous agent receives simultaneous authority over code, production credentials and deployment.

## 52. Next Architecture Document

With the persistence boundary now defined, the next document should be:

**Survey Guru API & Authorisation Specification v1.0**

It will define the actual API/service operations, identity verification, authorisation middleware, permission matrix, workspace/project/assignment scoping, resource lookup order, evidence access, export controls, audit requirements and expected 401/403/404 behaviour.

---

This is a living TES architecture specification. Material changes must be version-controlled in the Survey Guru repository.