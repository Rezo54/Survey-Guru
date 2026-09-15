# Survey Guru DEV Coverage Engine Checkpoint

**Owner:** TES — Task Expert Systems  
**Environment:** Development only  
**Status:** Active implementation checkpoint  
**Date:** 15 September 2026

## Purpose

Record the implementation boundary between raw Store Coverage Search movement evidence and authoritative geographic coverage.

## Implemented

- PWA foreground GPS capture only while the user explicitly records a location.
- Firebase identity and API-side workspace/project/assignment/session authorisation.
- Persisted raw movement evidence with source and timestamps.
- Conservative point-level quality classification for accuracy, duplicate movement and implausible speed.
- Candidate traversal built only from accepted chronological evidence.
- Continuity gaps excluded from supported candidate traversal.
- Candidate traversal distance is explicitly not searched street distance.
- Project coverage policy is versioned and persisted in DEV.
- Coverage policy resolution is server-owned and rejects missing, cross-project or invalid configuration.

## Locked evidence boundary

The following must remain distinct:

1. **Movement event** — raw observation.
2. **Accepted movement evidence** — observation that passes point-level quality checks.
3. **Candidate traversal** — continuous sequence supported by accepted evidence.
4. **Map-matched traversal** — candidate traversal matched with sufficient confidence to eligible project street/path geometry.
5. **Street coverage contribution** — unique portion of eligible street/path geometry supported by map-matched traversal.
6. **Coverage state** — server-derived state under the versioned project coverage policy.
7. **Verified coverage** — stronger QA/verification state where required.

A GPS point, pair of points, raw path length or proximity to a street must never skip these stages.

## Next implementation slice

Prepare a DEV project street-segment representation and a map-matching boundary that can:

- consider only project-eligible segments;
- retain source/version provenance;
- use sequence continuity rather than nearest-line matching alone;
- protect parallel streets and side streets;
- preserve uncertain/no-match outcomes;
- calculate unique supported geometry rather than summing repeated walking;
- retain algorithm and coverage-policy versions for recalculation.

Until that slice exists, `searchedKm` and authoritative street coverage must remain unchanged by movement capture.

## Mobile capability boundary

PWA foreground location is implemented as evidence capture. Reliable background movement remains an Android/native capability to be implemented separately. Packaging the PWA does not itself prove background tracking.

## Release boundary

All work remains on the development branch. No production Firebase resources, production credentials, deployment or merge to `main` is part of this checkpoint.
