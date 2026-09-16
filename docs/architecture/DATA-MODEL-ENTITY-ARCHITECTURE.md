# Survey Guru Data Model & Entity Architecture v1.1

**Product Owner:** TES — Task Expert Systems  
**Initial Operational Environment:** Taskraft (Pty) Ltd  
**Status:** Approved Baseline / Living Document  
**Version:** 1.2  
**Updated:** 16 September 2026

## 1. Purpose

This document defines the logical domain model for Survey Guru and the relationships between platform identity, client/workspace field operations, permanent outlet intelligence, geographic coverage, QA and future opportunity intelligence.

The model is intentionally persistence-neutral. Firestore may support the MVP, while PostgreSQL/PostGIS is the target authoritative spatial/relational platform. Domain IDs and API contracts must therefore not depend on Firestore document paths.

## 2. Core Architecture

Survey Guru uses three logically separated data domains:

1. **TES Platform Domain** — identities, organisations, memberships, permissions, configuration and product-level services.
2. **Workspace / Client Domain** — projects, assignments, visits, responses, evidence, QA, coverage evidence and client-specific observations.
3. **TES Market Universe** — permitted permanent outlet/reference/geographic/coverage intelligence and future opportunity intelligence.

> Information does not move from a client workspace into the TES Market Universe merely because Survey Guru captured or processed it.

Movement across the boundary requires explicit rights and an auditable process.

## 3. High-Level Entity Architecture

```text
TES PLATFORM
User
Organisation
OrganisationMembership
Workspace
WorkspaceMembership
Role / Permission
        |
        v
WORKSPACE / CLIENT DOMAIN
Project
SurveyDefinition -> SurveyVersion -> Section -> Question
Geography / ProjectZone
FieldWorker
Assignment
SearchSession
MovementEvent / MovementBatch
StreetTraversal / CellTraversal
ProjectStreetSegment / ProjectCoverageCell
OutletCandidate / WorkspaceOutlet
Visit -> Response -> Observation -> Evidence
ValidationResult -> QAWorkItem -> Correction / Revisit
IntegrationJob
CoverageSnapshot / CoverageException
        |
        | CONTROLLED RIGHTS + PROMOTION BOUNDARY
        v
TES MARKET UNIVERSE
MarketOutlet
OutletAlias
ClientOutletReference
StreetSegment / Reference Geography
Permitted Historical Observations
Coverage Intelligence
Future Opportunity / Recommendation
        |
        v
Future controlled Fleetwize interface
```

## 4. Identity & ID Rules

Every material entity receives an immutable system-generated identifier.

Names, phone numbers, coordinates, client customer numbers, external system IDs and provider road IDs are never primary Survey Guru identifiers.

IDs must be portable across persistence technologies and suitable for idempotent offline creation where required.

Human-readable references may be generated separately.

## 5. Organisation

Represents a legal/business entity participating in Survey Guru, for example TES, Taskraft or a client.

Organisation membership alone does not grant access to all associated workspaces.

Lifecycle:

```text
pending -> active -> suspended -> archived
```

## 6. Organisation Membership

Represents a user's relationship with an Organisation and organisation-level role/context.

It does not replace Workspace Membership or resource-level authorisation.

## 7. Workspace

A major client/data/security boundary.

A Workspace can have:

- owner/client organisation;
- operating organisation;
- separately authorised members;
- projects;
- client-private outlets/observations;
- workspace configuration and integrations.

Taskraft can therefore operate work for a client without collapsing organisational ownership or data-right boundaries.

Lifecycle:

```text
setup -> active -> suspended -> archived
```

## 8. Workspace Membership

Explicit relationship between a User and Workspace.

Conceptual fields include:

```text
workspaceMembershipId
workspaceId
userId
status
roleRefs / permissionRefs
validFrom
validTo
createdAt
```

Workspace membership is necessary but not always sufficient for project/resource access.

## 9. Role & Permission

