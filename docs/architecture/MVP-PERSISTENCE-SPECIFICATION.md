# Survey Guru MVP Persistence Specification v1.1

**Product Owner:** TES — Task Expert Systems  
**Operational / Field Partner:** Taskraft (Pty) Ltd  
**Status:** Approved MVP Persistence Baseline / Living Document  
**Version:** 1.1  
**Updated:** 9 September 2026

## 1. Purpose

This specification translates the Survey Guru Data Model, Security Model, Coverage Model, Field Capture & Offline Workflow and QA architecture into the persistence design for the first production-capable MVP.

The objective is to get Survey Guru operational quickly using Firebase while preserving a clean migration path to PostgreSQL/PostGIS, H3, Cloud Storage and BigQuery.

> **Firestore is an MVP persistence implementation. It is not the canonical definition of the Survey Guru domain.**

> **Protected business data is API-only by default. The browser/UI does not receive general-purpose authority to read or write Firestore directly.**

## 2. MVP Stack Boundary

```text
Next.js + TypeScript / Field PWA
          |
          | HTTPS + Firebase identity/session
          v
Survey Guru API / Server Layer
          |
          +-- verify identity
          +-- resolve workspace membership
          +-- resolve permission
          +-- resolve project/assignment/resource scope
          +-- enforce data rights
          +-- validate payload
          +-- enforce idempotency
          +-- derive authoritative state
          +-- audit privileged actions
          |
          v
Firebase Admin SDK
          |
     +----+---------+
     |              |
 Firestore       Storage
 metadata/state  evidence binaries
          |
          v
Future controlled migration
PostgreSQL + PostGIS + H3 + Cloud Storage + BigQuery
```

Firebase Authentication proves identity. Application authority is resolved from backend data, not UI state or untrusted client claims.

## 3. Access Policy

All Survey Guru business collections are API-only for normal end-user application access.

This includes identity context, organisations, memberships, projects, survey definitions, field workers, assignments, outlets, visits, responses, evidence metadata, movement, coverage, QA, Market Universe, integrations, exports and audit data.

A future direct-client exception must be explicitly documented, independently protected by Firebase Security Rules and security-tested. Direct access is never enabled merely for development convenience.

Firebase Admin credentials are server-only and must never be shipped to the browser, committed to GitHub or exposed through public environment variables.

## 4. Persistence Principles

1. Domain IDs are persistence-neutral.
2. Firestore document paths never become business identity.
3. Scope fields are explicit for server authorisation/querying.
4. Protected writes flow through the API.
5. Source evidence is preserved separately from derived state.
6. Offline writes are idempotent.
7. Material state changes preserve lineage/audit.
8. Binary evidence belongs in Storage, not Firestore.
9. Large geometry is referenced/simplified rather than embedded indiscriminately.
10. Collections are designed so PostGIS migration does not require redefining the domain.
11. Client-private and TES Market Universe data remain explicitly separated.
12. Raw worker movement receives tighter access/retention than derived coverage.

## 5. ID Strategy

`users/{firebaseUid}` uses Firebase UID as document key.

All durable domain entities use application-generated immutable portable IDs, preferably ULID-compatible or equivalent.

Representative prefixes:

```text
org_ organisation
ws_  workspace
prj_ project
svd_ survey definition
svv_ survey version
fw_  field worker
asn_ assignment
ssn_ search session
mvb_ movement batch
mve_ movement event
str_ street segment
pst_ project street segment
trv_ street traversal
vst_ visit
wso_ workspace outlet
out_ market outlet
evd_ evidence
vlr_ validation result
qaw_ QA work item
inj_ integration job
```

Offline-created IDs must remain stable through retry/sync.

## 6. Collection Strategy

Use top-level collections for operational entities requiring cross-project, worker, QA, sync or administrative queries.

Operational documents carry explicit scope references such as `workspaceId`, `projectId`, `assignmentId` and `fieldWorkerId` where applicable.

This deliberate denormalisation supports efficient Firestore querying and backend authorisation while remaining straightforward to migrate to relational foreign keys.

Nested subcollections are used only where strong parent-locality materially helps and does not hinder authorisation/querying.

## 7. MVP Collection Catalogue

```text
users
organisations
organisationMemberships
workspaces
workspaceMemberships
roleDefinitions
projects
surveyDefinitions
surveyVersions
surveySections
surveyQuestions
geographies
projectZones
streetSegments
projectStreetSegments
coverageCells
projectCoverageCells
coveragePolicies
fieldWorkers
projectFieldWorkers
assignments
searchSessions
movementBatches
movementEvents
streetTraversals
cellTraversals
coverageSnapshots
coverageExceptions
coverageVerifications
coverageOverrides
workspaceOutlets
outletCandidates
marketOutlets
outletAliases
clientOutletReferences
outletIdentityResolutions
marketPromotionRequests
visits
responses
responseRows
observations
evidence
validationRules
validationResults
qaWorkItems
correctionRevisions
revisitTasks
integrationProfiles
integrationJobs
integrationAttempts
importBatches
exportJobs
auditEvents
```

