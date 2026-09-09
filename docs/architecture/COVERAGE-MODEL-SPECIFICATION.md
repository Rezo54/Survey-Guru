# Survey Guru Coverage Model Specification v1.0

**Product Owner:** TES — Task Expert Systems  
**Operational / Field Partner:** Taskraft (Pty) Ltd  
**Status:** Technical Product Specification / Living Document  
**Version:** 1.0  
**Date:** 9 September 2026

## 1. Purpose

This specification defines the operational and technical model Survey Guru uses to determine, persist, display and report geographic search coverage.

It translates the Coverage, Field Tracking & Opportunity Direction Architecture into implementable rules for:

- street segmentation;
- project coverage scope;
- movement evidence;
- street map matching;
- traversal measurement;
- street coverage state;
- H3/area coverage;
- offline coverage;
- team aggregation;
- confidence;
- verification;
- searched-zero-found evidence;
- coverage reporting;
- future opportunity intelligence.

The primary field question is:

> **Which streets have I covered, and which streets do I still need to search?**

The primary management question is:

> **How completely has the assigned market actually been searched?**

## 2. Governing Principles

1. Live Street Coverage Map is a first-class MVP capability.
2. Coverage is operational domain data, not a map styling effect.
3. GPS samples are evidence; they are not themselves authoritative coverage.
4. Proximity to a street does not prove that street was searched.
5. Street-level and area/H3 coverage must coexist.
6. Partial coverage is retained rather than rounded to complete.
7. Unvisited, searched-zero-found and searched-with-outlets are distinct.
8. Outlet count does not determine whether geography was searched.
9. Coverage must continue offline.
10. Server/API-derived coverage is authoritative after synchronisation.
11. Coverage policies and thresholds are configurable and versioned.
12. Algorithm versions and provenance are retained so coverage can be recalculated.
13. Movement collection is project/work scoped and purpose-limited.
14. Informal/unmapped areas require area/path fallback rather than false certainty.
15. Coverage results must remain understandable to field teams and clients.

## 3. Coverage Domains

Survey Guru maintains three related but separate coverage domains.

### 3.1 Street Coverage
Answers whether eligible street segments were searched.

### 3.2 Area Coverage
Answers whether a geographic cell/polygon was searched, including places where mapped streets are inadequate.

### 3.3 Outlet Coverage
Answers which known or discovered outlets were visited/verified.

These domains must not be collapsed into one percentage.

## 4. Core Entities

```text
ProjectCoverageScope
StreetSegment
ProjectStreetSegment
CoverageCell
ProjectCoverageCell
MovementEvent
MovementBatch
StreetTraversal
CellTraversal
CoveragePolicy
CoverageSnapshot
CoverageException
CoverageVerification
CoverageOverride
```

Outlet, Visit, Assignment, FieldWorker and Geography entities are referenced from the broader Survey Guru domain model.

## 5. Street Segment Model

A street segment is the smallest stable road/path unit used for street coverage.

Conceptual schema:

```text
StreetSegment
-------------
streetSegmentId           immutable TES ID
sourceProvider
sourceFeatureId
sourceVersion
streetName
roadClass
geometry                  LineString/MultiLineString
lengthMeters
startNodeRef
endNodeRef
isWalkable
isDriveable
status
validFrom
validTo
createdAt
updatedAt
```

`streetSegmentId` is TES-owned and must not depend solely on a provider's feature ID.

## 6. Street Segmentation Rules

Segments should normally break at:

- intersections;
- road/path termination;
- material road-class change;
- project-boundary clipping where necessary;
- other stable network breakpoints.

Avoid excessively long segments because a worker may cover only one portion. Avoid excessively short segments because they increase map/API/storage overhead and can make coverage noisy.

The production segment-length strategy must be validated against South African field conditions.

## 7. Project Street Segment

A project references eligible street segments through a project-specific entity rather than changing the master street record.

```text
ProjectStreetSegment
--------------------
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
firstCoveredAt
lastCoveredAt
verifiedAt
version
```