Roles group permissions for usability; permissions remain the authoritative capability concepts.

Representative roles include:

- TES Super Administrator;
- TES Platform Administrator;
- Organisation Administrator/User;
- Workspace Administrator;
- Project Manager;
- QA/Validator;
- Analyst;
- Client Viewer;
- Field Worker.

Role names must not be trusted from client requests. Backend resolves permissions from authoritative membership/context.

## 10. Project

Belongs to a Workspace and represents defined fieldwork.

Projects reference outlets and geography; they do not own the permanent TES Market Universe.

Conceptual relationships:

```text
Workspace
  -> Project
      -> Survey Version
      -> Project Geography / Zones
      -> Coverage Policy
      -> Field Workers
      -> Assignments
      -> Visits
      -> QA
      -> Coverage
      -> Integration configuration
```

Lifecycle:

```text
draft -> configured -> active -> paused -> completed -> archived
```

Completing or archiving a project does not delete operational history.

## 11. Survey Definition & Versioning

A Survey Definition is the logical questionnaire/product definition.

A Survey Version is an immutable published version containing Sections, Questions, answer types, conditional logic, validation rules and evidence requirements.

```text
SurveyDefinition
      |
      +-- SurveyVersion 1
      +-- SurveyVersion 2
             |
             +-- SurveySection
                    |
                    +-- SurveyQuestion
```

Every Visit records the exact Survey Version used.

## 12. Geography

Supports both administrative and Survey Guru operational geography.

Examples:

```text
Country / Province / Municipality
Market
Territory
Zone
Project Boundary
Coverage Cell
```

Project geography need not align exactly with government boundaries.

Geography records must support source/provenance and spatial geometry references.

## 13. Street Segment

A first-class geographic entity representing the smallest stable road/path unit used for street-level coverage.

Conceptual fields:

```text
streetSegmentId
sourceProvider
sourceFeatureId
sourceVersion
streetName
roadClass
geometry
lengthMeters
startNodeRef
endNodeRef
isWalkable
isDriveable
status
validFrom
validTo
```

`streetSegmentId` is TES-owned. Provider feature IDs are references, not permanent Survey Guru identity.

Street data is provider/version aware so geographic intelligence remains portable.

## 14. Project Street Segment

Represents how a master Street Segment participates in a specific Project.

```text
projectStreetSegmentId
projectId
streetSegmentId
zoneId
eligible
requiredForCompletion
coverageWeight
coveragePolicyId
currentCoverageState
currentCoveragePercent
currentConfidence
```

The same physical street can therefore have different eligibility/coverage requirements across projects.

## 15. Coverage Cell

An H3 cell or other approved area coverage unit used alongside street-level coverage.

Conceptual:

```text
coverageCellId / h3Index
resolution
geometryDerived
```

H3 is an indexing/aggregation mechanism and does not replace authoritative PostGIS geometry.

## 16. Project Coverage Cell

Represents project-specific coverage state for an area cell.

```text
projectCoverageCellId
projectId
coverageCellId
zoneId
eligibleAreaPercent
coverageState
coveragePercent
coverageConfidence
outletsFoundCount
searchedZeroFound
lastEvidenceAt
```

## 17. Coverage Policy

A versioned configuration defining how a Project interprets movement/search evidence.

Conceptual fields:

```text
coveragePolicyId
workspaceId
projectId
mode
version
eligibleRoadClasses
movementModesAllowed
minimumGpsAccuracyRule
samplingPolicy
partialTraversalThreshold
coveredTraversalThreshold
continuityRule
cellCoverageRule
verificationRequired
zeroFoundRule
retentionPolicyRef
activatedAt
```

Modes may include:

```text
EXHAUSTIVE_STREET
OPPORTUNITY_LED
KNOWN_OUTLET
AREA_SEARCH
```

Material changes create a new policy version.

## 18. Outlet Domains — Critical Distinction

Survey Guru distinguishes a Workspace-known outlet from a TES Market Universe outlet.