Future collections may include opportunities, recommendations, model runs, certifications, device registrations and retention/deletion workflows.

## 8. Platform / Membership Collections

### `users`
Key: Firebase UID.

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

### `organisations`

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

### `organisationMemberships`

```text
organisationMembershipId
organisationId
userId
roleKey
status
validFrom
validUntil
createdAt
updatedAt
```

### `workspaces`

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

### `workspaceMemberships`

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

Required query patterns include `userId + status`, `workspaceId + status`, and `workspaceId + userId`.

### `roleDefinitions`

```text
roleKey
scopeType
displayName
permissions[]
status
version
updatedAt
```

Roles are convenience bundles. API evaluates permissions plus resource scope.

## 9. `projects`

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
activeCoveragePolicyId
status
startDate
endDate
expectedOutletCount
coverageMode
createdBy
createdAt
updatedAt
completedAt
archivedAt
```

Lifecycle:

```text
draft -> configured -> active -> paused -> completed -> archived
```

## 10. Survey Definition Collections

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
conditionalRuleRefs[]
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
validationRuleRefs[]
optionDefinitions
observationMapping
evidenceRequirements
```

## 11. Geography Collections

### `geographies`

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
sourceVersion
usageRights
createdAt
updatedAt
```

Complex authoritative geometry is migration-targeted to PostGIS.

### `projectZones`

```text
zoneId
workspaceId
projectId
name
zoneType
geometryReference
centroid
boundingBox
status
createdAt
updatedAt
```

## 12. `streetSegments`

Reference street/path network entity.

```text
streetSegmentId
sourceProvider
sourceFeatureId
sourceVersion
streetName
roadClass
lengthMeters
startNodeRef
endNodeRef
geometryReference
simplifiedGeometryOptional
boundingBox
centroid
isWalkable
isDriveable
usageRights
status
validFrom
validTo
createdAt
updatedAt
```

The TES `streetSegmentId` is authoritative identity. Provider IDs are references.

Firestore should not become the long-term store for national-scale detailed line geometry. MVP stores only the project-relevant geometry/reference required for field use while the target is PostGIS.

## 13. `projectStreetSegments`

```text
projectStreetSegmentId
workspaceId
projectId
zoneId
streetSegmentId
eligible
requiredForCompletion
coveragePolicyId
segmentLengthMeters
currentCoverageState
currentCoveragePercent
currentConfidence
lastEvidenceAt
lastCalculatedAt
coverageAlgorithmVersion
createdAt
updatedAt
```

States:

```text
UNCOVERED
PARTIALLY_COVERED
COVERED
VERIFIED
```

Common indexes:

- `projectId + zoneId + currentCoverageState`
- `projectId + requiredForCompletion + currentCoverageState`
- `projectId + streetSegmentId`

## 14. `coverageCells`

Reusable H3/area index metadata.

```text
coverageCellId
h3Index
h3Resolution
geometryReferenceOptional
centroid
createdAt
```

H3 index is not the domain primary key requirement, although it may be used as a unique indexed value.

## 15. `projectCoverageCells`

```text
projectCoverageCellId
workspaceId
projectId
zoneId
coverageCellId
eligibleAreaPercent
coveragePolicyId
currentCoverageState
currentCoveragePercent
currentConfidence
outletsFoundCount
searchedZeroFound
lastEvidenceAt
lastCalculatedAt
algorithmVersion
createdAt
updatedAt
```

Area states:

```text
UNVISITED
IN_PROGRESS
SEARCHED
VERIFIED
```

Indexes:

- `projectId + zoneId + currentCoverageState`
- `projectId + searchedZeroFound`

## 16. `coveragePolicies`

Versioned project coverage configuration.

```text
coveragePolicyId
workspaceId
projectId
version
mode
status
eligibleRoadClasses[]
movementModesAllowed[]
gpsQualityConfiguration
samplingConfiguration
partialTraversalConfiguration
coveredTraversalConfiguration
continuityConfiguration
cellCoverageConfiguration
verificationRequired
zeroFoundConfiguration
retentionPolicyRef
activatedAt
createdBy
createdAt
```

Exact traversal/GPS thresholds are configuration and field-pilot outcomes, not hard-coded globally.

## 17. Field Worker Collections

### `fieldWorkers`

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

### `projectFieldWorkers`

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

Sensitive HR information is not duplicated unnecessarily.

## 18. `assignments`

```text
assignmentId
workspaceId
projectId
fieldWorkerId
assignmentType
targetType
targetId
zoneId
coveragePolicyId
status
priority
scheduledDate
dueAt
acceptedAt
startedAt
submittedAt
completedAt
reassignedAt
createdBy
createdAt
updatedAt
```

Assignment types include outlet survey, discovery, verification, re-survey, coverage zone, QA revisit and anomaly investigation.

Indexes:

- `fieldWorkerId + status + scheduledDate`
- `projectId + status`
- `projectId + zoneId + status`
- `workspaceId + projectId + assignmentType + status`

Assignment history must be reconstructable for offline authority evaluation.

## 19. `searchSessions`

```text
searchSessionId
workspaceId
projectId
assignmentId
fieldWorkerId
coveragePolicyId
coveragePolicyVersion
state
startedAt
pausedAt
resumedAt
endedAt
sourceDeviceRef
localCreatedAt
serverReceivedAt
createdAt
updatedAt
```

States:

```text
READY
ACTIVE_SEARCH
VISIT_IN_PROGRESS
PAUSED
COMPLETED
CANCELLED
```

Indexes:

- `assignmentId + state`
- `fieldWorkerId + state + startedAt`
- `projectId + state`

## 20. `movementBatches`

Idempotent sync envelope.

```text
movementBatchId
workspaceId
projectId
assignmentId
searchSessionId
fieldWorkerId
deviceGeneratedId
sequenceStart
sequenceEnd
capturedFrom
capturedTo
eventCount
idempotencyKey
syncStatus
receivedAt
processedAt
processingVersion
rejectionReasonOptional
```

Unique/idempotency enforcement is handled by the API/domain logic because Firestore does not provide relational unique constraints in the same way as PostgreSQL.

## 21. `movementEvents`

Raw movement evidence.

```text
movementEventId
workspaceId
projectId
assignmentId
searchSessionId
movementBatchId
fieldWorkerId
capturedAt
location
accuracyMeters
speedOptional
headingOptional
captureMode
sequenceNumber
sourceDeviceRef
createdAt
```

Raw movement access is restricted. Normal client/supervisor map APIs should return derived coverage rather than unrestricted trails.

Retention may be shorter than derived traversal/coverage.

High-volume movement must be monitored carefully in Firestore for cost/scale. Batch/compact representation may be introduced behind the API if event-per-document proves inefficient, provided evidence integrity and migration portability are preserved.

## 22. `streetTraversals`

Derived street traversal evidence.

```text
streetTraversalId
workspaceId
projectId
projectStreetSegmentId
streetSegmentId
assignmentId
searchSessionId
fieldWorkerId
firstObservedAt
lastObservedAt
matchedGeometryReference
traversedMeters
uniqueTraversedMeters
segmentLengthMeters
traversedPercent
continuityScore
gpsQualityScore
matchConfidence
coverageContribution
algorithmVersion
sourceMovementBatchIds[]
createdAt
updatedAt
```

Street Traversal is derived and can be recalculated without rewriting Movement Events.

## 23. `cellTraversals`

Area/H3 fallback/hybrid search evidence.

```text
cellTraversalId
workspaceId
projectId
projectCoverageCellId
coverageCellId
assignmentId
searchSessionId
fieldWorkerId
observedFrom
observedTo
movementGeometryReference
searchEvidenceScore
coverageContribution
confidence
algorithmVersion
sourceMovementBatchIds[]
createdAt
updatedAt
```

## 24. `coverageSnapshots`

Efficient derived read model for maps/reports.

```text
coverageSnapshotId
workspaceId
projectId
assignmentIdOptional
zoneIdOptional
generatedAt
sourceVersion
coverageAlgorithmVersion
eligibleStreetMeters
coveredStreetMeters
partialStreetMeters
uncoveredStreetMeters
verifiedStreetMeters
coveragePercent
cellsSearched
cellsOutstanding
outletsFound
searchedZeroFoundUnits
exceptionCount
createdAt
```

Snapshots are immutable or append/version oriented. They are not the underlying source of truth.

## 25. `coverageExceptions`

```text
coverageExceptionId
workspaceId
projectId
assignmentIdOptional
fieldWorkerIdOptional
projectStreetSegmentIdOptional
projectCoverageCellIdOptional
exceptionType
severity
detectedAt
evidenceRefs[]
algorithmVersion
status
resolutionCode
resolutionNotes
resolvedBy
resolvedAt
createdAt
updatedAt
```

Examples: GPS jump, parallel-road ambiguity, insufficient traversal, coverage hole, stale reassigned evidence.

## 26. `coverageVerifications`

```text
coverageVerificationId
workspaceId
projectId
resourceType
resourceId
verificationMethod
sourceSnapshotVersion
notes
verifiedBy
verifiedAt
createdAt
```

Verification does not delete underlying evidence.

## 27. `coverageOverrides`

```text
coverageOverrideId
workspaceId
projectId
resourceType
resourceId
previousState
newState
reasonCode
reasonText
evidenceRefOptional
performedBy
performedAt
```

Server-only privileged operation, separately permissioned and audited.

## 28. Workspace Outlet vs TES Market Outlet

### `workspaceOutlets`

```text
workspaceOutletId
workspaceId
canonicalName
location
locationAccuracy
address
outletType
status
marketOutletIdOptional
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

