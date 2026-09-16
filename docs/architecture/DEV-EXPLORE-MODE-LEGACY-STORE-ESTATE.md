# Explore Mode, Map Search, and Legacy Store Estate

**Product:** Survey Guru  
**Owners:** TES — Task Expert Systems; Taskraft (legacy data rights holder)  
**Status:** Future development decision / living architecture note  
**Date:** 16 September 2026  
**Development branch:** `agent/local-test-checkpoint`

## 1. Decision summary

Survey Guru will add an **Explore Mode** alongside its existing Story, Capture, Evidence and Plan experiences.

Explore Mode will turn the map into a controlled market-intelligence workspace for:

- understanding the market before a survey begins;
- demonstrating the lay of the land during a client pitch;
- comparing old and newly captured outlet intelligence;
- identifying strong, weak, covered and under-served areas;
- locating outlets, places, teams and project activity;
- filtering opportunity using captured questionnaire fields.

The approximately 90,000 existing outlet records remain a ring-fenced Taskraft legacy data estate. TES may use them only under an explicit Taskraft–TES licence. Newly discovered outlets that were not present in the ring-fenced legacy snapshot will be classified as TES-native records, subject to contractual, privacy and client-data-right obligations.

## 2. Product modes

| Mode | Primary question |
| --- | --- |
| Story | What is the market telling us? |
| Capture | What must be collected or updated here? |
| Evidence | Can the observation, visit and movement be trusted? |
| Plan | What action, assignment or route should follow? |
| Explore | What exists here, what has changed, and where are the gaps or opportunities? |

Explore Mode must reuse the same authoritative outlet, project, coverage and rights-aware APIs. It must not become an ungoverned reporting copy of the database.

## 3. Map search and filters

### 3.1 Search targets

The map search must support:

- stores/outlets by current name;
- known previous or alternate store names;
- internal outlet identifiers and external source identifiers where permitted;
- addresses and map places;
- projects and assigned project areas;
- team members authorised for the selected project/workspace;
- captured questionnaire fields;
- map locations, suburbs, towns and coordinates.

Provider map places are contextual search results. They are not automatically TES or Taskraft outlet records and must not be persisted as captured stores without an authorised capture or import workflow.

### 3.2 Required filters

| Filter group | Examples |
| --- | --- |
| Coverage | covered, partially covered, outstanding, uncertain, last covered date |
| Store status | captured, verified, awaiting QA, rejected, possible duplicate, not visited |
| Store identity | current name, previous name, chain/banner, independent outlet, source |
| Project | project, project area, assignment, active/completed, capture period |
| Team | capturer, supervisor, team, contributor, last activity |
| Commercial | brand stocked, category, SKU, price, volume, availability, promotion |
| Opportunity | priority score, opportunity band, white space, under-served area |
| Evidence | photo present, GPS confidence, questionnaire completeness, verification state |
| Time | captured date, verified date, last visited, data freshness |
| Rights/provenance | licensed Taskraft legacy, TES-native, client-provided, restricted |

The filter engine should support combinations such as:

- stores within a project where a nominated brand is absent;
- verified outlets above a volume threshold that have not been visited recently;
- streets searched by one team with outstanding stores nearby;
- areas with strong outlet density but weak client distribution;
- legacy Taskraft outlets whose identity or trading name appears to have changed;
- newly discovered TES-native outlets absent from the original legacy snapshot.

### 3.3 Captured-question search

Questionnaire fields will vary by project. Search must therefore use a governed field-definition catalogue instead of hard-coding every question into the map.

Each searchable answer needs:

- canonical field identifier;
- display label;
- answer type and units;
- project/form version;
- allowed filter operations;
- sensitivity and data-right classification;
- normalised value where applicable;
- raw source value retained for audit;
- index/search eligibility.

Examples include store name, owner/contact name where legally permitted, brands, stock, volume, prices, pack sizes, refrigeration, credit availability and photos.

Sensitive personal information must not become generally searchable merely because it was captured.

## 4. Explore Mode behaviour

Explore Mode should provide:

- a live Google basemap with authoritative project and outlet overlays;
- project boundaries and street coverage;
- clustered outlet markers at wider zoom levels;
- store-level detail only at authorised zoom/access levels;
- filter chips and saved filter views;
- comparison between legacy, newly captured and verified current records;
- coverage, distribution and opportunity heatmaps;
- clear data-freshness and completeness indicators;
- aggregated pitch-ready views that do not expose raw proprietary outlet records;
- transitions into Story, Evidence and Plan for deeper analysis or action.

A client-pitch view may show market structure, density, coverage gaps and opportunity patterns. Access to row-level store data remains subject to the Taskraft–TES licence and client-specific rights.

## 5. Ring-fencing the approximately 90,000 stores

### 5.1 Immutable legacy snapshot

Before cleaning changes record identity, create a read-only source snapshot and manifest containing:

- snapshot identifier and date;
- supplied file hashes;
- approximate and exact accepted record counts;
- source systems/files;
- schema/data dictionary;
- Taskraft as rights holder;
- applicable Taskraft–TES licence identifier and version;
- permitted purposes, users, products, territories and clients;
- prohibited onward disclosure or redistribution;
- retention, termination and return/deletion obligations.

Every accepted legacy store receives a stable `legacyEstateId` and lineage back to its original source row.