### Workspace Outlet
A physical outlet/location known within a client Workspace. It may remain `CLIENT_PRIVATE` indefinitely.

### Market Outlet
A permanent outlet in the TES Market Universe only where provenance, validation and data rights permit.

This distinction prevents automatic leakage of client-private captured locations into TES shared/reference intelligence.

## 19. Workspace Outlet

Conceptual fields:

```text
workspaceOutletId
workspaceId
canonicalDisplayName
location
status
identityConfidence
sourceType
sourceRef
rightsClassification
createdAt
```

A Workspace Outlet can be linked to a Market Outlet only through an authorised relationship/promotion process.

## 20. Market Outlet

The central persistent TES Market Universe outlet entity.

> **Outlet = what/where is this place?**

Stable/reference characteristics belong here. Time-sensitive commercial observations do not.

Lifecycle:

```text
candidate -> verified -> active -> temporarily_closed -> permanently_closed -> archived
```

Closed outlets remain historical market intelligence where retention/rights permit.

## 21. Outlet Candidate

Represents a newly captured or imported outlet identity not yet fully resolved.

It may originate from:

- field discovery;
- client import;
- historical dataset import;
- duplicate-resolution workflow;
- permitted external source.

Candidate state prevents uncertain identity from being prematurely treated as canonical.

## 22. Outlet Alias

Stores alternate/historical names associated with an outlet and supports matching/deduplication without replacing canonical identity.

Alias records retain provenance.

## 23. Client Outlet Reference

Maps a client's customer/store identifier to the appropriate Survey Guru outlet context without making the client identifier the permanent TES identity.

Conceptual:

```text
clientOutletReferenceId
workspaceId
clientSystem
clientOutletId
workspaceOutletId
marketOutletIdOptional
validFrom
validTo
```

## 24. Outlet Identity Resolution

Identity resolution is represented explicitly rather than hidden inside an outlet update.

Potential decisions:

```text
NO_LIKELY_MATCH
POSSIBLE_MATCH
STRONG_MATCH
CONFIRMED_EXISTING
CONFIRMED_NEW
SAME_OUTLET_RENAMED
NEW_OUTLET_AT_EXISTING_LOCATION
COLOCATED_OUTLET
OUTLET_MOVED
MERGE_APPROVED
KEEP_SEPARATE
```

Location proximity and name similarity are independent identity signals. A changed name at the same coordinates may represent a rebrand of the same outlet, a new operator replacing a closed outlet, or a separate neighbouring/co-located outlet. The model therefore preserves historical names through Outlet Alias, lifecycle/validity history and evidence references rather than overwriting identity facts.

A `SAME_OUTLET_RENAMED` decision keeps the outlet identity and records the previous name as an alias. A `NEW_OUTLET_AT_EXISTING_LOCATION` decision creates a new candidate and preserves the predecessor/location relationship without merging the businesses. Uncertain cases remain unresolved and move to QA.

Permanent outlet merge is governed, audited and preserves lineage/history.

## 25. Market Promotion Request

A controlled bridge from Workspace data into the TES Market Universe.

```text
marketPromotionRequestId
workspaceId
workspaceOutletId
proposedMarketOutletIdOptional
rightsAssessment
validationStatus
requestedBy
reviewedBy
status
createdAt
resolvedAt
```

Promotion requires explicit rights plus validation/deduplication. Capture alone never promotes data.

## 26. Assignment

Defines exactly what a Field Worker has been asked to do.

Targets may include:

- geography;
- zones;
- street segments;
- coverage cells;
- known outlets;
- verification tasks;
- corrections/revisits;
- future opportunity targets.

Lifecycle:

```text
created -> assigned -> accepted -> in_progress -> submitted -> completed
```

Exception states include rejected, cancelled and reassigned.

Assignment history is retained so offline evidence can be evaluated against authority at capture time.

## 27. Field Worker

