# Survey Guru DEV Project Street Coverage Checkpoint

**Owner:** TES — Task Expert Systems  
**Environment:** Development only  
**Status:** Implemented boundary, DEV GIS candidate adapter, idempotent transaction service and accepted-movement orchestration  
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

## Transactional persistence boundary

The DEV reconciliation service now enforces the evidence order before persistence:

1. both movement points must already be accepted;
2. both points must meet the active GPS-accuracy policy;
3. timestamps must be chronological and within the continuity-gap policy;
4. GIS candidates are generated;
5. the conservative resolver produces `MATCHED`, `AMBIGUOUS` or `NO_MATCH`;
6. the complete map-match evidence record is written;
7. a street contribution is written only for `MATCHED`.

The map-match evidence and optional contribution are created in one Firestore transaction. Deterministic evidence/contribution IDs make retry idempotent; an existing evidence record returns `ALREADY_EXISTS` rather than adding duplicate street distance.

## Accepted movement orchestration

The movement endpoint now connects accepted movement evidence to the reconciliation service:

- the first accepted point is stored as `AWAITING_NEXT_POINT`;
- the next accepted point forms the candidate traversal;
- rejected points cannot become the previous-point anchor;
- the active search-session coverage policy is resolved server-side;
- eligible project street geometry and prior matched-segment continuity are resolved server-side;
- the movement event records the resulting match status and evidence reference;
- a reconciliation failure leaves the event as `RETRY_REQUIRED` rather than pretending coverage succeeded.

New search sessions now retain their assignment coverage-policy ID. Shared coverage reads use project-scoped queries followed by server-side workspace/status checks, reducing DEV composite-index friction without weakening the authorisation boundary.

## Still deliberately excluded

- live map polling/subscription;
- authoritative update of `searchedKm`;
- production deployment or production data changes.

Until the GIS adapter generates candidates and persists auditable match evidence, movement capture still cannot change authoritative coverage.

## Verification

- API strict TypeScript typecheck passes.
- Sixteen executable tests pass for clear matching, project eligibility, generated GIS candidates, parallel-street ambiguity, side-street rejection, retained candidate evidence, continuity-gap refusal, deterministic reconciliation, contribution suppression for ambiguity, prior-segment continuity, topology parsing, cross-capturer interval union, red/amber/green states and stale-algorithm exclusion.

## Next slice

Connect the field map to the authorised shared project street-coverage endpoint and refresh it after accepted evidence synchronises. The UI must render the returned server state and must not infer colour from the local GPS trace.

---

This is living TES architecture documentation. Material coverage, map-matching, access, privacy or GIS changes must be version-controlled here and in the governing architecture specifications.
