# Development checkpoint: road geometry, partial coverage, and dashboard map

Date: 2026-09-16  
Branch: `agent/local-test-checkpoint`  
Status: next autonomous implementation slice  
Production deployment: none  
Main branch: untouched

## Milestone accepted

The local development checkpoint successfully demonstrated:

- Google Maps rendering with the configured local browser key.
- A visible project boundary that prevents silent project-scope creep.
- Server-derived project street coverage shared between authorised capturers.
- Matched movement changing project coverage.
- Movement outside assigned project streets producing no coverage.
- Weak-GPS, duplicate, and too-fast movement rejection.
- Coverage deduplication when multiple capturers traverse the same project street.
- Identity-scoped raw evidence with project-scoped aggregate coverage.
- Two capturers contributing to the same shared project result.
- Existing API map-matching tests passing and web typecheck/build verification passing.

This is a useful development milestone. The current straight, thick line rendering is a demonstrator, not final street geometry.

## Product decisions locked by field testing

### Project boundary remains visible

The project polygon remains visible on operational map views. It communicates the authorised survey area and makes project creep obvious.

The server remains the authority for scope. A client-rendered polygon is not permission to accept evidence outside the configured project area or eligible project streets.

A future project-setup workflow may allow authorised managers to draw or edit the polygon. Saved boundaries must be versioned, validated and auditable.

### Coverage colours apply to geometry intervals

Coverage colour must be derived from server-confirmed intervals along a project street, not applied blindly to the entire street feature.

| Interval state | Colour | Meaning |
| --- | --- | --- |
| Confirmed walked | Green | Accepted evidence has been map-matched and contributes to shared project coverage. |
| Unwalked | Red | The eligible part of the project street remains outstanding. |
| Uncertain or pending | Amber | Evidence exists for this interval but has not become confirmed coverage. |

For a partly walked street, only the confirmed portion up to the last accepted walked point is green. The remaining unwalked portion stays red. Amber is reserved for an actual uncertain or pending interval; it is not a blanket colour for the whole partially covered street.

Multiple accepted intervals may exist on one street. They must be unioned project-wide so overlapping work by two capturers is not counted twice.

### Lines follow streets and remain legible

Coverage strokes must follow the detailed project street centreline. Straight endpoint chords that cut across neighbourhoods are not acceptable final geometry.

Google Maps supplies the basemap but must not be treated as an extractable authoritative street dataset. Project street geometry must come from an explicit, licensed or project-provided GIS source and retain source and version metadata.

Default line weight should be visually subordinate to road labels and surrounding context. Use a thin operational stroke (approximately 4 px at normal zoom), with a limited hover or selection increase. Width may be zoom-responsive, but must not obscure the underlying road.

## Required architecture

### Canonical street geometry

`ProjectStreetSegment` must retain a detailed ordered polyline rather than only coarse endpoints.

The geometry record must include enough metadata to reproduce and audit it:

- project and street-segment identity;
- ordered coordinates in a declared coordinate system;
- source/provider identity;
- source feature identity where available;
- source/import version;
- effective version and timestamps;
- eligibility and project-scope association;
- topology links used by sequence-aware map matching.

The same canonical geometry must be used for candidate generation, map-matching distance calculations, coverage interval derivation and map rendering. Rendering geometry and matching geometry must not drift apart.

### Along-line coverage intervals

A street contribution must identify its position along the canonical polyline, preferably as normalised start/end offsets or measured metres from the segment origin.

The server must:

1. project accepted traversal endpoints onto the canonical polyline;
2. create confirmed contribution intervals only for `MATCHED` outcomes;
3. union overlapping confirmed intervals across authorised project contributors;
4. retain uncertain evidence separately with zero confirmed contribution;
5. subtract confirmed intervals from the eligible street to produce outstanding intervals;
6. return render-ready geometry slices with explicit state and algorithm/geometry versions.

A geometry-version change must not silently apply old offsets to incompatible geometry. Reconciliation or invalidation must be explicit.

### One shared map contract

Field, project and dashboard views must consume a common server-owned map contract containing:

- project identity and boundary geometry;
- versioned street geometry slices;
- explicit `CONFIRMED`, `UNCERTAIN` and `OUTSTANDING` states;
- project-level summary counts and distances;
- refresh/version metadata.

The UI should use a shared Google Maps renderer with role-appropriate controls rather than three independent implementations.

Raw capturer evidence remains identity scoped. Only authorised project-level derived coverage is shared.

## Dashboard requirement

The dashboard's illustrative grid map must be replaced by the same live Google Maps-based project coverage renderer used by operational views.

The dashboard map must:

- show the project polygon;
- render road-following green, amber and red geometry slices;
- use server-derived live summary values;
- avoid hard-coded or illustrative coverage claims;
- provide a clear route to the full project map;
- preserve management context such as coverage gaps and QA signals;
- degrade honestly when the Google key, network or geometry is unavailable.

The dashboard may use a simplified interaction mode, but it must not use a different truth source.

## Implementation sequence

1. Extend the project street data model and API contract for detailed, versioned road geometry.
2. Add tested along-line projection, slicing, interval union and outstanding-remainder derivation.
3. Return render-ready coverage slices from the server.
4. Refactor the existing project and field maps onto a reusable renderer.
5. reduce line weights and retain the project boundary on all operational views.
6. Replace the dashboard illustration with the shared live map renderer.
7. Add failure, loading and unavailable-key states without presenting illustrative data as live.
8. Run API tests, web typecheck and web production build.

## Acceptance checks

- At useful zoom levels, coverage strokes align with the intended road centreline and do not cut across unrelated blocks.
- Normal strokes are thin enough that road names and intersections remain readable.
- A partially walked street is visibly split: confirmed geometry is green and its outstanding remainder is red.
- Uncertain evidence can be amber without increasing confirmed coverage.
- Disconnected confirmed intervals on one street render independently and union correctly.
- Rewalking an already confirmed interval does not double-count distance.
- Contributions from a second authorised capturer update the same project map.
- Raw movement history remains inaccessible across capturer identities.
- The project polygon remains visible on field, project and dashboard maps.
- Out-of-scope movement creates no coverage.
- The dashboard renders the real map and the same server-derived state as the full project view.
- Existing map-matching and authorisation tests remain green.
- New geometry slicing and version-mismatch tests pass.
- Web typecheck and production build pass.

## Guardrails

- Do not infer road geometry from basemap pixels.
- Do not turn an entire segment green because only part has confirmed evidence.
- Do not allow the client to declare confirmed coverage.
- Do not accept stores or movement outside project scope without a separately authorised exception workflow.
- Do not merge to `main`, deploy, or alter production resources as part of this development checkpoint.