A Survey Guru field-operating identity, not synonymous with a Taskraft employee.

The model supports employees, contractors, validators, trainers and future certified operators.

Field Worker records link to a platform User where login is required but preserve the operational identity separately.

## 28. Search Session

Represents a bounded period during which a Field Worker performs authorised search activity for an Assignment.

```text
searchSessionId
projectId
assignmentId
fieldWorkerId
coveragePolicyVersion
startedAt
endedAt
state
sourceDeviceRef
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

Search Session state helps distinguish legitimate coverage activity from commuting/unrelated movement.

## 29. Movement Batch

An idempotent offline/mobile transfer unit containing Movement Events.

```text
movementBatchId
searchSessionId
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
```

Retries do not duplicate coverage.

## 30. Movement Event

A raw project-scoped location observation used as evidence.

```text
movementEventId
movementBatchId
searchSessionId
capturedAt
latitude
longitude
accuracyMeters
speedOptional
headingOptional
source
sequenceNumber
receivedAt
```

Movement Events are evidence, not authoritative coverage state.

Raw movement is more sensitive than derived coverage and may have a shorter retention policy.

## 31. Street Traversal

A derived record linking valid movement evidence to a Project Street Segment.

```text
streetTraversalId
projectId
projectStreetSegmentId
assignmentId
searchSessionId
fieldWorkerId
firstObservedAt
lastObservedAt
matchedGeometry
traversedMeters
uniqueTraversedMeters
segmentLengthMeters
traversedPercent
continuityScore
gpsQualityScore
matchConfidence
coverageContribution
algorithmVersion
```

Repeated walking of the same geometry does not inflate unique traversal.

Multiple workers' valid traversal can combine through geometric union.

## 32. Cell Traversal / Area Search Evidence

Represents derived evidence that a Coverage Cell or polygon was searched, especially where mapped street/path data is incomplete.

Conceptual fields:

```text
cellTraversalId
projectId
projectCoverageCellId
assignmentId
searchSessionId
fieldWorkerId
observedFrom
observedTo
movementGeometryRef
searchEvidenceScore
coverageContribution
confidence
algorithmVersion
```

This supports `STREET_PRIMARY`, `AREA_PRIMARY` and `HYBRID` field environments.

## 33. Coverage State

Street state:

```text
UNCOVERED
PARTIALLY_COVERED
COVERED
VERIFIED
```

Area/cell state:

```text
UNVISITED
IN_PROGRESS
SEARCHED
VERIFIED
```

Fundamental distinction:

```text
UNVISITED
    !=
SEARCHED — ZERO OUTLETS FOUND
    !=
SEARCHED — OUTLETS FOUND
```

Coverage state and coverage confidence are separate concepts.

## 34. Coverage Snapshot

A derived versioned read model for efficient maps/reports.

```text
coverageSnapshotId
projectId
assignmentIdOptional
zoneIdOptional
generatedAt
sourceVersion
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
```

Snapshots are not the underlying source of truth; traversal/search evidence is preserved.

## 35. Coverage Exception

Represents a detected coverage anomaly requiring review or action.

```text
coverageExceptionId
projectId
assignmentIdOptional
fieldWorkerIdOptional
projectStreetSegmentIdOptional
projectCoverageCellIdOptional
type
severity
detectedAt
evidenceRefs
algorithmVersion
status
resolution
resolvedBy
resolvedAt
```

Examples include GPS jump, parallel-street ambiguity, insufficient traversal, coverage hole and stale reassigned evidence.

## 36. Coverage Verification

Records an authorised confirmation of street/cell/zone/project coverage without overwriting the underlying evidence.

```text
coverageVerificationId
resourceType
resourceId
verificationMethod
verifiedBy
verifiedAt
notes
sourceSnapshotVersion
```

## 37. Coverage Override

An exceptional authorised change to derived coverage state.

```text
coverageOverrideId
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

Overrides never delete underlying traversal evidence and are fully auditable.

