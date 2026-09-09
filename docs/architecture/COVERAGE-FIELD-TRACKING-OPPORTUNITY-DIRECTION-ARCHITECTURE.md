# Survey Guru Coverage, Field Tracking & Opportunity Direction Architecture v1.0

**Product Owner:** TES — Task Expert Systems  
**Operational / Field Partner:** Taskraft (Pty) Ltd  
**Status:** Architecture Baseline / Living Document  
**Version:** 1.0  
**Date:** 9 September 2026

## 1. Purpose

This document defines how Survey Guru will understand geographic search coverage, show live street-level progress to Field Workers and Supervisors, preserve evidence of where field teams actually searched, and progressively direct teams toward the highest-value remaining opportunity.

> **Survey Guru must know not only where stores are, but where field teams have searched, what remains unknown, and where the highest probability of valuable undiscovered outlets exists.**

The architecture is designed around a fundamental distinction:

```text
WHERE STORES ARE
        !=
WHERE FIELD TEAMS HAVE SEARCHED
        !=
WHERE OPPORTUNITY IS LIKELY TO EXIST
```

These three truths are related but must remain separately measurable.

## 2. Locked Product Decision

**Live Street Coverage Map is a first-class MVP capability for both Field Workers and Supervisors.**

A Field Worker must be able to open the map while working and immediately see:

- streets already covered;
- streets partially covered;
- streets not yet covered;
- current location;
- assigned geography;
- known outlets where authorised;
- newly captured outlets where useful;
- progress through the assigned street network.

The map is part of field execution, not merely post-project reporting.

## 3. Strategic Outcome

Traditional WTS reporting tends to answer:

> How many stores did we capture?

Survey Guru must additionally answer:

> How completely did we search the assigned market?

A future project result should therefore support statements such as:

```text
Outlets captured / verified:       1,284
Assigned street network searched:  94.7%
Street segments outstanding:       46
Searched with zero outlets:        118 segments/cells
```

This transforms coverage from an assumption into a measurable operational deliverable.

## 4. Core Architecture

```text
             HISTORICAL OUTLET UNIVERSE
                  80,000+ outlets
                         |
                         v
                  GEOGRAPHY MODEL
             Streets + H3 + Boundaries
                         |
        +----------------+----------------+
        |                                 |
        v                                 v
 STREET COVERAGE ENGINE             OUTLET INTELLIGENCE
        |                                 |
        +----------------+----------------+
                         |
                         v
                 COVERAGE TRUTH
        Covered / Partial / Unknown
                         |
             +-----------+-----------+
             |                       |
             v                       v
      FIELD WORKER MAP        SUPERVISOR LIVE MAP
             |                       |
             +-----------+-----------+
                         |
                         v
              OPPORTUNITY DIRECTION
                   "Where next?"
                         |
                         v
                  FIELD EXECUTION
                         |
                         v
          New coverage + new outlets
                         |
                         +-------> learning loop
```

## 5. Architecture Components

The capability is divided into six cooperating components:

1. **Geography & Street Network Model**
2. **Field Movement Evidence Service**
3. **Street Coverage Engine**
4. **Coverage Aggregation Engine**
5. **Live Coverage Map Services**
6. **Opportunity Direction Engine**

The permanent Outlet Universe supplies historical and current outlet intelligence to these components but does not replace coverage evidence.

## 6. Geography & Street Network Model

Survey Guru requires a geographic representation that can answer both street-level and area-level questions.

### 6.1 Street Network

The authoritative spatial model should ultimately reside in PostgreSQL/PostGIS.

Each relevant street should be represented as one or more stable street segments rather than only a visual map line.

Conceptual entity:

```text
StreetSegment
-------------
streetSegmentId
geometry
streetName
roadClass
lengthMeters
projectEligibility
source
sourceVersion
createdAt
updatedAt
```

A long road may be divided into operationally useful segments at intersections or other stable breakpoints.

### 6.2 H3 Coverage Layer

H3 provides a complementary area/grid representation for:

- coverage aggregation;
- outlet density;
- heat maps;
- opportunity scoring;
- spatial indexing;
- supervisor summaries;
- historical comparison.

H3 does not replace the street network. A Field Worker needs to know whether a particular street was searched; management may also need to know whether an area/cell was searched.

### 6.3 Project Geography

A project defines:

```text
Project Boundary
    |
Operational Zones
    |
Eligible Street Segments
    |
Coverage Cells
    |
Assignments
```