A Workspace Outlet may remain client-private indefinitely.

### `marketOutlets`

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
h3Indexes[]
sourceSummary
dataRightsClass
createdAt
updatedAt
```

Market Universe access is API-only and separately permissioned.

## 29. `outletCandidates`

```text
outletCandidateId
workspaceId
projectIdOptional
assignmentIdOptional
fieldWorkerIdOptional
candidateName
location
locationAccuracy
addressOptional
phoneOptional
sourceType
sourceId
identityStatus
identityConfidence
dataRightsClass
createdAt
resolvedAt
resolvedWorkspaceOutletIdOptional
resolvedMarketOutletIdOptional
```

Candidate state prevents uncertain identity from becoming canonical prematurely.

## 30. `outletAliases`

```text
outletAliasId
outletId
aliasName
sourceType
sourceId
firstSeenAt
lastSeenAt
confidence
createdAt
```

## 31. `clientOutletReferences`

```text
clientOutletReferenceId
workspaceId
clientOrgId
workspaceOutletId
marketOutletIdOptional
clientSystem
clientCustomerCode
clientCustomerName
status
validFrom
validTo
createdAt
updatedAt
```

Index: `workspaceId + clientSystem + clientCustomerCode`.

## 32. `outletIdentityResolutions`

```text
outletIdentityResolutionId
workspaceId
projectIdOptional
candidateOutletId
matchedOutletIds[]
resolution
survivingOutletIdOptional
reason
evidenceRefs[]
performedBy
performedAt
createdAt
```

Permanent merges are governed and history preserving.

## 33. `marketPromotionRequests`

```text
promotionRequestId
workspaceId
workspaceOutletId
proposedMarketOutletIdOptional
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