## 38. Visit

Represents a physical field observation event.

Links:

```text
Workspace
Project
Assignment
FieldWorker
SurveyVersion
WorkspaceOutlet / MarketOutlet reference as permitted
SearchSessionOptional
```

Visit stores timestamps, capture GPS/accuracy, device/sync metadata and QA state.

Lifecycle:

```text
started -> capturing -> submitted -> validating -> accepted
```

or:

```text
submitted -> review_required -> returned_for_correction / revisit_required -> accepted/rejected
```

## 39. Response

A raw answer to a Survey Question.

```text
responseId
visitId
surveyQuestionId
value / typed value reference
capturedAt
source
revision
```

Responses preserve original/revision history where corrections occur.

## 40. Repeatable Response Row

Structured repeatable groups such as product sales and product prices require stable row identity.

```text
responseRowId
visitId
surveySection/groupId
rowSequence
rowValues
createdAt
updatedAt
```

This supports idempotent offline sync and third-party mapping.

## 41. Observation

A factual/intelligence assertion derived from a Response, rule, authorised human process, AI process or other permitted source.

```text
observationId
subjectType
subjectId
observationType
value
observedAt
sourceType
sourceRef
confidence
rightsClassification
```

Separating Observation from Response prevents future intelligence from being tied to questionnaire structure.

## 42. Evidence

A first-class entity representing photographs, documents, GPS evidence, signatures and future media/AI evidence.

```text
evidenceId
workspaceId
projectId
visitIdOptional
resourceType/resourceId
kind
storageObjectRef
contentHashOptional
capturedAt
uploadedAt
source
metadata
rightsClassification
status
```

Binary objects live in protected object storage; database records hold metadata and secure references.

Permanent public object URLs are prohibited.

## 43. Validation Rule

A versioned rule definition used by field/server QA validation.

```text
validationRuleId
ruleCode
name
domain
version
severity
appliesTo
projectScopeOptional
configuration
workerMessage
qaMessage
autoResolutionPolicy
activeFrom
activeTo
```

Severities:

```text
BLOCK
WARN
FLAG_FOR_QA
INFO
```

## 44. Validation Result

An individual execution/outcome of a Validation Rule against a resource.

```text
validationResultId
ruleCode
ruleVersion
resourceType
resourceId
projectId
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

The model retains individual validation results rather than only a final approved flag.

## 45. QA Work Item

Represents a human-review task created from one or more Validation Results or operational exceptions.

```text
qaWorkItemId
workspaceId
projectId
resourceType
resourceId
priority
reasonCodes
validationResultRefs
assignedToOptional
status
createdAt
dueAtOptional
resolvedAt
resolution
```

One resource can have multiple validation results but a coordinated QA work item.

## 46. Correction Revision

Corrections must preserve historical truth.

A correction is represented as a revision/event linked to the original resource rather than destructive overwrite.

Conceptual:

```text
correctionRevisionId
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
```

## 47. Revisit Task

A problem requiring physical return creates a controlled task/assignment relationship rather than modifying the original Visit as if it never happened.

```text
revisitTaskId
projectId
originalVisitId
outletId
qaWorkItemId
reasonCode
requiredActions
priority
status
createdAt
completedVisitIdOptional
```

The resulting revisit is a new Visit linked to the original.

## 48. Outlet Identity Resolution Event

High-impact identity decisions are explicitly recorded.

```text
outletIdentityResolutionId
workspaceId
candidateOutletId
matchedOutletIds
resolution
survivingOutletIdOptional
reason
evidenceRefs
performedBy
performedAt
```

This supports merge/keep-separate decisions and future correction of erroneous identity resolution.

## 49. Integration Profile

Represents client-specific integration configuration, for example Premier WTS.

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
```

Secrets/tokens are not stored directly in ordinary domain configuration.

## 50. Integration Job