This allows different projects to treat the same physical street differently.

## 8. Eligible Street Network

At project activation or geography preparation:

```text
Project Boundary
      |
Intersect Street Network
      |
Apply road/path eligibility policy
      |
Clip / reference eligible segments
      |
Assign operational zones
      |
Create ProjectStreetSegments
```

Road classes excluded by project policy must not inflate the denominator.

Examples that may require policy decisions include motorways, inaccessible private roads, footpaths, service roads and roads outside target trading areas.

## 9. H3 / Area Coverage Model

Street coverage is complemented by H3 cells or another approved area unit.

Conceptual schema:

```text
CoverageCell
------------
h3Index
resolution
geometryDerived
```

```text
ProjectCoverageCell
-------------------
projectId
h3Index
zoneId
eligibleAreaPercent
coverageState
coveragePercent
coverageConfidence
outletsFoundCount
searchedZeroFound
lastEvidenceAt
```

H3 is an index/aggregation layer, not a replacement for authoritative PostGIS geometry.

## 10. H3 Resolution Strategy

The exact H3 resolution must not be permanently fixed before field testing.

Selection criteria include:

- field map usefulness;
- typical street/block size;
- informal-settlement density;
- urban vs rural context;
- number of cells per project;
- mobile rendering cost;
- spatial query performance;
- usefulness for opportunity scoring.

Survey Guru may use more than one H3 resolution: a finer operational resolution and a coarser analytics/overview resolution.

The chosen resolutions must be configuration/version controlled.

## 11. Coverage Policy

Every project has an explicit coverage policy.

```text
CoveragePolicy
--------------
coveragePolicyId
workspaceId
projectId
mode
version
eligibleRoadClasses
movementModesAllowed
minimumGpsAccuracyRule
samplePolicy
partialTraversalThreshold
coveredTraversalThreshold
continuityRule
minimumEvidenceDurationRule
cellCoverageRule
verificationRequired
zeroFoundRule
rawMovementRetentionRule
createdAt
createdBy
activatedAt
```

Policy changes after fieldwork begins create a new version rather than silently changing historical interpretation.

## 12. Coverage Modes

### EXHAUSTIVE_STREET
All required eligible street segments must be covered/verified for project completion.

### OPPORTUNITY_LED
Coverage order and potentially stopping rules are driven by priority/time/budget.

### KNOWN_OUTLET
Primary completion is known-outlet verification; street coverage may be informational or limited.

### AREA_SEARCH
Used where streets are incomplete/inappropriate; area/H3 coverage becomes primary.

A project may combine modes by zone where operationally justified.

## 13. Field Search Session

Movement only contributes to coverage while the worker is in an authorised field-search context.

```text
SearchSession
-------------
searchSessionId
projectId
assignmentId
fieldWorkerId
startedAt
endedAt
state
coveragePolicyVersion
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

Travel outside active assignment/search context does not automatically count as coverage.

## 14. Movement Event

```text
MovementEvent
-------------
movementEventId
movementBatchId
searchSessionId
capturedAt
latitude
longitude
accuracyMeters
altitudeOptional
speedOptional
headingOptional
source
sequenceNumber
localCreatedAt
receivedAt
```

The device does not set authoritative coverage state on this event.

## 15. Movement Batch

Offline/mobile movement should sync in idempotent batches.

```text
MovementBatch
-------------
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

Replaying a batch must not duplicate distance or coverage.

## 16. GPS Sampling Policy

The MVP should use adaptive sampling rather than assuming permanent second-by-second tracking.

Sampling should balance:

- sufficient geometry to establish traversal;
- battery consumption;
- mobile storage;
- network use;
- privacy/purpose limitation;
- GPS quality;
- walking speed;
- visit state.

Initial field pilots should test a range such as time-based plus distance-change sampling, but this document deliberately does not lock a universal number before real-device testing.

The active policy version must be recorded.

## 17. GPS Evidence Quality

Movement evidence can be classified conceptually:

```text
GOOD
ACCEPTABLE
POOR
REJECTED
```

Quality may consider reported accuracy, implausible jumps, timestamp sequence, speed, stale coordinates and environmental behaviour.

Poor points may still be retained as evidence but should contribute less or not at all to authoritative coverage.

## 18. Preprocessing Pipeline

Before map matching:

```text
Raw Movement Events
        |
Validate identity/session
        |
Idempotency / ordering
        |
Reject impossible/stale events
        |
GPS quality classification
        |
Optional smoothing
        |
Candidate path construction
        |
Map matching
```

Original evidence must not be destructively overwritten by smoothed/derived geometry.

## 19. Map-Matching Candidate Search

For each acceptable movement sequence, the engine queries plausible street segments within a bounded spatial tolerance based partly on GPS quality.

Candidate selection may consider:

- distance to segment;
- movement heading;
- network continuity;
- previous matched segment;
- plausible walking/driving transition;
- intersections;
- assignment geography;
- road/path eligibility.

The nearest street is not automatically the correct street.

## 20. Parallel Street Protection

Dense areas may contain parallel streets close enough for naive nearest-line matching to fail.

The matcher should therefore use sequence continuity and heading/network topology, not only point-to-line distance.

If confidence is insufficient, preserve uncertainty rather than awarding false coverage.

## 21. Intersection / Side-Street Protection

Crossing the mouth of a side street must not mark the side street covered.

Evidence should show meaningful distance/progression along the segment before coverage increases materially.

This is a locked acceptance requirement.

## 22. Street Traversal Entity

```text
StreetTraversal
---------------
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
outletsObservedCount
visitsLinkedCount
algorithmVersion
createdAt
updatedAt
```

`uniqueTraversedMeters` prevents repeated walking of the same portion from falsely increasing completion.

## 23. Traversed Percentage

Conceptually:

```text
traversedPercent =
  unique eligible segment length supported by valid traversal evidence
  ---------------------------------------------------------------
                    eligible segment length
```

The calculation must use spatial coverage of the segment rather than simply summing raw GPS distances.

Walking the same 40% three times must not produce 120% coverage.

## 24. Geometry-Level Coverage

Where implementation permits, the engine should maintain the portion of the segment supported by traversal evidence.

This enables the map to show:

```text
[ COVERED PORTION ][ OUTSTANDING PORTION ]
```

If MVP implementation initially uses whole-segment states, the data model must still preserve sufficient evidence for future geometry-level rendering.

## 25. Street Coverage State Machine

```text
UNCOVERED
    |
valid evidence begins
    v
PARTIALLY_COVERED
    |
configured covered threshold reached
    v
COVERED
    |
required verification completed
    v
VERIFIED
```

Exceptions/overrides may cause recalculation or return to a lower state, but historical transitions remain auditable.

## 26. Initial Threshold Framework

Thresholds are configuration, not hard-coded product constants.

For pilot purposes, TES may test values such as:

```text
Partial:  meaningful traversal >= 20-30%
Covered:  unique traversal >= 80-90%
```

These are **pilot starting hypotheses only**, not production commitments.

The field pilot must determine appropriate thresholds by environment and operating mode.

## 27. Coverage Confidence

State and confidence are separate.

Conceptual deterministic confidence inputs:

```text
Traversal completeness
+ GPS quality
+ map-match confidence
+ continuity
+ active-search validity
+ supporting visits/outlets
- anomaly penalties
= coverageConfidence
```

Confidence should initially be explainable and rule-based.

Example:

```text
State: COVERED
Confidence: HIGH
Reason:
- 91% unique traversal
- good GPS
- continuous movement
- active search session
```

## 28. Coverage Contribution

Multiple traversals may combine to cover one street.

Example:

```text
Worker A covers 0-55%
Worker B covers 45-100%
        |
Union of valid geometry
        |
Project street coverage = 100%
```

Do not simply add percentages; calculate the union of supported segment geometry.

Worker contributions remain separately attributable.

## 29. Reassignment