Capture never automatically promotes data to the TES Market Universe.

## 34. `visits`

```text
visitId
workspaceId
projectId
assignmentId
fieldWorkerId
searchSessionIdOptional
workspaceOutletId
marketOutletIdOptional
surveyVersionId
status
arrivalAt
departureAt
submittedAt
captureLocation
captureGpsAccuracy
captureLocationAt
deviceReference
syncStatus
qaStatus
dataRightsClass
revisionNumber
createdAt
updatedAt
```

Indexes:

- `projectId + status + submittedAt`
- `fieldWorkerId + submittedAt`
- `workspaceOutletId + submittedAt`
- `assignmentId`
- `projectId + qaStatus + submittedAt`

## 35. `responses`

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
revisionNumber
createdAt
updatedAt
```

## 36. `responseRows`

Stable repeatable rows for product/price capture.

```text
responseRowId
workspaceId
projectId
visitId
surveyVersionId
groupKey
rowSequence
values
status
revisionNumber
createdAt
updatedAt
```

Stable row IDs are required for offline and integration idempotency.

## 37. `observations`

```text
observationId
workspaceId
projectId
visitIdOptional
workspaceOutletIdOptional
marketOutletIdOptional
observationType
observationKey
value
sourceType
sourceId
observedAt
fieldWorkerIdOptional
confidence
dataRightsClass
usageRights
algorithmVersionOptional
createdAt
```

## 38. `evidence`

Metadata only; binary objects reside in protected Storage.

```text
evidenceId
workspaceId
projectId
visitIdOptional
workspaceOutletIdOptional
questionIdOptional
observationIdOptional
resourceType
resourceId
evidenceType
storageObjectKey
contentType
sizeBytes
checksum
capturedAt
captureLocationOptional
captureGpsAccuracyOptional
sourceDeviceRef
status
validationStatus
dataRightsClass
createdBy
createdAt
updatedAt
```

Evidence lifecycle:

```text
CAPTURED_LOCAL -> UPLOAD_PENDING -> UPLOADED -> VALIDATING -> ACCEPTED
```

Exceptions:

```text
UPLOAD_FAILED | REJECTED | REPLACEMENT_REQUIRED
```

## 39. Storage Object Strategy

Protected evidence must not use permanent public URLs.

Conceptual object key:

```text
{environment}/workspaces/{workspaceId}/projects/{projectId}/visits/{visitId}/evidence/{evidenceId}/{opaqueFilename}
```

The path is organisational convenience, not authority.

Preferred access:

1. API authorises and proxies/streams; or
2. API authorises and issues short-lived signed URL.

API never accepts an arbitrary Storage path as proof of access.

Uploads should use a controlled create/finalise pattern where useful so evidence metadata can distinguish expected upload from confirmed object integrity.

## 40. `validationRules`

```text
validationRuleId
ruleCode
name
domain
version
severity
appliesTo
workspaceIdOptional
projectIdOptional
configuration
workerMessage
qaMessage
autoResolutionPolicy
status
activeFrom
activeTo
createdBy
createdAt
```

Severities:

```text
BLOCK
WARN
FLAG_FOR_QA
INFO
```

## 41. `validationResults`

```text
validationResultId
workspaceId
projectId
ruleCode
ruleVersion
resourceType
resourceId
visitIdOptional
evidenceIdOptional
severity
status
observedValueSummary
reason
createdAt
resolvedAt
resolvedBy
resolutionCode
resolutionNotes
```

Indexes:

- `projectId + status + severity + createdAt`
- `resourceType + resourceId + status`
- `visitId + status`

## 42. `qaWorkItems`

```text
qaWorkItemId
workspaceId
projectId
resourceType
resourceId
priority
reasonCodes[]
validationResultRefs[]
assignedToOptional
status
createdAt
dueAtOptional
resolvedAt
resolution
updatedAt
```

Indexes:

- `projectId + status + priority + createdAt`
- `assignedToOptional + status + priority`
- `workspaceId + status + dueAt`

## 43. `correctionRevisions`

```text
correctionRevisionId
workspaceId
projectId
resourceType
resourceId
qaWorkItemId
revisionNumber
changedFields
previousValueRefs
newValueRefs
reason
submittedBy
submittedAt
validationStatus
createdAt
```

Original submitted values/history are preserved.

## 44. `revisitTasks`

```text
revisitTaskId
workspaceId
projectId
originalVisitId
workspaceOutletId
qaWorkItemId
reasonCode
requiredActions[]
priority
status
createdAt
assignedAssignmentIdOptional
completedVisitIdOptional
completedAt
```

A revisit produces a new Visit.

## 45. Integration Persistence

### `integrationProfiles`

```text
integrationProfileId
workspaceId
clientSystem
profileVersion
status
configurationRef
fieldMappingVersion
adapterVersion
externalIdentityPolicy
createdAt
activatedAt
updatedAt
```

Secrets/tokens are stored through approved secret/identity mechanisms, not ordinary profile documents.

### `integrationJobs`

```text
integrationJobId
workspaceId
projectId
visitId
integrationProfileId
idempotencyKey
status
attemptCount
lastAttemptAt
externalReferenceOptional
adapterVersion
interfaceVersionOptional
errorCodeOptional
createdAt
completedAt
updatedAt
```

### `integrationAttempts`

```text
integrationAttemptId
integrationJobId
workspaceId
projectId
attemptNumber
startedAt
completedAt
result
errorCodeOptional
interfaceVersion
createdAt
```

For Premier WTS v2.006, `SYNCED` requires confirmed final `Submit Surveys` success, not merely intermediate form population.

## 46. `importBatches`

```text
importBatchId
workspaceIdOptional
sourceType
sourceName
sourceVersion
sourceFileHashOptional
dataRightsClass
status
recordCounts
startedAt
completedAt
createdBy
createdAt
```

Historical 80,000+ outlet data should enter through controlled batches with provenance and identity resolution, not direct blind insertion into `marketOutlets`.

## 47. `exportJobs`

```text
exportJobId
workspaceId
projectIdOptional
requestedBy
exportType
filters
requestedFields
includeEvidence
rightsScope
coverageSnapshotIdOptional
schemaVersion
status
outputStorageKeyOptional
expiresAtOptional
createdAt
startedAt
completedAt
```

Exporting is separately authorised from viewing.

## 48. `auditEvents`

Server-only append-oriented trail.

```text
auditEventId
occurredAt
actorType
actorId
action
resourceType
resourceId
workspaceIdOptional
projectIdOptional
requestId
outcome
reasonCode
changeSummary
ipMetadataOptional
deviceMetadataOptional
```

Do not unnecessarily duplicate sensitive payloads.

Audit examples include membership/role changes, denied privileged access, export, visit reopening, QA override, outlet merge, Market Universe promotion, rights change, coverage override/verification, integration configuration and break-glass access.

## 49. Data-Rights Fields

Where records can carry client/market intelligence, include:

```text
dataRightsClass
rightsBasisOptional
sourceType
sourceIdOptional
```

Initial classes:

```text
CLIENT_PRIVATE
OPERATIONAL_SHARED
TES_REFERENCE_PERMITTED
PUBLIC_OR_LICENSED
```

API may not arbitrarily upgrade data into TES-permitted use without authorised rights workflow.

## 50. Server-Derived Fields

The client must not authoritatively set fields such as:

```text
workspaceId derived from resource context where applicable
marketOutletId promotion/link outcome
qaStatus
validation outcome
currentCoverageState
currentCoveragePercent
currentConfidence
searchedZeroFound
coverageAlgorithmVersion
integration success state
reviewedBy / verifiedBy
rights promotion outcome
audit actor identity
```

Client may submit evidence/input; server derives authoritative business state.

## 51. Offline Local Persistence Boundary

The Field PWA maintains a device-local store separate from Firestore authority.

Offline package contains only the worker's authorised minimum:

- assignment/project context;
- immutable Survey Version;
- relevant zones/boundary;
- relevant street segments/simplified geometry;
- relevant coverage cells;
- latest authorised coverage state;
- relevant known outlets/duplicate subset;
- coverage policy/version;
- reference options;
- pending local resources.

It must not contain the entire TES Market Universe merely because that would simplify matching.

## 52. Local Offline Record Envelope

Each syncable local record should carry common metadata:

```text
localId / domainId
entityType
schemaVersion
createdAtLocal
updatedAtLocal
syncState
syncAttempts
lastSyncAttemptAt
serverVersionOptional
idempotencyKey
lastErrorCodeOptional
```

Suggested local states:

```text
LOCAL_ONLY
QUEUED
SYNCING
SYNCED
NEEDS_ATTENTION
SUPERSEDED
```

## 53. Offline Sync Ordering

Conceptual dependency order:

```text
SearchSession / Assignment context
        |
