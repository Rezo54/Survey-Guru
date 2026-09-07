# Survey Guru Data Model & Entity Architecture v1.0

**Product Owner:** TES — Task Expert Systems  
**Initial Operational Environment:** Taskraft (Pty) Ltd  
**Status:** Approved Baseline / Living Document  
**Version:** 1.0

## 1. Core Architecture

Survey Guru uses three logically separated data domains:

1. **TES Platform Domain** — identities, organisations, memberships, configuration and product-level services.
2. **Workspace / Client Domain** — projects, assignments, visits, responses, evidence and client-specific observations.
3. **TES Market Universe** — permitted permanent outlet/reference/geographic/coverage intelligence.

> Information does not move from a client workspace into the TES Market Universe merely because Survey Guru captured or processed it.

Movement across the boundary requires explicit rights and an auditable process.

## 2. Entity Hierarchy

Core platform/workspace entities:

**Organisation → Workspace → Project → Survey Definition/Version → Assignment → Field Worker → Visit → Response/Observation/Evidence → Validation**

Market entities:

**Geography → Outlet → Outlet Alias/History → Coverage → future Opportunity/Recommendation → Fleetwize**

## 3. IDs

Every material entity receives an immutable system-generated identifier. Names are never primary identifiers. Human-readable references may be generated separately for operations/reports.

## 4. Organisation

Represents a legal/business entity participating in Survey Guru, e.g. TES, Taskraft or a client. Organisation membership alone does not grant access to all associated workspaces.

Lifecycle: `pending → active → suspended → archived`.

## 5. Workspace

A major data/security boundary. A workspace can have an owner/client organisation, an operating organisation and separately authorised members. Workspaces allow Taskraft to operate for a client without collapsing organisational/data ownership boundaries.

Lifecycle: `setup → active → suspended → archived`.

## 6. Workspace Membership

Explicit relationship between a user and workspace. Permissions are workspace-scoped; organisation role alone does not confer workspace data access.

## 7. Project

Belongs to a workspace and represents defined fieldwork. Projects reference outlets; they do not own the permanent outlet universe.

Lifecycle: `draft → configured → active → paused → completed → archived`.

Completing/archiving a project does not delete visits, observations or evidence.

## 8. Survey Definition and Versioning

Survey definitions contain sections/questions/answer types/validation/conditional logic/evidence requirements. Published survey versions are immutable. Changes create a new version. Every visit records the exact version used.

## 9. Geography

Supports administrative geography and Survey Guru operational geography such as Market → Territory → Zone → Coverage Cell. Project boundaries need not exactly match government boundaries.

## 10. Outlet

The central persistent TES Market Universe entity.

> **Outlet = what/where is this place?**

Stable/reference characteristics belong here. Time-sensitive commercial observations do not.

Lifecycle: `candidate → verified → active → temporarily_closed → permanently_closed → archived`.

Closed outlets remain historical market intelligence.

## 11. Outlet Alias

Stores alternate names associated with a physical outlet and supports duplicate detection and customer-data matching.

## 12. Client Outlet Reference

Maps a client's customer identifier/name to a Survey Guru outlet without making the client's identifier the permanent TES outlet identity.

## 13. Assignment

Defines exactly what a field worker has been asked to do. Targets may include outlets, geography, coverage cells, verification tasks and future opportunities.

Lifecycle: `created → assigned → accepted → in_progress → submitted → completed`, with rejected/cancelled/reassigned exception states.

## 14. Field Worker

A Survey Guru field-operating identity, not synonymous with a Taskraft employee. The model must remain compatible with employees, contractors, validators, trainers and future certified regional operators.

## 15. Visit

Represents the physical field event and links project, workspace, outlet, assignment, field worker and survey version. It retains timestamps, capture location/accuracy, device/sync metadata and QA state.

## 16. Response vs Observation

A **Response** is the raw answer to a survey question.

An **Observation** is a factual/intelligence assertion derived from a response, rule, AI process or other permitted source.

This separation protects the future intelligence model from being tied to questionnaire structure.

## 17. Evidence

Evidence is a first-class entity, including photographs, documents, GPS evidence, signatures and future media/AI evidence. Binary objects live in protected object storage; database records hold metadata and secure references.

## 18. Validation

Stores individual automated and human QA checks, outcomes, confidence, reviewer/process, reason and corrective action. The system retains each check rather than only a final approved flag.

## 19. Coverage

Coverage exists from MVP. Coverage cells may track unvisited/in-progress/searched/verified state, visits, discovered outlets, effort and last searched time. Future predictive fields include estimated outlet count, predicted gap, coverage confidence and recommended effort.

## 20. Opportunity and Recommendation

Reserved future entities for potential outlets, distribution gaps, underserved clusters, route expansion, execution problems and other intelligence. These become a key bridge to Fleetwize.

## 21. Provenance

Intelligence-bearing data must be capable of answering **where did this information come from?** Relevant provenance includes source type/id, workspace, project, visit, field worker, observed time, confidence and usage rights.

## 22. Data-Rights Classification

Initial classifications:

- `CLIENT_PRIVATE`
- `OPERATIONAL_SHARED`
- `TES_REFERENCE_PERMITTED`
- `PUBLIC_OR_LICENSED`

The data model supports enforcement of contractual/legal rights; it does not replace the governing agreements.

## 23. Controlled Promotion to TES Market Universe

Workspace data may produce a candidate outlet. Promotion to the permanent TES Market Universe requires validation/deduplication plus an explicit rights check. The promotion event is auditable. If rights do not permit promotion, information remains within the workspace boundary.

## 24. Historical Integrity

Archive/deactivate/supersede is preferred to casual hard deletion for outlets, projects, visits, observations, survey versions, evidence and validations. Legal/privacy retention requirements may require controlled deletion.

## 25. Audit Trail

Significant events must be auditable, including survey submission, response changes, visit reopening, outlet merge, GPS/validation override, access changes, exports, rights changes and Market Universe promotion.

## 26. Security Boundary Rule

> **The UI is never an access-control mechanism.**

All protected reads and mutations must be authorised by trusted API/backend/database controls according to identity, workspace, permission, project/assignment scope, data domain and data-right classification. Hiding UI elements is UX only.

## 27. Locked Architecture Decisions

1. TES (Task Expert Systems) owns Survey Guru.
2. The outlet is the long-lived market entity.
3. Projects reference outlets rather than owning the outlet universe.
4. Surveys are configurable and versioned; published versions are immutable.
5. Raw responses and market observations are separate concepts.
6. Evidence, geography, coverage and validation are first-class entities.
7. Field workers are not hard-coded as Taskraft employees.
8. Workspace membership is an explicit security relationship.
9. Client/workspace data and TES Market Universe data have an explicit rights boundary.
10. Provenance travels with intelligence.
11. Historical integrity and auditability are mandatory.
12. Survey Guru is architected for eventual Fleetwize consumption.
13. API/backend-enforced strict authorisation is mandatory; UI-based access control is prohibited as a security mechanism.

---

This is a living TES architecture document. Material changes should be version-controlled in this repository.