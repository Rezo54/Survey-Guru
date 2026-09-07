# Survey Guru Data Persistence & GIS Architecture v1.0

**Product Owner:** TES — Task Expert Systems  
**Operational / Field Partner:** Taskraft (Pty) Ltd  
**Status:** Approved Architecture Baseline / Living Document  
**Version:** 1.0  
**Date:** 7 September 2026

## 1. Purpose

This document defines how Survey Guru will persist, query, analyse and expose operational, geographic and intelligence data from MVP through scale.

Survey Guru must not be architecturally trapped inside a single database technology. Firebase provides a rapid initial platform, but the permanent domain and GIS architecture is designed to evolve toward a relational and spatial data platform capable of complex geographic queries, longitudinal outlet intelligence, analytics and future decision intelligence.

> **Firebase is an initial implementation component, not the permanent definition of the Survey Guru data model.**

> **The Survey Guru domain and GIS model must remain portable and must not depend on Firestore-specific modelling.**

## 2. Architecture Principles

1. The permanent Survey Guru domain model is technology-independent.
2. API/backend services are the authority for protected application data and actions.
3. The UI is never an access-control boundary.
4. Firebase may accelerate MVP but must not force permanent NoSQL compromises into the domain model.
5. PostgreSQL + PostGIS is the target transactional/spatial database architecture as Survey Guru matures.
6. BigQuery is the analytical warehouse layer, not the primary operational transaction database.
7. Cloud object storage holds photographs, documents and other large evidence objects; databases hold metadata and secure references.
8. H3 provides a scalable spatial indexing/grid mechanism for coverage and market-intelligence calculations where appropriate.
9. ArcGIS remains available for professional GIS workflows, analysis, geocoding, routing and presentation where it provides value.
10. Development, staging/test and production are separated.
11. Data provenance and data-right classifications travel with intelligence-bearing data.
12. Client workspace data does not automatically become TES Market Universe data.

## 3. Target Technology Stack

### Application Layer
- Next.js
- TypeScript
- Mobile-first responsive/PWA field interface

### Identity
- Firebase Authentication initially
- Support for future enterprise identity providers where required

### API / Service Layer
- Survey Guru controlled API/service layer
- Google Cloud Run is the preferred scalable service runtime as the architecture matures
- Firebase Admin SDK may be used server-side during the Firebase phase

### Operational Data
- Firebase / Firestore for selected MVP requirements
- Google Cloud SQL for PostgreSQL as the target relational operational database
- PostGIS extension for spatial data and queries
- AlloyDB for PostgreSQL may be evaluated later where scale/performance warrants it

### Evidence / Binary Objects
- Firebase Storage initially where appropriate
- Google Cloud Storage as the long-term object-storage layer

### Spatial Indexing
- PostGIS geometry/geography types
- H3 spatial indexing where useful for coverage, aggregation and intelligence

### Analytics
- BigQuery for analytical workloads, historical aggregation and large-scale reporting
- BI/reporting tools may consume authorised BigQuery or API-served datasets

### GIS Ecosystem
- ArcGIS Online
- ArcGIS Pro
- PostGIS spatial processing
- H3 grid/cell analysis
- Approved geocoding/routing services

### Source / Deployment
- GitHub private repository as source/change-history authority
- Netlify for the initial Next.js deployment path where suitable
- Google Cloud services for API, database, storage, analytics and GIS workloads as required

## 4. Logical Target Architecture

```text
                         SURVEY GURU
                              |
                    Next.js + TypeScript
                              |
                              v
                       Firebase Auth
                              |
                              v
                    SURVEY GURU API LAYER
                              |
                    Cloud Run / Server API
                              |
          +-------------------+-------------------+
          |                   |                   |
          v                   v                   v
   PostgreSQL/PostGIS    Cloud Storage        BigQuery
      Cloud SQL          Evidence/Files       Analytics
          |                                       |
          v                                       v
     SPATIAL ENGINE                         BI / Reporting
          |
    +-----+---------+
    |               |
    v               v
 PostGIS            H3
    |               |
    +-------+-------+
            |
            v
 Coverage / Gap / Opportunity Intelligence
            |
            v
       Future Fleetwize
```

