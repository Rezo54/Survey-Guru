# Survey Guru DEV Project Street Coverage Checkpoint

**Owner:** TES — Task Expert Systems  
**Environment:** Development only  
**Status:** Implemented boundary and DEV GIS candidate adapter; transactional persistence still pending  
**Date:** 16 September 2026

## Purpose

Establish the first executable boundary between candidate traversal and project-owned street coverage without allowing raw GPS proximity to paint streets as complete.

## Street display contract

The map renders the geometry of each eligible `ProjectStreetSegment` as the paintable unit:

- `UNCOVERED` → red;
- `PARTIALLY_COVERED` → amber;
- `COVERED` or `VERIFIED` → green.

The colour is server-derived. The UI does not infer coverage from a local GPS trace, accuracy circle or current capturer.

## Project-owned shared state

Street coverage belongs to the project rather than an individual capturer.

An authorised user with `coverage.read` and project scope receives the same project street coverage read model regardless of which capturer supplied the accepted evidence. Raw worker movement remains independently protected and is not included in the shared map response.

Two capturers walking overlapping portions of the same segment add evidence to the same project segment. Overlapping intervals are unioned and do not double-count coverage or searched kilometres.

## Map-match outcomes

The map-matching boundary returns exactly one of:

- `MATCHED` — one eligible project street passes the safeguards and may create a contribution;
- `AMBIGUOUS` — competing candidates are too similar, including plausible parallel-street cases;
- `NO_MATCH` — no eligible candidate passes project, distance, direction and sequence-continuity rules.

`AMBIGUOUS` and `NO_MATCH` create zero street coverage contribution.

## Safeguards implemented

- workspace and project eligibility filtering;
- maximum lateral-distance threshold;
- maximum heading-difference threshold;
- minimum sequence-continuity score;
- connection-to-previous-segment requirement when changing segments;
- ambiguity gap between the best and competing street;
- source and source-version provenance on `ProjectStreetSegment`;
- algorithm and coverage-policy versions on each contribution;
- stale-version contributions excluded from the current read model;
- unique interval union per project street segment;
- server-derived red, amber and green rendering state.

## DEV GIS candidate adapter

The first dependency-free DEV adapter now:

- projects both ends of a candidate traversal onto eligible project street polylines;
- calculates lateral distance in metres;
- compares traversal and street direction without assuming one-way walking;
- calculates projected start/end offsets along the street geometry;
- measures traversal-to-street distance continuity;
- applies explicit segment topology when continuing from a previous street;
- sends every generated candidate to the conservative resolver;
- builds a persistable evidence record containing all considered candidates, the outcome, reason, source movement-event IDs and algorithm/policy versions.

Candidate generation does not itself grant coverage. Only a `MATCHED` resolver outcome can produce a contribution.

## API boundary

`GET /api/v1/projects/:projectId/street-coverage`

The endpoint requires:

- authenticated identity;
- active workspace membership;
- `coverage.read` permission;
- active project scope;
- project/workspace relationship validation.

The response is project-shared (`identityScoped: false`) and contains derived segment geometry/state only. It does not expose raw movement trails or capturer identity.

## Still deliberately excluded

- automatic persistence of `StreetCoverageContribution` from movement;
- transactional persistence of the map-match evidence record;
- live map polling/subscription;
- authoritative update of `searchedKm`;
- production deployment or production data changes.

Until the GIS adapter generates candidates and persists auditable match evidence, movement capture still cannot change authoritative coverage.

## Verification

- API strict TypeScript typecheck passes.
- Eleven executable tests pass for clear matching, project eligibility, generated GIS candidates, parallel-street ambiguity, side-street rejection, retained candidate evidence, cross-capturer interval union, red/amber/green states and stale-algorithm exclusion.

## Next slice

Persist map-match evidence and any accepted street contribution together through an idempotent Firestore transaction. The transaction must refuse continuity gaps, retain ambiguous/no-match records, and only write a contribution for `MATCHED`.

---

This is living TES architecture documentation. Material coverage, map-matching, access, privacy or GIS changes must be version-controlled here and in the governing architecture specifications.