Outlet Candidate / identity
        |
Visit
        |
Responses / ResponseRows
        |
Evidence metadata + binary upload
        |
Movement batches
        |
Authoritative validation / coverage derivation
        |
Integration jobs
```

Safe operations may run concurrently, but dependencies remain explicit.

## 54. Idempotency

Every retryable create/submission endpoint uses a stable domain ID and/or idempotency key.

Critical examples:

- outlet candidate creation;
- visit submission;
- response row submission;
- evidence upload finalisation;
- movement batch ingestion;
- QA correction resubmission;
- integration submission.

The API stores/checks sufficient state to distinguish retry from a new business action.

A future dedicated `idempotencyRecords` collection may be introduced if endpoint-level implementation requires it; until then the domain resource/batch key remains authoritative.

## 55. Optimistic Concurrency / Versioning

Mutable operational documents should carry an appropriate version/revision or `updatedAt` concurrency token where lost updates are possible.

Examples:

- Visit correction revision;
- assignment reassignment;
- QA work item resolution;
- integration profile activation;
- coverage override.

The API should reject stale conflicting mutations with an explicit conflict result rather than silently last-write-wins for high-impact actions.

## 56. Firestore Transactions / Batched Writes

Use transactions/batched writes for small atomic state transitions where Firestore supports them efficiently, such as:

- claim/assign QA item;
- transition Visit and create audit reference;
- link confirmed Workspace Outlet identity;
- update Integration Job attempt counters;
- create controlled promotion decision.

Do not attempt huge coverage recomputations in a single transaction.

## 57. Coverage Calculation Persistence Flow

```text
Movement Batch accepted
        |