Only street segments relevant to the project geography should be included in project coverage calculations.

## 7. Coverage Truth Model

### 7.1 Street States

```text
UNCOVERED
PARTIALLY_COVERED
COVERED
VERIFIED
```

### 7.2 Area / Cell States

```text
UNVISITED
IN_PROGRESS
SEARCHED
VERIFIED
```

### 7.3 Critical Semantic Distinction

Survey Guru must preserve:

```text
UNVISITED
    !=
SEARCHED — ZERO OUTLETS FOUND
    !=
SEARCHED — OUTLETS FOUND
```

A blank area on a traditional outlet map is ambiguous. It could mean there are no outlets or nobody searched there. Survey Guru must remove that ambiguity.

## 8. Field Movement Evidence

GPS movement is evidence, not the final coverage truth.

The system should capture sufficient project-scoped movement evidence to determine what was searched while avoiding unnecessary unrestricted surveillance.

Possible movement evidence fields:

```text
MovementEvent
-------------
eventId
projectId
assignmentId
fieldWorkerId
timestamp
latitude
longitude
accuracyMeters
speedEstimate
captureMode
sourceDeviceIdRef
syncState
```

Movement evidence must be bounded by authorised project/assignment context and appropriate operational policy.

## 9. Active Search State

Location alone is insufficient.

Survey Guru should know whether the worker is actively performing an assignment/search operation.

Conceptual states:

```text
NOT_WORKING
ASSIGNMENT_READY
ACTIVE_SEARCH
VISIT_IN_PROGRESS
PAUSED
ASSIGNMENT_COMPLETE
```

Only movement collected under permitted operational states should contribute to coverage calculations.

This reduces false coverage from travel to/from the market, lunch breaks, commuting or unrelated movement.

## 10. Street Map Matching

The Street Coverage Engine converts movement evidence into traversal evidence against the known street network.

Conceptually:

```text
GPS Samples
    |
Accuracy filtering
    |
Candidate street segments
    |
Map matching
    |
Traversal calculation
    |
Coverage confidence
    |
Street coverage state
```

A worker crossing a street, standing near its entrance or travelling on a parallel road must not automatically mark it covered.

## 11. Traversal Evidence Entity

The system should persist a derived operational record rather than repeatedly interpreting raw GPS trails for every map request.

Conceptual entity:

```text
StreetTraversal
---------------
traversalId
projectId
assignmentId
streetSegmentId
fieldWorkerId
firstObservedAt
lastObservedAt
traversedMeters
segmentLengthMeters
traversedPercent
coverageState
coverageConfidence
outletsObservedCount
visitsLinkedCount
sourceEvidenceWindow
algorithmVersion
verifiedAt
verifiedBy
```

The raw evidence and derived coverage must remain distinguishable so coverage can be recalculated if algorithms improve.

## 12. Coverage Determination

A street must not be marked covered simply because GPS came within a fixed radius.

Coverage should consider combinations of:

- proportion of street segment traversed;
- continuity of traversal;
- GPS accuracy;
- time spent in the segment;
- active-search state;
- direction/movement consistency;
- known intersections;
- outlet captures/visits as supporting evidence;
- project-specific coverage policy.

Example conceptual rule:

```text
IF activeSearch = true
AND GPS confidence acceptable
AND traversedPercent >= configured threshold
AND traversal continuity acceptable
THEN candidateState = COVERED
```

Thresholds must be configurable and field-tested. They must not be hard-coded as universal truth.

## 13. Partial Coverage

Partial coverage is important operational information.

Examples:

- worker walks half the street and turns back;
- GPS evidence becomes unreliable;
- only one section of a long segment is traversed;
- assignment ends before street completion.

The map should leave the remaining portion or segment visibly outstanding rather than treating the street as complete.

Where technically practical, geometry-level coverage may eventually show the traversed portion of a segment rather than only a whole-segment status.

## 14. Coverage Verification

`COVERED` means the system has sufficient operational evidence under the configured rule.

`VERIFIED` represents stronger confirmation, for example:

- supervisor review;
- QA review;
- project closure validation;
- repeated independent evidence;
- other approved verification logic.

Verification must be auditable.

## 15. Live Street Coverage Map — Field Worker

The Field Worker map should be designed around immediate action, not GIS complexity.

Primary questions:

1. Where am I?
2. What is my assigned area?
3. Which streets have I already searched?
4. Which streets are partially searched?
5. Which streets remain?
6. Where are known/new stores?
7. Where should I go next?