Tracks asynchronous delivery of a Survey Guru record to a third-party system.

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
errorCodeOptional
createdAt
completedAt
```

Survey Guru acceptance and integration status remain independent.

Example:

```text
Survey Guru: Accepted
Premier WTS: Pending retry
```

## 51. Integration Attempt

Individual retry/audit record for an Integration Job.

```text
integrationAttemptId
integrationJobId
attemptNumber
startedAt
completedAt
result
errorCode
interfaceVersion
```

For Premier WTS v2.006, successful final `Submit Surveys` confirmation is required before the Integration Job becomes synced/completed.

## 52. Opportunity

Reserved/progressive entity representing a potential outlet, distribution gap, underserved cluster, search opportunity or other market opportunity.

Opportunity must remain distinguishable from factual Coverage and known Outlet identity.

Potential fields:

```text
opportunityId
geographyRef
opportunityType
score
confidence
reasonCodes
sourceFeatureRefs
model/ruleVersion
status
createdAt
```

## 53. Recommendation

Represents an actionable suggestion derived from opportunity/coverage intelligence.

Examples:

- next area to search;
- street cluster to prioritise;
- outlet requiring revisit;
- future distribution/route opportunity.

A Recommendation does not itself grant Assignment authority.

## 54. Provenance

Intelligence-bearing data must answer:

> **Where did this information come from?**

Relevant provenance includes:

```text
sourceType
sourceId
workspaceId
projectId
assignmentId
visitId
fieldWorkerId
observedAt
capturedAt
algorithmVersion
confidence
rightsClassification
```

Derived data must reference source evidence sufficiently to explain/recalculate it.

## 55. Data-Rights Classification

Initial classifications:

- `CLIENT_PRIVATE`
- `OPERATIONAL_SHARED`
- `TES_REFERENCE_PERMITTED`
- `PUBLIC_OR_LICENSED`

Rights classification may apply at entity/observation/evidence level where required.

The data model enables enforcement of contractual/legal rights; it does not replace governing agreements.

## 56. Controlled Promotion to TES Market Universe

```text
Workspace Outlet / Observation
          |
Rights check
          |
Identity / duplicate validation
          |
Authorised MarketPromotionRequest
          |
Audit
          |
