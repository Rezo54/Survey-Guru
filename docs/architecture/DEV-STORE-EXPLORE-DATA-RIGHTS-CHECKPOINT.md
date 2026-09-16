# Store capture, Explore search and data-rights checkpoint

Status: development contract only. This checkpoint does not import the historical store dataset and does not publish records to a third party.

## Why this boundary exists

Survey Guru needs one coherent store identity even when a store changes its trading name. It must also keep the approximately 90,000 Taskraft-sourced stores legally and technically distinguishable from stores newly discovered for TES. A name alone is therefore never the identity key.

## Store identity and capture

- Candidate matching is workspace-scoped and location-first. Name and aliases improve confidence but a changed name at the same location remains a review candidate.
- A capturer works inside an authorised project assignment and submits an observed name, accurate coordinates, questionnaire answers and at least one integrity-checked photograph.
- Selecting an existing store links the observation to that identity; it does not silently overwrite the canonical name, provenance or ownership classification.
- A reviewer can accept a changed trading name as a new alias or make it canonical through a separately audited identity change.

The lifecycle is `DRAFT -> SUBMITTED -> VERIFIED -> READY_FOR_EXPORT -> SYNCED`, with explicit review/rejection paths. `VERIFIED` is not by itself publishable. A Premier or other third-party connector may read only `READY_FOR_EXPORT` and `SYNCED` records.

## Data-rights ringfence

| Classification | Required provenance | Intended treatment |
| --- | --- | --- |
| `TASKRAFT_LICENSED_LEGACY` | Immutable source snapshot ID and licence schedule ID | Licensed use under the Taskraft/TES agreement; never reclassified because it was later revisited |
| `TES_NEW_CAPTURE` | No historical snapshot membership | Newly discovered store outside the ringfenced snapshot |

The historical cleaning/load work must start on a separate work day with the source files and executed licence schedule available. Its first output must be a content-addressed, immutable source snapshot and import manifest. Deduplication, standardisation and geocoding operate from that snapshot and preserve source row lineage. This development checkpoint deliberately contains no historical store rows.

## Explore and map search contract

The Explore view and project map will share a server-side query contract. Filters intersect rather than broaden scope:

- free text across allowed store and questionnaire search fields;
- project and assigned team member;
- walked, not walked and unresolved street coverage;
- store/canonical name and observed aliases;
- brand and product/category;
- volume and price ranges;
- capture/verification status;
- Taskraft licensed legacy versus TES new capture;
- map viewport or project polygon when spatial narrowing is requested.

Every request starts with the authenticated workspace and server-resolved authorised project IDs. A client-supplied project outside that set is rejected, not ignored. Results are cursor-paginated and bounded; detailed questionnaire answers and photo access remain permission-controlled even when a map marker is visible.

## Map behaviour

- The project polygon remains visible to expose scope and prevent project creep.
- Street geometry is rendered below Google road labels.
- Partial streets split by measured offsets: confirmed geometry is green, unresolved evidence amber and outstanding geometry red.
- Coverage is project-owned and shared across capturers; repeated walks add evidence but never duplicate covered metres.
- Dashboard coverage is a summary of authoritative street state. Explore adds store/questionnaire filters without changing that state.

## Next implementation slices

1. Persist capture drafts, questionnaire schema versions, photo metadata and identity candidates.
2. Add reviewer UI for same-location/name-changed decisions and audited identity updates.
3. Implement the authorised Explore query against indexed store observations and flattened filter facets.
4. Add export outbox records with idempotency keys and connector-specific delivery logs.
5. On the separate historical-data work day, create the immutable Taskraft snapshot/import manifest before any cleaning or loading.