Reassigning a street/zone does not erase valid prior coverage.

The new worker sees authoritative existing coverage plus the remaining outstanding portion, subject to permission and sync state.

## 30. Team Coverage Aggregation

Project street coverage is derived from the union of valid authorised traversal evidence across workers/sessions.

Project metrics:

```text
eligibleStreetMeters
coveredStreetMeters
partialStreetMeters
uncoveredStreetMeters
verifiedStreetMeters
streetCoveragePercent
```

For headline completion, define clearly whether the denominator is count of segments, weighted segments or network length. **Network length should be the preferred primary measure** because segment counts depend on segmentation design.

Segment counts remain useful operationally.

## 31. Weighted Coverage

Some projects may require weighting, but weighting must never disguise raw completeness.

Report both where used:

```text
Raw street-network coverage: 89.4%
Weighted priority coverage:   96.2%
```

Do not present weighted coverage as if all geography was searched.

## 32. H3 / Area Traversal

Movement geometry is intersected with eligible cells/polygons to derive area search evidence.

Area coverage may consider:

- movement path density;
- street coverage within the cell;
- accessible/searchable area;
- assignment mode;
- time/evidence distribution;
- captured outlets;
- unmapped path movement.

The area algorithm must be explicitly versioned.

## 33. Area Coverage State

```text
UNVISITED
IN_PROGRESS
SEARCHED
VERIFIED
```

`SEARCHED` means sufficient evidence exists under the area's configured policy. It does not mean an outlet was found.

## 34. Searched-Zero-Found

This is a derived business fact, not merely a map state.

Conceptually:

```text
searchedZeroFound =
  coverageState in (SEARCHED, VERIFIED)
  AND qualifying outletsFoundCount = 0
```

The outlet qualification rule must be project-specific where necessary.

This evidence is strategically important for future opportunity modelling.

## 35. Searched-With-Outlets

Similarly:

```text
searchedWithOutlets =
  coverageState in (SEARCHED, VERIFIED)
  AND qualifying outletsFoundCount > 0
```

Both positive and negative search outcomes require provenance and observation time.

## 36. Informal / Unmapped Area Fallback

When the street source is incomplete, Survey Guru must not force false street coverage.

The system may classify a project area as requiring:

```text
STREET_PRIMARY
AREA_PRIMARY
HYBRID
```

In `AREA_PRIMARY` or `HYBRID`, movement geometry and H3/polygon search evidence can establish coverage even where no mapped street exists.

Future authorised operational paths can be added without rewriting historical raw movement.

## 37. Footpaths / Lanes

In informal settlements and dense markets, pedestrian paths may be operationally more important than formal roads.

The street-source evaluation must therefore consider whether licensed path/footway data is adequate. Survey Guru's generic domain term may remain `StreetSegment`, but road/path classification must support pedestrian ways.

## 38. Walking vs Vehicle Coverage

A project may permit walking, vehicle-based searching or both.

Coverage policy may apply different rules because driving a street at speed does not necessarily provide equivalent search evidence to walking it.

Movement mode may be user-declared, inferred cautiously, or project-assigned. Inference must not be treated as certain without adequate evidence.

## 39. Visit Relationship

Visits strengthen operational evidence but do not create coverage automatically.

A Visit links to nearby street/cell context server-side.

```text
Visit
  |
Outlet location
  |
Street/H3 spatial context
  |
Supporting coverage evidence
```

Ten visits on one short portion of a long street do not prove the whole street was searched.

## 40. Live Field Map State

The mobile map requires a local coverage representation for responsiveness.

Each assigned segment should have:

```text
serverState
serverCoveragePercent
localPendingContribution
localDisplayState
lastServerVersion
```

The local display may optimistically progress while offline, but it must distinguish pending/local status where necessary.

## 41. Offline Reconciliation

On sync:

```text
Pending Movement Batches
        |
API authorisation
        |
Idempotency validation
        |
Authoritative map matching
        |
Recalculate traversal union
        |
Update street/cell coverage
        |
Return authoritative snapshot/version
        |
Mobile reconciles display
```