TES Market Universe
```

If rights do not permit promotion, information remains within the Workspace boundary.

## 57. Historical 80,000+ Outlet Import

Historical Taskraft/TES outlet data is not assumed to be clean canonical Market Universe data merely because it exists.

Import should create/resolve candidates with:

- source provenance;
- original source identifiers;
- coordinates and confidence;
- duplicate candidates;
- observation date/recency;
- data-right classification;
- import batch reference;
- identity-resolution outcome.

This preserves the strategic value of the dataset without destroying provenance.

## 58. Import Batch

Conceptual entity:

```text
importBatchId
workspaceIdOptional
sourceType
sourceName
sourceVersion/fileHash
rightsClassification
startedAt
completedAt
status
recordCounts
createdBy
```

Imported records reference their Import Batch.

## 59. Export Job

Bulk export is a separately authorised operation.

```text
exportJobId
workspaceId
projectIdOptional
requestedBy
exportType
fieldSelection/schemaVersion
rightsScope
coverageSnapshotIdOptional
status
createdAt
completedAt
secureObjectRefOptional
expiresAtOptional
```

Viewing data does not imply export permission.

## 60. Audit Event

Significant actions are represented in an append-oriented audit model.

Examples:

- survey submission;
- response correction;
- visit reopening;
- outlet merge/identity resolution;
- GPS override;
- coverage override/verification;
- QA resolution;
- access changes;
- exports;
- rights changes;
- Market Universe promotion;
- integration configuration/change;
- break-glass access.

Audit events should identify actor, action, resource, time and relevant context without unnecessarily duplicating sensitive payloads.

## 61. Historical Integrity

Archive/deactivate/supersede is preferred to casual hard deletion for material business entities.

Corrections create lineage/revisions.

Coverage recalculation records algorithm/policy versions.

Outlet merge preserves source identities/aliases/history.

Legal/privacy retention requirements may still require controlled deletion/anonymisation.

## 62. Soft Delete / Lifecycle Rule

Material entities should normally use explicit lifecycle/status fields.

Hard deletion is reserved for governed technical/legal cases, not normal business workflow.

References to archived entities remain resolvable for historical records where legally permitted.

## 63. Offline Identity & Idempotency

Offline-capable entities must support stable client-generated or server-reserved immutable IDs suitable for retry.

This includes at least:

- Outlet Candidate;
- Visit;
- Response/Response Row;
- Evidence metadata;
- Search Session;
- Movement Batch/Event.

Idempotency prevents retry from creating duplicate business records.

## 64. Derived vs Source Data

Survey Guru explicitly distinguishes source evidence from derived interpretations.

Examples:

```text
MovementEvent       -> source evidence
StreetTraversal     -> derived
CoverageSnapshot    -> derived read model
Response            -> source capture
Observation         -> derived/normalised intelligence
ValidationResult    -> derived rule outcome
Opportunity         -> derived intelligence
```

Derived records retain algorithm/rule/version provenance.

## 65. Current vs Historical State

For performance, entities may carry current status fields, but current state must not erase significant transition history.

Example:

```text
ProjectStreetSegment.currentCoverageState = COVERED
```

while traversal, validation, verification and override history explain how that state was reached.

## 66. Security Boundary Rule

> **The UI is never an access-control mechanism.**

All protected reads and mutations must be authorised by trusted API/backend/database controls according to:

```text
Identity
+ Workspace
+ Role/Permission
+ Project/Assignment Scope
+ Resource Ownership/Relationship
+ Data Domain
+ Data-Rights Classification
```

Hiding UI elements is UX only.

## 67. Resource-First Authorisation

The server loads/resolves the target resource and derives authoritative Workspace, Project, Assignment, Field Worker and rights context from stored relationships.

Request-supplied IDs do not become authority simply because they are syntactically valid.

## 68. Raw Movement Sensitivity

Raw Movement Events are more sensitive than derived project Coverage.

Access and retention must therefore be independently controlled.

Client/project reporting should normally expose derived coverage rather than unnecessary detailed worker trails.

## 69. AI Agent Identity

Future AI/automation services operate as scoped service identities with explicit permissions.

They do not inherit unrestricted platform authority.

Standing TES/Taskraft principle:

> **No autonomous agent receives simultaneous authority over code, production credentials and deployment.**

## 70. Environment Separation

Development, staging/test and production data/resources are logically and operationally separated.

```text
DEVELOPMENT -> STAGING / TEST -> PRODUCTION
```

Test rules/algorithms must not run against live customer data without explicit controlled authority.

## 71. Persistence Mapping Direction

### MVP / Firestore
The logical model may map selected entities into collections/documents optimized for MVP field operation.

### Target / PostgreSQL + PostGIS
Spatial/relational entities such as StreetSegment, ProjectStreetSegment, Coverage Cells, Traversals, Outlet geometry and spatial relationships should migrate behind stable APIs to PostgreSQL/PostGIS.

### Object Storage
Evidence binary content belongs in protected object storage.

### BigQuery
Historical analytics/model features may be replicated into BigQuery; BigQuery is not transactional domain authority.

## 72. Key Relationship Summary

```text
Organisation 1---* Workspace
Workspace 1---* WorkspaceMembership
Workspace 1---* Project
Project *---1 SurveyVersion
Project 1---* Assignment
Project 1---* ProjectStreetSegment
Project 1---* ProjectCoverageCell
Project 1---* Visit
Project 1---* QAWorkItem

FieldWorker 1---* Assignment
Assignment 1---* SearchSession
SearchSession 1---* MovementBatch
MovementBatch 1---* MovementEvent
SearchSession 1---* StreetTraversal