Firebase/Firestore may coexist during transition but is not the final spatial intelligence database.

## 5. MVP Persistence Strategy

The MVP must get Taskraft operational quickly without sacrificing the future architecture.

Firestore may initially hold application data that benefits from rapid implementation and simple document access. However:

- entities retain technology-independent IDs and schemas;
- service/domain logic must not be embedded inside Firestore document structure;
- Firestore-specific denormalisation must be treated as an implementation projection, not the canonical domain definition;
- spatial data must be stored in forms that can migrate cleanly to PostGIS;
- APIs should isolate the frontend from persistence implementation wherever practical.

Potential initial Firebase capabilities include authentication, selected operational documents, early configuration/state and storage of evidence objects.

## 6. Target PostgreSQL / PostGIS Role

PostgreSQL becomes the durable relational operational store for entities such as:

- organisations;
- workspaces and memberships;
- projects;
- survey definitions and immutable versions;
- geography;
- permanent outlets and aliases;
- client outlet references;
- field workers;
- assignments;
- visits;
- responses;
- observations;
- validations;
- coverage cells;
- data-right classifications;
- provenance;
- audit references;
- future opportunities and recommendations.

PostGIS becomes the authoritative spatial-query capability for permanent geographic relationships.

## 7. Why PostGIS Matters to Survey Guru

Survey Guru requires queries that become increasingly awkward or expensive in a document database, including:

- outlets inside a polygon;
- nearest outlet to a captured GPS point;
- possible duplicates within a radius;
- outlet density by territory;
- outlets intersecting custom geographic boundaries;
- distance to roads or commercial nodes;
- project coverage by polygon/cell;
- territory overlap;
- underserved areas;
- spatial clustering;
- catchment analysis;
- market opportunity calculations;
- geographic history and change over time.

The spatial database must therefore become a core intelligence capability rather than merely storing latitude and longitude fields.

## 8. Geometry Standards

All geographic entities should support explicit spatial geometry rather than relying only on text names.

Typical geometry types:

- Outlet: `POINT`
- Survey/territory boundary: `POLYGON` / `MULTIPOLYGON`
- Coverage cell: `POLYGON`
- Route/trail: `LINESTRING` / `MULTILINESTRING`
- Administrative geography: `POLYGON` / `MULTIPOLYGON`

WGS84 / EPSG:4326 should be the standard interchange coordinate reference unless a specific analytical process requires a projected CRS.

Raw capture latitude/longitude and GPS accuracy should be retained separately where provenance requires it.

## 9. H3 Spatial Indexing

H3 provides a hierarchical hexagonal spatial index that can complement PostGIS.

Survey Guru may assign H3 cell identifiers to outlets, visits and coverage areas at selected resolutions. Potential uses include:

- coverage heatmaps;
- searched vs unsearched areas;
- outlet density;
- survey effort;
- discovery rate;
- geographic aggregation;
- predicted outlet count;
- opportunity scoring;
- efficient neighbouring-cell analysis;
- Coverage Engine calculations.

H3 does not replace PostGIS. PostGIS remains responsible for authoritative spatial relationships and geometry operations; H3 provides efficient hierarchical spatial indexing/aggregation.

## 10. Coverage Data Model Direction

Coverage must exist from MVP and distinguish at minimum:

- `unvisited`
- `in_progress`
- `searched`
- `verified`

This enables the crucial distinction between:

**No outlets found because a surveyor searched the area**

and

**No outlets recorded because nobody has searched the area.**

Future coverage attributes may include:

- effort duration;
- distance/movement evidence;
- outlets discovered;
- last searched time;
- surveyor/discovery rate;
- expected outlet count;
- predicted gap;
- confidence score;
- recommended additional effort.

## 11. Outlet Spatial Identity

The permanent outlet is the core market entity. A captured location is not automatically a new outlet.

New captures should progressively pass through matching/deduplication using signals such as:

- distance to existing outlet;
- name similarity;
- address/area;
- client reference;
- historical aliases;
- storefront evidence;
- future AI similarity signals.

The system should be capable of returning a candidate match such as:

> Possible existing outlet — last verified Aug 2026 — 7 m away — confidence 96%.

Human validation remains available where confidence is insufficient.

## 12. Evidence Storage Architecture

Photographs, documents and future video should not be embedded as database blobs.

The database stores:

- evidence ID;
- workspace/project/visit/outlet/question/observation references as applicable;
- object-storage key;
- content type;
- size;
- checksum where useful;
- captured timestamp;
- capture location/accuracy where permitted;
- validation state;
- provenance;
- data-right classification.

Object access must be authorised. Public permanent URLs are prohibited for protected evidence.

## 13. BigQuery Analytics Layer

BigQuery should receive authorised analytical data when operational scale and reporting needs justify it.

Potential workloads include:

- longitudinal outlet history;
- surveyor productivity;
- project trends;
- discovery rates;
- coverage metrics;
- outlet-density trends;
- client reporting datasets;
- model-training/feature datasets where rights permit;
- opportunity analytics;
- cross-period market change.

BigQuery does not become the source of truth for transactional editing.

Data exported to BigQuery must preserve workspace/data-right boundaries and must not create an accidental cross-client data lake.

## 14. ArcGIS Role

ArcGIS Online and ArcGIS Pro remain part of the Survey Guru GIS toolkit rather than the core transactional database.

Potential uses:

- professional cartography;
- geocoding;
- routing/service-area analysis;
- advanced spatial analysis;
- cluster and density analysis;
- client presentation maps;
- geographic QA;
- external GIS-layer integration.

Survey Guru should interact with ArcGIS through controlled integrations/export/import/API processes rather than making the application domain dependent on proprietary ArcGIS object structures.

## 15. Data Domains Across Persistence Layers

The three-domain model applies regardless of database technology:

### TES Platform Domain
Identity references, organisations, configuration, platform administration.

### Workspace / Client Domain
Projects, client-specific field data, responses, evidence and confidential observations.

### TES Market Universe
Permitted permanent outlet/reference/geographic/coverage intelligence.

Moving from Firestore to PostgreSQL does not weaken or erase these boundaries.

## 16. Data Rights and Promotion

Records that may contribute to intelligence retain rights/provenance metadata, including classifications such as:

- `CLIENT_PRIVATE`
- `OPERATIONAL_SHARED`
- `TES_REFERENCE_PERMITTED`
- `PUBLIC_OR_LICENSED`

A controlled promotion process governs movement from workspace/client data into TES Market Universe data.

No ETL, BigQuery export, GIS process or AI pipeline may silently bypass this rule.

## 17. Strict API Access Architecture

> **Protected Survey Guru application data is accessed through authorised server/API operations. UI state never grants authority.**

For every protected request, the service resolves and validates:

1. authenticated identity;
2. organisation context where relevant;
3. workspace membership;
4. role/explicit permission;
5. project/assignment scope;
6. data domain;
7. data-right classification;
8. requested action.

The backend derives trusted security context. Client-supplied role, permission, workspace ownership or data-right claims are not accepted as authority.

Direct database access by end users must be prohibited or tightly constrained by independent database/security rules for any narrowly defined exception.

## 18. Database-Level Defence in Depth

API authorisation is the primary application control, but databases must also follow least privilege.

Examples:

- Cloud Run service identity receives only required database permissions;
- reporting/analytics identities receive read-only scoped access;
- migration identities are separate from runtime identities;
- development identities cannot access production data by default;
- AI/service identities receive function-specific access;
- direct administrative access is limited and audited.

## 19. Environment Separation

At minimum:

```text
DEVELOPMENT
     |
     v
STAGING / TEST
     |
     v
PRODUCTION
```

Each environment should use separate credentials and preferably separate projects/databases/storage resources where appropriate.

Synthetic/test data is the default for development and automated testing.

## 20. Migration Strategy: Firebase to PostgreSQL/PostGIS

Migration must be evolutionary rather than a high-risk rewrite.

### Phase A — Firebase MVP
Use Firebase capabilities to establish working field operations and validate the domain/workflows.

### Phase B — Introduce API Abstraction
Ensure persistence access is behind Survey Guru services/repositories so frontend/domain logic does not depend directly on Firestore.