Conceptual layers:

```text
[x] My Coverage
[x] Uncovered Streets
[x] Known Stores
[x] New Stores
[x] Current Position
[ ] Priority Areas
[ ] Team Coverage (permission dependent)
```

Covered/partial/uncovered states must use more than colour alone for accessibility.

## 16. Live Updating Behaviour

The field map should update progressively as valid evidence is captured.

Example:

```text
08:30  Street A   UNCOVERED
08:37  Street A   PARTIALLY_COVERED
08:44  Street A   COVERED
```

The UI can use optimistic/local calculation where necessary for offline responsiveness, but the server remains authoritative after synchronisation and may reconcile status based on full evidence.

The worker must be clearly informed if a locally displayed coverage result changes after authoritative reconciliation.

## 17. Offline Coverage

Coverage cannot depend on continuous connectivity.

Before field work, the worker receives the minimum authorised offline package containing:

- assignment boundary;
- relevant street segments;
- current authorised coverage state;
- known outlets required for assignment;
- survey definition;
- other minimal assignment context.

During offline work, the device stores:

- movement evidence;
- local traversal progress;
- visits/responses;
- evidence/photos;
- local coverage-state changes.

On reconnect:

```text
Local Evidence
      |
Authenticated Sync API
      |
Server validation
      |
Map matching / coverage derivation
      |
Conflict reconciliation
      |
Authoritative Coverage Truth
```

## 18. Supervisor Live Operations Map

Supervisors see the same coverage truth aggregated across authorised workers.

The map should expose:

- project boundary;
- operational zones;
- covered streets;
- partially covered streets;
- uncovered streets;
- known outlets;
- new outlets;
- accepted outlets;
- coverage gaps;
- field-worker activity where authorised;
- QA/coverage exceptions;
- high-priority remaining areas.

The objective is to reveal holes immediately.

If all surrounding streets are covered but three streets were missed, those streets remain clearly outstanding.

## 19. Supervisor Metrics

Examples:

```text
Overall street coverage:     72%
Covered segments:            642
Partially covered:            37
Uncovered segments:          184
Stores discovered:         1,284
New outlets:                 317
Searched-zero-found units:    83
```

Per-worker metrics may include assigned network length, covered length, partial/outstanding work, outlets/visits, last relevant activity and exceptions.

These metrics should support operational management without unnecessary gamification.

## 20. Historical 80,000+ Outlet Universe

TES/Taskraft already has more than 80,000 historically captured stores. Subject to provenance and data-right permissions, this dataset is a major strategic input.

The historical dataset should be:

1. imported through controlled processes;
2. cleaned and normalised;
3. deduplicated without silent destructive merging;
4. assigned stable outlet identity where appropriate;
5. spatially indexed in PostGIS/H3;
6. tagged with provenance and data-right classification;
7. separated between client-private and TES-reference-permitted data.

The Field Worker must never receive the entire 80,000+ dataset on-device. Map/API queries return only authorised, spatially relevant records.

## 21. Historical Outlet Density

The existing outlet universe provides an initial prior for understanding market structure.

Useful derived measures may include:

- outlets per H3 cell;
- outlets per street kilometre;
- outlet clusters;
- historical WTS density;
- category/brand/volume attributes where rights permit;
- recency of observation;
- known commercial corridors;
- previously searched geography.

Historical presence does not prove current existence and must retain observation dates/provenance.

## 22. Opportunity Direction Principle

Coverage answers:

> **Where have we searched?**

Opportunity Direction answers:

> **Given what we know and what remains uncovered, where should we search next?**

The engine must not confuse high historical outlet density with current guaranteed opportunity.

## 23. Opportunity Direction — MVP

MVP should begin with deterministic prioritisation where reliable evidence exists, not machine-learning theatre.

Possible inputs:

```text
Historical outlet density
+ known current outlets
+ unsearched street density
+ existing coverage state
+ recent discovery rate
+ distance from worker
+ assignment boundary
+ operational priority
= deterministic priority score
```

A simple result might be:

```text
Recommended next area
Distance:              380 m
Unsearched streets:    12
Known outlets nearby:   7
Priority:             HIGH
Reason: dense historical outlet cluster + low current coverage
```

The system should explain why an area is recommended.

## 24. Future Opportunity Intelligence

As Survey Guru accumulates coverage truth, it gains something historical outlet datasets alone cannot provide: reliable negative evidence.