StreetSegment 1---* ProjectStreetSegment
CoverageCell 1---* ProjectCoverageCell

WorkspaceOutlet 1---* Visit
Visit 1---* Response
Visit 1---* ResponseRow
Visit 1---* Evidence
Visit 1---* ValidationResult

ValidationRule 1---* ValidationResult
QAWorkItem *---* ValidationResult
QAWorkItem 1---* CorrectionRevision
QAWorkItem 1---* RevisitTask

WorkspaceOutlet 0..1---0..1 MarketOutlet
WorkspaceOutlet 1---* MarketPromotionRequest
MarketOutlet 1---* OutletAlias
MarketOutlet 1---* ClientOutletReference

Visit 1---* IntegrationJob
IntegrationJob 1---* IntegrationAttempt
```

Exact cardinalities may be refined in the persistence schema, but the security/data-boundary semantics are locked.

## 73. Locked Architecture Decisions

1. TES (Task Expert Systems) owns Survey Guru.
2. Workspace/client and TES Market Universe domains remain explicitly separated.
3. `WorkspaceOutlet` and `MarketOutlet` are distinct concepts.
4. Capture does not automatically promote client-private outlet data into the Market Universe.
5. The outlet is the long-lived physical market entity; visits are observations over time.
6. Projects reference outlets/geography rather than owning the permanent market universe.
7. Surveys are configurable/versioned; published Survey Versions are immutable.
8. Raw Responses and normalized/derived Observations are separate.
9. Evidence is a first-class entity with protected object storage.
10. StreetSegment is a stable TES geographic domain entity independent of provider identity.
11. ProjectStreetSegment holds project-specific street eligibility/coverage state.
12. Street and H3/area coverage coexist.
13. SearchSession scopes legitimate field search activity.
14. MovementEvent is raw evidence; StreetTraversal/CellTraversal are derived evidence.
15. Coverage state and coverage confidence are separate.
16. Coverage Snapshot is a derived read model, not source truth.
17. Searched-zero-found is preserved as meaningful derived business evidence.
18. Coverage overrides/verification never erase source evidence.
19. ValidationRule and ValidationResult are separate, versioned entities.
20. QAWorkItem coordinates human review without collapsing individual validation outcomes.
21. Corrections and revisits preserve original Visit/history.
22. Permanent outlet merge/identity resolution is governed and auditable.
23. Offline-capable entities use stable IDs and idempotent sync.
24. Survey Guru acceptance and third-party IntegrationJob status are independent.
25. Opportunity/Recommendation are future intelligence entities and cannot rewrite factual coverage.
26. Provenance and data-right classification travel with intelligence.
27. Historical 80,000+ outlet data enters through controlled import/identity/rights processes.
28. Viewing data does not grant export authority.
29. Raw movement has tighter access/retention than derived coverage.
30. API/backend-enforced strict authorisation is mandatory; UI is not a security boundary.
31. Domain model is persistence-neutral and migration-ready for PostgreSQL/PostGIS/H3.
32. AI/service identities are explicitly scoped and auditable.
33. Historical integrity is preferred over destructive overwrite/deletion.

## 74. Required Follow-On Updates

This data model now requires corresponding implementation alignment in:

- `MVP-PERSISTENCE-SPECIFICATION.md`
- `API-AUTHORISATION-SPECIFICATION.md`
- `SCREEN-NAVIGATION-ARCHITECTURE.md`
- future PostgreSQL/PostGIS Logical Schema;
- future Import & Export Specification.

The next highest-priority document is the **MVP Persistence Specification**, because the logical entities now need an explicit Firestore/API representation that remains migration-ready for PostGIS.

---

## Living Documentation Rule

This is a living TES architecture document. Material changes affecting entities, relationships, security boundaries, outlet identity, field tracking, coverage, QA, persistence, integrations, rights or opportunity intelligence must be version-controlled here and in any other materially affected Survey Guru/TES specification rather than remaining only in chat or informal notes.