### Phase C — Introduce PostgreSQL/PostGIS
Move high-value relational/spatial entities such as geography, outlets, visits and coverage to PostgreSQL/PostGIS.

### Phase D — Dual-System Transition Where Necessary
Temporary synchronisation/read models may be used while functionality migrates. A clear source of truth must be defined for every entity during transition.

### Phase E — Spatial Intelligence Core
PostGIS/H3 become the core for Coverage Engine, market gaps and opportunity analysis.

### Phase F — Analytical Warehouse
Authorised operational/intelligence events flow into BigQuery for large-scale analytics and reporting.

## 21. Avoiding Dual-Write Failure

The architecture should avoid uncontrolled application-level writes to both Firestore and PostgreSQL.

During transition, each entity has one authoritative system of record. Cross-system projections should use controlled events/jobs/outbox-style patterns or other reliable synchronisation mechanisms rather than casual duplicate writes from the UI.

## 22. Portability Principle

Survey Guru business logic should operate on domain/service contracts rather than Firestore document paths or PostgreSQL table details.

Conceptually:

```text
UI
 |
 v
API / Application Services
 |
 v
Domain Services
 |
 v
Persistence Interfaces
 |                |
 v                v
Firestore      PostgreSQL/PostGIS
(initial)         (target)
```

This also preserves the ability to accommodate future customer-specific infrastructure requirements without rewriting the product.

## 23. Future Intelligence Architecture

The target data platform should support:

**Outlet Universe → Coverage Intelligence → Gap Detection → Opportunity → Recommendation → Fleetwize**

Potential future AI/ML services consume only authorised datasets and operate through explicit service identities.

The intelligence layer must preserve source provenance and confidence so recommendations can be explained and validated.

## 24. Source Control and Deployment

GitHub is the authoritative source/change-history repository. Architecture documents are living documents stored with the product.

Secrets are excluded from Git. Local development uses environment files excluded from source control, with safe placeholder examples where useful.

Initial web deployment may use Netlify while Google Cloud Run and other Google Cloud services provide scalable backend/data capabilities.

## 25. Locked Decisions

1. Firebase is the initial implementation platform, not Survey Guru's permanent data architecture.
2. Survey Guru's canonical domain model is database-independent.
3. PostgreSQL + PostGIS on Google Cloud SQL is the target operational/spatial data platform.
4. AlloyDB may be considered later when scale/performance warrants it.
5. BigQuery is the analytical warehouse layer.
6. H3 complements PostGIS for hierarchical spatial indexing and coverage analysis.
7. ArcGIS remains part of the GIS ecosystem but does not own the Survey Guru domain model.
8. Evidence is stored in protected object storage with metadata in the database.
9. Strict API/backend authorisation is mandatory; UI access control is not a security mechanism.
10. Client/workspace/TES Market Universe data boundaries apply across every persistence and analytics layer.
11. Data-right and provenance controls apply to ETL, GIS, analytics and AI processes, not only the application UI.
12. Migration from Firebase to PostgreSQL/PostGIS must be incremental with explicit sources of truth.
13. Direct uncontrolled dual-writing across databases is prohibited.
14. The architecture must support future Survey Guru → Fleetwize decision-intelligence integration.

## 26. Next Technical Specifications

This architecture should now be followed by implementation-level specifications:

1. **Survey Guru MVP Persistence Specification v1.0** — exact initial Firestore/Firebase structures and what remains server-only.
2. **Survey Guru API & Authorisation Specification v1.0** — endpoints/services, permission checks, workspace isolation, scopes and error behaviour.
3. **Survey Guru PostgreSQL/PostGIS Logical Schema v1.0** — target tables, relationships, geometry types and indexes.
4. **Survey Guru GIS & Coverage Engine Specification v1.0** — H3 resolutions, coverage states, spatial algorithms and confidence calculations.
5. **Survey Guru Storage & Evidence Specification v1.0** — object paths, metadata, retention and secure retrieval.
6. **Survey Guru Analytics/BigQuery Specification v1.0** — authorised event/data flows and reporting model.

---

This is a living TES architecture document. Material changes must be version-controlled in the Survey Guru repository.