If server state differs materially from local state, the app should explain that coverage needs more walking rather than silently changing the map.

## 42. Coverage Snapshot

For efficient map/report consumption, create versioned snapshots/summaries.

```text
CoverageSnapshot
----------------
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

Snapshots are derived, not the underlying evidence source.

## 43. Coverage Versioning

Coverage responses should include a version/revision token so clients can efficiently request changes.

This supports:

- live updates;
- offline reconciliation;
- avoiding full map reloads;
- supervisor refresh;
- conflict detection.

## 44. Coverage Exceptions

```text
CoverageException
-----------------
coverageExceptionId
projectId
assignmentId
fieldWorkerIdOptional
streetSegmentIdOptional
cellIdOptional
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

Types may include GPS_JUMP, LOW_ACCURACY, IMPOSSIBLE_SPEED, PARALLEL_STREET_AMBIGUITY, INSUFFICIENT_TRAVERSAL, COVERAGE_HOLE, STALE_REASSIGNED_EVIDENCE, DUPLICATE_BATCH and DEVICE_CONFLICT.

Exceptions are QA signals, not automatic misconduct findings.

## 45. Manual Coverage Override

Manual override is exceptional.

```text
CoverageOverride
----------------
overrideId
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

Only authorised roles may override. Overrides are auditable and must not delete underlying evidence.

## 46. Verification

Verification may occur at street, cell, zone or project level.

```text
CoverageVerification
--------------------
verificationId
resourceType
resourceId
verificationMethod
verifiedBy
verifiedAt
notes
sourceSnapshotVersion
```

Verification does not rewrite original traversal evidence.

## 47. Project Completion Rule

Completion depends on coverage mode.

Example exhaustive rule:

```text
requiredStreetCoverage >= configured completion threshold
AND no blocking coverage exceptions
AND required QA/verification complete
```

A project may allow an authorised closure with documented residual gaps. Those gaps remain reported rather than being changed to covered.

## 48. Coverage Gap Entity / View

The system should expose outstanding work as actionable geography.

A gap can be:

- uncovered street segment;
- uncovered portion of segment;
- partially searched H3 cell;
- unmapped area requiring search;
- coverage exception requiring revisit.

Gap views feed the Field Map and Opportunity Direction Engine.

## 49. Deterministic Priority Score

The Coverage Model supplies inputs to Opportunity Direction but does not own final business scoring.

MVP may expose features such as:

```text
coverageGapSize
historicalOutletDensity
knownOutletDensity
recentDiscoveryRate
distanceFromWorker
operationalPriority
coverageConfidence
```

Opportunity scoring must never change the factual coverage state.

## 50. Historical Outlet Spatial Features

Subject to rights/provenance, the 80,000+ historical outlet universe can generate H3/street features such as:

- historical outlets per cell;
- outlets per street kilometre;
- recency-weighted density;
- known outlet clusters;
- previous discovery rate;
- category-specific density where permitted.

These are intelligence features, not proof of coverage.

## 51. Coverage API Read Model

Field clients should receive compact assignment-bounded responses.

Conceptual:

```text
GET assignment coverage
-> boundary
-> relevant street geometry
-> street state/percent
-> current coverage version
-> relevant H3 state
-> authorised nearby outlets
```

Supervisor clients use project/viewport-bounded queries and aggregates.

No client should need the complete national street/outlet universe.

## 52. Coverage API Write Model

Field clients submit evidence, not arbitrary authoritative coverage.

Permitted writes include:

- search-session lifecycle;
- movement batches;
- visit/evidence events;
- explicit permitted field annotations.

Server derives protected coverage state.

## 53. Security Rules

Every request is authorised using:

```text
Identity
+ Workspace Membership
+ Permission
+ Project Scope
+ Assignment/Resource Scope
+ Data Rights
+ Coverage Policy
```

Request-supplied worker/project/workspace IDs are not trusted as authority.

Field Workers cannot mark streets `VERIFIED` or edit another worker's raw evidence.

## 54. Raw Movement Access

Raw movement data is more sensitive than derived coverage.

Default access should favour:

```text
Field Worker -> own current assignment evidence where UX requires
Supervisor   -> derived team coverage; raw trail only with permission/need
Client       -> derived authorised coverage by default
TES Admin    -> scoped operational/support access with audit
```

Exact permissions belong in the Security/API specifications.

## 55. Retention

Raw movement retention should be policy-driven and may be shorter than retention of derived coverage.

Long-lived records should favour:

- coverage result;
- traversal summary/geometry where justified;
- confidence;
- algorithm version;
- provenance;
- audit/verification.

Do not retain detailed raw trails indefinitely merely because storage is inexpensive.

## 56. PostGIS Target Model

Target spatial operations include:

- line/polygon intersection;
- project-boundary clipping;
- nearest/candidate street search;
- map-matching support;
- line substring/coverage union;
- distance calculations;
- H3 association;
- viewport bounding;
- outlet/street spatial relationships.

PostGIS is the authoritative long-term spatial store.

## 57. Firestore MVP Boundary

Firestore may temporarily store project coverage summaries, policy/configuration, mobile sync metadata and simplified segment state.

Avoid designing Firestore documents that require permanent broad client-side spatial scans.

Spatially complex authoritative calculations should be isolated behind APIs so migration to PostGIS does not require rewriting the field UX contract.

## 58. Algorithm Versioning

Every derived traversal/coverage calculation records an algorithm version.

Example:

```text
coverageAlgorithmVersion: street-cover-v1.0
mapMatcherVersion: matcher-v1.0
policyVersion: 3
```

If algorithms improve, TES can recalculate derived coverage from retained evidence under controlled processes without pretending the original calculation never existed.

## 59. Recalculation

Recalculation must:

- be authorised;
- preserve previous result/history;
- identify new algorithm/policy version;
- avoid silently changing already-issued client reports without governance;
- produce comparison/audit information where material.

## 60. Performance Requirements

Coverage processing should support:

- smooth field map interaction;
- incremental local updates;
- bounded sync batches;
- near-real-time supervisor progress;
- project-scale recomputation;
- viewport-based geometry loading;
- simplified mobile geometry;
- spatial indexing.

Performance targets are to be benchmarked during implementation against realistic 700-1,100+ store WTS projects and the wider 80,000+ outlet reference universe.

## 61. Field Pilot Test Matrix

Pilot environments must include:

- dense township grid;
- irregular township streets;
- informal settlement;
- CBD/high street;
- suburban streets;
- rural settlement;
- parallel roads;
- cul-de-sacs;
- short side streets;
- long roads;
- pedestrian paths;
- poor GPS environment;
- temporary offline operation;
- worker turns around halfway;
- worker crosses street without entering it;
- worker repeats same portion multiple times;
- two workers cover complementary halves;
- reassignment during day;
- vehicle traversal where permitted.

## 62. Ground-Truth Validation

During pilots, a supervisor/test observer should record known ground truth for selected routes.

Compare:

```text
Actual searched geometry
vs
Survey Guru derived geometry/state
```

Measure false positives and false negatives.

For MVP, false positive coverage is particularly dangerous because it tells the team a street is complete when it is not. Threshold tuning should therefore favour credible completeness over cosmetically high coverage percentages.

## 63. Acceptance Tests

The MVP Coverage Engine must demonstrate at minimum:

1. walking most of a street can progress it from uncovered to partial to covered under policy;
2. crossing a side street does not mark it covered;
3. walking beside a parallel street does not automatically cover both;
4. repeating the same section does not inflate unique coverage;
5. two workers' valid complementary evidence can combine;
6. skipped streets remain visible;
7. searched-zero-found remains distinguishable from unvisited;
8. offline evidence reconciles after reconnect;
9. duplicate movement batch does not inflate coverage;
10. reassignment preserves prior valid coverage;
11. poor GPS can reduce confidence/prevent false completion;
12. informal/unmapped area can use area coverage fallback;
13. Field Worker and Supervisor see consistent authoritative state after sync;
14. unauthorised users cannot read raw movement or change coverage;
15. manual override is audited;
16. project report can state outlet result and geographic completeness separately.

## 64. Initial KPI Definitions

### Street Network Coverage %
```text
covered eligible street length
------------------------------ x 100
 total eligible street length