### 5.2 Ownership/provenance classes

| Classification | Commercial boundary |
| --- | --- |
| `TASKRAFT_LEGACY_LICENSED` | Present in the ring-fenced snapshot; owned/controlled by Taskraft and used by TES under licence. |
| `TES_NATIVE_DISCOVERY` | Newly captured outlet not matched to the legacy estate; TES-owned subject to project/client/privacy terms. |
| `LEGACY_STORE_UPDATE` | New observation about a Taskraft legacy outlet; original identity remains legacy and the licence must define rights in enhancements/derived attributes. |
| `CLIENT_PROVIDED` | Supplied by a client and governed by that client's agreement. |
| `THIRD_PARTY_REFERENCE` | Provider/map/reference data; usage governed by provider terms and not silently converted into owned outlet IP. |

The source/provenance classification must be server-controlled and immutable through ordinary UI editing.

### 5.3 Matching before declaring TES ownership

A new capture must not become `TES_NATIVE_DISCOVERY` solely because the name differs. Store identity resolution must consider:

- geographic proximity and entrance/location tolerance;
- current, previous and alternate names;
- phone/contact signals where legally and contractually allowed;
- address and locality;
- chain/banner and trading characteristics;
- photos or storefront evidence;
- capture and verification history;
- explicit human merge/link decisions.

Possible matches enter a review queue. A changed store name at the same location may be an update to a legacy store, a replacement business at an existing site, or a truly new outlet. Those outcomes must remain distinguishable.

## 6. When the 90,000-store estate should be loaded

Work should start **now as a parallel data programme**, while the next map-geometry and dashboard slice continues. The full production load should occur only after provenance, identity and access controls are tested.

| Phase | Indicative duration | Exit condition |
| --- | ---: | --- |
| 0. Rights and source freeze | 1 week | Approved licence schedule, immutable snapshot, file manifest and data dictionary |
| 1. Profile and standardise | 2–3 weeks | Names, addresses, phones, categories, coordinates and captured attributes profiled and normalised in staging |
| 2. Resolve identity and geospatial quality | 1–2 weeks | Duplicate clusters, invalid coordinates, name variants and confidence scores produced; exceptions queued |
| 3. Regional pilot | 1 week | 5,000–10,000 representative records loaded; map search, permissions and matching validated |
| 4. Controlled full load | 1–2 weeks | Remaining accepted records loaded in auditable batches with reconciliation totals |
| 5. Ongoing stewardship | continuous | New captures matched, reviewed, classified and quality-monitored |

A realistic first full controlled load is approximately **5–8 weeks from receiving the final source files and agreed licence schedule**, depending on coordinate quality, duplicate rates and manual-review volume.

This programme should not block continued Store Coverage development, but Explore Mode and automatic existing-store suggestions should not be represented as production-ready until the pilot succeeds.

## 7. Data processing rules

The ingestion pipeline must be repeatable and auditable:

1. land source files in a restricted raw zone;
2. validate schema, hashes and row counts;
3. standardise text, phone formats, province/locality, brands, categories, units and prices;
4. validate and repair coordinates without overwriting raw coordinates;
5. generate deterministic candidate duplicates;
6. score spatial and attribute similarity;
7. auto-link only above a conservative threshold;
8. send ambiguous records to review;
9. load canonical outlets and preserve source lineage;
10. reconcile source, rejected, merged and loaded totals;
11. build spatial and faceted search indexes;
12. monitor data freshness and quality.

Cleaning must never erase the supplied value. Canonical values and raw source values coexist.

## 8. Platform implications

Firestore can continue to support the present development checkpoint, but 90,000 outlets with geographic, temporal and multi-field faceted exploration strengthens the case for the planned TES geospatial core using PostgreSQL/PostGIS and an appropriate search index.

The browser must not download the full outlet estate. All map queries must be server-authorised, viewport bounded, filter bounded, paginated/clustered and rights aware.

Summary tiles, heatmaps and pitch views must be derived from the same filtered query as the map.

## 9. Security and commercial guardrails

- Taskraft legacy records cannot be reclassified as TES-native by a normal edit or re-import.
- TES-native status requires negative matching against the licensed estate plus confidence/review rules.
- Row-level exports require explicit permission and data-right checks.
- Project membership alone does not grant rights to the complete legacy estate.
- Client users see only permitted projects, attributes, aggregates and outlet records.
- Pitch views default to aggregation and masking.
- Search logs and exports are audited.
- Personal information is minimised and protected under applicable privacy obligations.
- The licence must define rights in corrections, enhancements, derived insights, model outputs and merged records—not only the original rows.
- Final licence and privacy wording requires appropriate South African legal review.

## 10. Acceptance criteria

- A user can search current and previous outlet names.
- Map-place results are visually distinct from Survey Guru outlets.
- Project, team, store, coverage and questionnaire filters can be combined.
- Results respect workspace, role, project and data-right authorisation.
- Taskraft legacy, TES-native, client-provided and third-party records remain distinguishable.
- A renamed legacy store is not incorrectly counted as a newly owned TES outlet.
- Data freshness, evidence and verification state are visible.
- Explore Mode can show market strengths, weaknesses, gaps and opportunities without exposing unauthorised raw data.
- Import batches reconcile exactly and retain source lineage.
- The regional pilot passes search, mapping, deduplication, security and ownership-boundary tests before full load.