Example:

```text
Predicted high potential
        |
Field team comprehensively searches area
        |
17 outlets found
        |
Positive learning evidence
```

or:

```text
Predicted high potential
        |
Field team comprehensively searches area
        |
0 outlets found
        |
Negative learning evidence
```

Both outcomes are valuable.

Future models may incorporate settlement form, street density, land use, transport nodes, commercial corridors, historical category performance, imagery-derived/public features where lawfully licensed, discovery history and other approved signals.

AI recommendations remain human-supervised and confidence/explanation should be exposed where practical.

## 25. Next-Best-Area Direction

The long-term field experience should support a simple action such as:

**SHOW ME WHERE TO GO NEXT**

The recommendation engine evaluates only authorised assignment geography and returns a ranked next area/street group with reason and navigation target.

It must respect assignment boundaries and must not silently expand a worker's authorised scope.

## 26. Exhaustive Coverage vs Opportunity-Led Coverage

Projects may have different objectives.

### Exhaustive WTS
Every eligible street must eventually be searched. Opportunity scoring changes order, not completion requirement.

### Opportunity-Led Survey
Field teams may prioritise high-probability geography within time/budget limits.

### Known-Outlet Verification
Coverage focuses on known outlet targets rather than every street.

The project coverage policy must therefore be explicit.

## 27. Coverage Policy

Conceptual configuration:

```text
CoveragePolicy
--------------
policyId
projectId
mode
eligibleRoadClasses
minimumTraversalPercent
minimumGpsQuality
partialThreshold
verificationRequired
movementSamplingPolicy
retentionPolicyId
```

The policy allows Survey Guru to evolve without embedding one WTS operating rule into code forever.

## 28. Privacy, Fairness & Purpose Limitation

Field movement collection must have a legitimate operational purpose and be limited to what is required for project execution, coverage evidence, safety/quality where applicable and authorised reporting.

Principles:

- project/work scoped;
- clear notice to Field Workers;
- no unrestricted off-duty tracking;
- role-based access;
- appropriate retention;
- raw movement access more restricted than derived coverage;
- audit sensitive access where appropriate;
- client access to individual movement only where explicitly justified/authorised;
- derived project coverage should normally be preferred over exposing unnecessary raw trails.

## 29. Security & Authorisation

All coverage APIs follow the Survey Guru backend-authority principle:

```text
Authenticated Identity
        |
Workspace Membership
        |
Project Permission
        |
Assignment / Resource Scope
        |
Data Rights
        |
Coverage Policy
        |
ALLOW / DENY
```

The client must not be trusted to declare authoritative `workerId`, `projectId`, `assignmentId`, street ownership or coverage state.

The server resolves authoritative scope from authenticated identity and resources.

## 30. Coverage State Security

Field Workers may submit movement/search evidence but cannot arbitrarily set a street to `VERIFIED`.

Derived coverage state is calculated/validated server-side.

Manual supervisor/QA overrides require permission, reason and audit event.

## 31. API Direction

Potential protected API surfaces:

```text
GET  /api/v1/projects/{id}/coverage
GET  /api/v1/assignments/{id}/coverage
GET  /api/v1/assignments/{id}/street-segments
POST /api/v1/assignments/{id}/movement-events
POST /api/v1/assignments/{id}/coverage-sync
GET  /api/v1/projects/{id}/coverage-summary
GET  /api/v1/projects/{id}/opportunity-priorities
POST /api/v1/coverage/{id}/verify
```

Exact endpoints are implementation design, but every protected endpoint must follow the API & Authorisation Specification.

## 32. Data Persistence Direction

### MVP
Firestore may hold project/assignment coverage state and sync metadata where practical while the API remains the authority.

### Target
PostgreSQL/PostGIS should become authoritative for:

- street geometry;
- project geography;
- traversal geometry/derived records;
- spatial intersection/matching;
- outlet geometry;
- coverage calculations;
- spatial opportunity queries.

H3 indexes support aggregation and scalable spatial lookup.

BigQuery can later support historical analytics/model training but is not the transactional source of coverage truth.

## 33. GIS Ownership Principle

> **TES owns the geographic intelligence, not Esri or Google.**

External providers may supply basemaps, road data, routing, geocoding or analysis tools, but Survey Guru's permanent IDs, coverage state, outlet identity, traversal evidence and opportunity logic must remain provider-neutral TES domain data.