```

Treatment of partial length should be explicitly defined; preferred detailed metric uses actual supported geometry rather than counting a partial segment as fully covered.

### Outstanding Street Length
Eligible length without sufficient coverage evidence.

### Searched-Zero-Found Rate
Searched eligible units with zero qualifying outlets / searched eligible units.

### Discovery Density
New qualifying outlets / covered street kilometre or searched area unit.

### Coverage Confidence Distribution
Distribution of coverage results by confidence band.

## 65. Reporting Language

Survey Guru reports must avoid overclaiming.

Preferred:

> **94.7% of the eligible assigned street network has sufficient search-coverage evidence under Project Coverage Policy v3.**

Avoid:

> **94.7% of every possible place was definitely searched.**

This is particularly important where source street data is incomplete.

## 66. Open Configuration Items for Field Pilot

The following are intentionally not locked until tested:

- GPS sampling interval/distance policy;
- acceptable GPS thresholds;
- candidate-street search radius;
- partial traversal threshold;
- covered traversal threshold;
- continuity threshold;
- minimum evidence duration;
- preferred H3 operational resolution(s);
- walking vs driving rule differences;
- raw movement retention period;
- geometry simplification tolerance;
- local optimistic coverage behaviour.

These must be resolved by evidence, not guesswork.

## 67. Locked Coverage Model Decisions

1. Network length is the preferred primary street-coverage denominator, not raw segment count.
2. Street segments are stable TES domain objects with source/version provenance.
3. Project-specific eligibility is represented separately from the master street.
4. Street and H3/area coverage coexist.
5. Field clients submit movement evidence; the server derives authoritative coverage.
6. Unique traversed geometry is used; repeated traversal cannot inflate completion.
7. Side-street proximity/crossing is insufficient for coverage.
8. Parallel-street ambiguity must preserve uncertainty rather than award false coverage.
9. Partial coverage is a first-class state.
10. Coverage state and coverage confidence are separate.
11. Multiple workers' valid evidence combines by geometric union.
12. Reassignment preserves valid prior evidence.
13. Searched-zero-found is a durable derived business fact.
14. Visits/outlet captures support but do not define coverage.
15. Offline local coverage is provisional until server reconciliation.
16. Coverage policy and algorithms are versioned.
17. Manual overrides never delete underlying evidence and require audit.
18. Raw movement is more restricted and may have shorter retention than derived coverage.
19. Informal/unmapped areas use area/hybrid fallback.
20. Field pilots must tune thresholds before production.
21. False-positive coverage is treated as a higher operational risk than conservative partial coverage.
22. Opportunity scoring consumes coverage truth but cannot rewrite it.

## 68. Required Cross-Document Updates

This specification materially affects:

- `DATA-MODEL-ENTITY-ARCHITECTURE.md`
- `MVP-PERSISTENCE-SPECIFICATION.md`
- `API-AUTHORISATION-SPECIFICATION.md`
- `SCREEN-NAVIGATION-ARCHITECTURE.md`
- future `FIELD-CAPTURE-OFFLINE-WORKFLOW-SPECIFICATION.md`
- future `QA-VALIDATION-RULES-SPECIFICATION.md`
- future Import/Export specification.

Those documents must be updated as their implementation detail is locked.

---

## Living Documentation Rule

This is a living TES specification. Material discoveries or decisions affecting coverage geometry, thresholds, field tracking, privacy, persistence, API security, map behaviour, offline operation, opportunity direction or reporting must be version-controlled here and in other materially affected Survey Guru/TES documents rather than remaining only in chat or informal notes.