Movement Events stored/validated
        |
Map matching / traversal derivation
        |
StreetTraversal / CellTraversal
        |
Update project street/cell current state
        |
Create/update Coverage Exceptions
        |
Generate Coverage Snapshot/read model
```

Every derived record stores algorithm/policy version sufficiently to support later recalculation.

## 58. Local vs Authoritative Coverage

Device may show provisional local coverage.

Firestore `projectStreetSegments` / `projectCoverageCells` represent server-authoritative current state after reconciliation.

The device cannot write `COVERED` or `VERIFIED` directly.

## 59. Searched-Zero-Found Persistence

`searchedZeroFound` is derived only after:

- search/coverage criteria are satisfied;
- pending relevant outlet submissions are reconciled;
- blocking identity/sync conflicts are resolved sufficiently;
- qualifying outlet count is zero.

It is not equivalent to `outletsFoundCount == 0` on an unvisited cell.

## 60. Geometry Persistence Strategy

During MVP:

- Firestore stores centroids/bounds and lightweight/simplified project geometry where necessary;
- detailed evidence geometry may be referenced from Storage or an approved geometry representation;
- API abstracts geometry access;
- H3 indexes support aggregation/filtering;
- no frontend code assumes Firestore is the permanent GIS engine.

Target migration:

```text
StreetSegment geometry       -> PostGIS LINESTRING/MULTILINESTRING
Project/Zone boundary        -> PostGIS POLYGON/MULTIPOLYGON
Outlet location              -> PostGIS POINT
Traversal geometry           -> PostGIS LINESTRING/MULTILINESTRING
Coverage cells               -> H3 index + derived PostGIS polygon when needed
Spatial matching             -> PostGIS/H3 services
```

## 61. Map Query Read Models

The field/supervisor map should not download all raw source documents.

API should provide purpose-specific viewport/assignment responses containing only required geometry/state.

Potential read-model shape:

```text
coverageVersion
bounds
streetFeatures[]
  id
  simplifiedGeometry
  state
  percent
  confidence