## 34. Street Data Source Abstraction

Road/street geometry must be treated as a replaceable/provider-versioned source.

Survey Guru should preserve its own stable street-segment identity/mapping where feasible so a provider change does not destroy project history.

Source/licensing terms must permit intended storage, derivative use and display. This must be reviewed before selecting production street data.

## 35. Performance Architecture

Field clients must never load an entire national outlet or road dataset.

Use:

- viewport/assignment-bounded spatial queries;
- spatial indexes;
- simplified geometry for mobile rendering;
- appropriate caching;
- H3 aggregation for overview zoom levels;
- street detail only at relevant zoom/assignment scope;
- incremental sync;
- server-derived summaries.

## 36. Coverage Confidence

Coverage state and confidence should be distinct.

Example:

```text
State:       COVERED
Confidence:  0.94
Reason:      91% continuous traversal, good GPS, active search
```

or:

```text
State:       PARTIALLY_COVERED
Confidence:  0.71
Reason:      GPS degradation and only 58% traversal
```

Initial confidence may be deterministic/rule-based rather than statistical.

## 37. Exception Detection

Coverage exceptions may include:

- impossible movement;
- GPS jumps;
- low accuracy over prolonged period;
- repeated rapid traversal inconsistent with survey mode;
- claimed completion without sufficient evidence;
- unexplained coverage holes;
- duplicated movement uploads;
- stale/offline evidence arriving after reassignment;
- conflicting coverage from multiple devices.

Exceptions should not automatically accuse a worker of misconduct. They are operational/QA signals requiring appropriate interpretation.

## 38. Idempotency & Sync

Movement and coverage sync must tolerate retries.

Each movement/evidence batch should carry stable identifiers/idempotency keys. Re-uploading a batch must not duplicate traversal distance or inflate coverage.

Server processing should record algorithm/version information for derived results.

## 39. Team Coverage

Multiple workers may contribute to the same street/area.

Project coverage is the union of valid authorised coverage evidence, while worker contribution remains separately attributable for operations/audit.

Reassignment must not erase valid previous coverage.

## 40. Outlet Discovery & Coverage Relationship

Outlet captures support coverage but do not define it.

A street with ten captured outlets is strong evidence of field activity but still requires appropriate coverage determination.

A street with zero outlets can be fully covered.

This distinction is essential for opportunity learning and project completeness.

## 41. Reporting

Coverage reports should eventually include:

- eligible street network length;
- covered network length/percentage;
- partial network;
- outstanding network;
- area/cell coverage;
- searched-zero-found geography;
- outlets found per covered kilometre/cell;
- discovery rate;
- coverage by worker/zone/date;
- remaining high-priority geography;
- coverage confidence/exceptions where useful.

## 42. Client Deliverable Value

Survey Guru enables Taskraft/TES to provide evidence beyond a store list.

A client can receive:

- verified outlet universe for the project;
- proof of geographic search completeness;
- outstanding areas;
- searched-zero-found evidence;
- spatial opportunity findings;
- repeatable coverage methodology;
- longitudinal market-change insight.

This materially strengthens WTS as a professional market-intelligence service.

## 43. Relationship to Fleetwize

Survey Guru answers:

> **What exists, where did we search, and where is the opportunity?**

Fleetwize answers:

> **How should the distribution/service network reach it?**

Survey Guru opportunity/coverage outputs should eventually be consumable by Fleetwize through controlled TES interfaces rather than direct database coupling.

## 44. MVP vs Future Boundary

### MVP Required
- project street-network context;
- live Field Worker street coverage map;
- covered/partial/uncovered street states;
- offline coverage evidence;
- server-side coverage derivation/reconciliation;
- supervisor live coverage map;
- searched-zero-found distinction;
- coverage reporting;
- basic deterministic prioritisation where reliable;
- privacy/security controls.

### Future / Progressive
- sophisticated map matching;
- machine-learned outlet probability;
- richer external spatial signals;
- automated next-best-area ranking;
- predictive opportunity confidence;
- dynamic multi-worker allocation;
- Fleetwize optimisation handoff;
- advanced BigQuery/model pipelines.

MVP implementation may begin with simpler robust algorithms, but the data model must not prevent later sophistication.

## 45. Implementation Sequence

### Stage 1 — Geographic Foundation
Define street source, stable segment model, project street selection and H3 indexing.

### Stage 2 — Field Coverage Capture
Implement active-search state, sampled movement evidence, offline queue and field map street states.

### Stage 3 — Coverage Engine
Implement map matching/traversal derivation, thresholds, partial/covered state and reconciliation.

### Stage 4 — Supervisor Operations
Implement team coverage aggregation, gap map, metrics and exceptions.

### Stage 5 — Historical Outlet Intelligence
Ingest/clean permitted 80,000+ outlet history, spatially index and derive density/reference layers.

### Stage 6 — Opportunity Direction
Introduce explainable deterministic next-area priorities, then progressively evaluate predictive models as sufficient labelled coverage outcomes accumulate.

## 46. Field Pilot Requirement

Street coverage rules cannot be validated only in an office.

Before production acceptance, run controlled field pilots representing:

- dense township streets;
- informal settlements where mapped streets may be incomplete;
- CBD/commercial streets;
- suburban areas;
- rural/sparse settlements;
- poor GPS conditions;
- offline periods;
- walking vs vehicle movement where both are operationally relevant.

Compare system-derived coverage against supervisor-observed ground truth and refine thresholds.

## 47. Informal / Unmapped Areas

South African field conditions mean a street-only model will sometimes be insufficient.

Where mapped roads/paths are incomplete, Survey Guru must fall back to area/H3 coverage and captured movement geometry rather than falsely declaring the area unmeasurable.

Future capability may allow authorised supervisors to define operational paths/lanes or coverage polygons where the source street network is inadequate.

This is a key reason street coverage and H3 area coverage must coexist.

## 48. Locked Architecture Decisions

1. Live Street Coverage Map is first-class MVP for Field Workers and Supervisors.
2. Coverage is operational domain data, not a visual effect.
3. Street-level and H3/area-level coverage coexist.
4. GPS trails are evidence; derived coverage is the operational truth.
5. Proximity alone cannot mark a street covered.
6. Partial coverage is preserved.
7. Unvisited, searched-zero-found and searched-with-outlets remain distinct.
8. Outlet count does not determine coverage completeness.
9. Coverage must work offline and reconcile server-side.
10. Project coverage is the union of valid team evidence; worker contribution remains attributable.
11. Movement tracking is project/work scoped and privacy-conscious.
12. The server/API is authoritative for protected coverage state.
13. Manual coverage overrides are permissioned, reasoned and audited.
14. The 80,000+ historical outlets are a strategic reference/intelligence layer subject to provenance and rights.
15. Field clients receive only spatially relevant authorised subsets, never the whole universe.
16. Deterministic opportunity prioritisation precedes machine-learned prediction.
17. Positive discoveries and comprehensively searched-zero-found areas both become future learning evidence.
18. PostGIS is the target authoritative spatial store; H3 complements it for indexing/aggregation.
19. TES owns permanent geographic intelligence and remains provider-neutral.
20. Informal/unmapped geography requires area-based fallback rather than forcing street-only coverage.
21. Exhaustive and opportunity-led projects use explicit coverage policies.
22. Coverage algorithm versions and evidence provenance must be retained.

## 49. Required Follow-On Specifications

This architecture should drive updates or creation of:

1. **Survey Guru Screen & Navigation Architecture v1.0** — detailed Field Worker and Supervisor Live Coverage Map UX.
2. **Survey Guru Field Capture & Offline Workflow Specification v1.0** — active-search states, local movement capture, offline map state and reconciliation.
3. **Survey Guru Coverage Model Specification v1.0** — street-segment schema, H3 resolution strategy, traversal algorithms, state transitions and thresholds.
4. **Survey Guru QA & Validation Rules Specification v1.0** — coverage exceptions, GPS rules and verification workflow.
5. **Survey Guru Data Model & Entity Architecture v1.0** — add StreetSegment, MovementEvent, StreetTraversal, CoveragePolicy and related entities/relationships.
6. **Survey Guru MVP Persistence Specification v1.0** — persistence/API boundaries for coverage and eventual PostGIS migration.
7. **Survey Guru API & Authorisation Specification v1.0** — coverage/movement/opportunity endpoint permissions and field-level controls.
8. **Survey Guru Import & Export Specification v1.0** — historical outlet import, geographic source import and coverage outputs.

---

## Living Documentation Rule

This is a living TES architecture specification. Material discoveries or decisions affecting coverage, field tracking, geography, opportunity direction, privacy, security, persistence or field execution must be version-controlled here and in any other materially affected Survey Guru/TES specification rather than remaining only in chat or informal notes.