outlets[]
  id
  location
  status
cells[]
  h3Index
  state
  percent
syncMetadata
```

Raw movement is excluded unless a specifically authorised QA/support endpoint requires it.

## 62. Index Strategy

Firestore composite indexes must be created from actual protected API query patterns, not speculative combinations.

Initial likely index groups:

```text
workspaceMemberships: userId + status
workspaceMemberships: workspaceId + userId
assignments: fieldWorkerId + status + scheduledDate
assignments: projectId + zoneId + status
projectStreetSegments: projectId + zoneId + currentCoverageState
projectCoverageCells: projectId + zoneId + currentCoverageState
searchSessions: fieldWorkerId + state + startedAt
visits: projectId + qaStatus + submittedAt
visits: workspaceOutletId + submittedAt
validationResults: projectId + status + severity + createdAt
qaWorkItems: projectId + status + priority + createdAt
qaWorkItems: assignedToOptional + status + priority
integrationJobs: projectId + status + createdAt
coverageExceptions: projectId + status + severity + detectedAt
```

Every index still depends on server authorisation; an index is not a security boundary.

## 63. Firestore Document Size Discipline

Avoid unbounded arrays and growing histories in a single document.

Do not embed:

- all Movement Events inside Search Session;
- all Visits inside Outlet;
- all validation history inside Visit;
- all evidence inside Visit;
- all street geometry in Project;
- all team coverage in one project document;
- all integration attempts in Integration Job.

Use separate collections/references.

## 64. High-Volume Movement Cost Gate

Movement evidence is expected to be one of the highest-volume datasets.

Before production rollout, benchmark:

- samples per worker/hour;
- workers/project;
- full-shift writes;
- Firestore write/storage cost;
- query/processing cost;
- offline batch size;
- retention effect.

If event-per-document is unnecessarily expensive, preserve the logical `MovementEvent` model while storing compact immutable batch payloads and derived summaries behind the API. The domain/API must not expose a Firestore-specific storage assumption.

## 65. Retention Classes

Persistence should support separate retention policy by data type.

Example classes:

```text
RAW_MOVEMENT
DERIVED_COVERAGE
VISIT_BUSINESS_RECORD
EVIDENCE_MEDIA
AUDIT_SECURITY
INTEGRATION_LOG
EXPORT_ARTIFACT
```

Raw movement may expire sooner than derived coverage. Export artifacts should normally expire. Business/legal requirements determine actual periods; this specification does not invent universal retention durations.

## 66. Backup / Recovery

Production must define and test:

- Firestore backup/export strategy;
- Storage object protection/versioning where appropriate;
- environment-specific recovery procedure;
- restoration test cadence;
- audit/export artifact handling;
- migration rollback strategy.

A backup that has never been restored in a test is not sufficient evidence of recoverability.

## 67. Environment Separation

```text
DEVELOPMENT
STAGING / TEST
PRODUCTION
```

Use separate Firebase/GCP resources/projects where practical for strong isolation.

Experimental Firestore Rules, indexes, test functions or algorithms must not affect production customer data.

Production service credentials are not shared with autonomous development agents.

## 68. Firebase Security Rules

Even with API-only application architecture, Firestore/Storage Rules remain defense-in-depth where client SDK paths exist or could be accidentally introduced.

Default posture should deny direct business-data access unless explicitly approved.

Security tests must attempt manual Firestore/client-SDK access independent of UI restrictions.

## 69. Migration to PostgreSQL/PostGIS

Migration should occur behind stable API/domain IDs.

Recommended sequence:

1. keep client API contracts stable;
2. establish Postgres/PostGIS schema;
3. backfill selected domains;
4. validate counts/IDs/spatial results;
5. introduce controlled read switch or shadow comparison;
6. avoid uncontrolled dual writes;
7. move authoritative write ownership domain-by-domain;
8. reconcile before cutover;
9. retain rollback capability;
10. retire Firestore ownership only after validation.

Do not redesign IDs during migration.

## 70. Domains Likely to Move First to PostGIS

Priority candidates:

1. Street Segments;
2. Project Street Segments;
3. project/zone boundaries;
4. outlet spatial identity/search;
5. Street Traversals;
6. Coverage Cells/H3 relations;
7. spatial duplicate search;
8. coverage calculation/querying;
9. opportunity spatial features.

Questionnaire/configuration may remain elsewhere longer if operationally sensible.

## 71. BigQuery Boundary

BigQuery is for analytics, historical trend analysis, model feature generation and future opportunity intelligence.

It is not the authoritative transactional source for:

- current Visit status;
- Assignment authority;
- QA resolution;
- outlet identity;
- current coverage;
- permissions.

Replicated analytical datasets retain data-right classification and workspace/client boundaries.

## 72. Monitoring / Operational Metrics

Persistence operations should expose metrics for:

- API write/read failures;
- Firestore latency;
- Storage upload failures;
- offline queue age;
- movement batch backlog;
- traversal processing lag;
- coverage snapshot age;
- QA backlog;
- integration retry backlog;
- Firestore cost/write volume;
- evidence storage growth.

## 73. MVP Persistence Acceptance Criteria

Persistence is ready for field MVP when:

1. browser cannot broadly read/write business collections directly;
2. API independently authorises all protected operations;
3. assignment package can be generated from authorised minimum data;
4. field worker can create stable offline IDs;
5. Visit/Responses/ResponseRows survive retry without duplication;
6. photo evidence survives offline upload/retry and integrity is confirmed;
7. movement batches are idempotent;
8. raw movement produces derived StreetTraversal/CellTraversal;
9. worker cannot directly set authoritative coverage state;
10. street/cell coverage reconciles and updates purpose-specific map reads;
11. searched-zero-found cannot be confused with unvisited;
12. duplicate outlet candidates remain unresolved until governed decision;
13. validation results create QA work where appropriate;
14. correction/revisit history is preserved;
15. Survey Guru acceptance survives third-party integration failure;
16. Premier sync cannot become successful before final Submit Surveys confirmation;
17. export is separately authorised;
18. raw movement access is more restricted than derived coverage;
19. data-right boundaries survive all reads/writes/exports;
20. high-volume movement cost/performance is benchmarked;
21. recovery procedure is tested;
22. migration identifiers are portable to PostGIS.

## 74. Locked Persistence Decisions

1. Firestore is an MVP implementation, not the domain definition.
2. Protected business collections are API-only by default.
3. Firebase Admin credentials remain server-only.
4. Portable immutable domain IDs are mandatory.
5. Top-level operational collections are preferred for scoped queries.
6. `WorkspaceOutlet` and `MarketOutlet` remain separate persisted domains.
7. Capture never automatically promotes data into TES Market Universe.
8. StreetSegment and ProjectStreetSegment are separate.
9. Street and H3/area coverage coexist.
10. SearchSession scopes legitimate field-search evidence.
11. Movement Events are raw evidence; traversal and coverage are derived.
12. Raw movement has tighter access/retention.
13. Authoritative coverage is server-derived; field device state is provisional.
14. Coverage policy and algorithm versions are persisted.
15. Searched-zero-found is explicitly derived and persisted.
16. Coverage exceptions, verification and overrides preserve evidence/history.
17. Repeatable survey rows have stable IDs.
18. Evidence binary data lives in protected Storage.
19. Validation Rules and Results are separate persisted entities.
20. QA work, corrections and revisits preserve historical truth.
21. Integration jobs are asynchronous/idempotent and independent of Survey Guru acceptance.
22. Premier WTS final Submit Surveys confirmation is required for synced state.
23. Offline sync is dependency-aware and idempotent.
24. Large/unbounded arrays are prohibited in operational documents.
25. High-volume movement persistence must pass a production cost/performance gate.
26. Detailed GIS authority migrates toward PostgreSQL/PostGIS behind stable APIs.
27. H3 complements PostGIS rather than replacing it.
28. BigQuery is analytical, not transactional authority.
29. Exports are separately authorised and preferably asynchronous.
30. Environment isolation prevents experimental rules/algorithms from touching production customer data.
31. Firebase Security Rules remain defense-in-depth, not primary application authorisation.
32. No autonomous agent receives simultaneous authority over code, production credentials and deployment.

## 75. Required Follow-On Updates

This persistence update now requires alignment of:

- `API-AUTHORISATION-SPECIFICATION.md` — add movement, street coverage, QA, identity-resolution, integration and offline-sync resource contracts;
- `SCREEN-NAVIGATION-ARCHITECTURE.md` — align field/supervisor maps, QA and Sync surfaces;
- future PostgreSQL/PostGIS Logical Schema;
- future Import & Export Specification.

The next highest-priority architecture document is the **API & Authorisation Specification update**, because the domain and persistence surfaces are now sufficiently defined to specify exact protected API resource behaviour.

---

## Living Documentation Rule

This is a living TES specification. Material discoveries or decisions affecting persistence, offline sync, coverage, movement, QA, outlet identity, evidence, integrations, rights, security, performance, retention or migration must be version-controlled here and in other materially affected Survey Guru/TES documents rather than remaining only in chat or informal notes.
