# Development road geometry import

## Purpose

The current three street fixtures are coarse endpoint demonstrations. They must not be presented as authoritative street geometry.

This opt-in development import obtains detailed OpenStreetMap road polylines inside the server-owned project polygon, preserves provider/version provenance and writes them as eligible development `ProjectStreetSegment` records. The Google map remains the basemap; the imported GIS geometry is the coverage and map-matching source.

The public Overpass service is a development convenience, not a production dependency. Production projects require an approved, licensed and operationally supported GIS import path.

## Preconditions

- Run `npm run bootstrap:dev --workspace @survey-guru/api` after pulling the checkpoint so the project has its versioned boundary.
- Confirm Firebase Admin development credentials are configured.
- Confirm the target project is marked `environment: dev`.
- Understand that disabling the old coarse fixtures will make their old coverage contributions inactive; new movement must match the imported street identifiers.

## PowerShell

```powershell
$env:SURVEY_GURU_GEOMETRY_PROJECT_ID="prj_soweto_retail_universe"
$env:SURVEY_GURU_DEV_OSM_IMPORT_CONFIRMED="IMPORT_DEV_ROADS"
$env:SURVEY_GURU_DISABLE_COARSE_FIXTURES="true"
$env:SURVEY_GURU_MAX_DEV_STREET_SEGMENTS="3000"
npm run import:dev:osm-streets --workspace @survey-guru/api
```

Use a smaller project polygon if the provider returns more than the explicit segment limit. Do not bypass the limit merely to make the command complete; the current API and browser renderer are not yet viewport-paginated.

## Expected result

- Imported lines follow detailed road vertices instead of endpoint chords.
- Imported segments are restricted to runs inside the project polygon.
- Geometry records contain OpenStreetMap way identity and version/timestamp.
- The map displays required OpenStreetMap attribution when those segments are returned.
- The old coarse fixtures are marked ineligible only after a successful import when the explicit flag is enabled.

## Verification

1. Restart the API and web application.
2. Open the project and dashboard maps.
3. Confirm the project boundary remains visible.
4. Confirm road strokes are 4 px and align with the corresponding basemap roads.
5. Confirm no coarse diagonal fixture remains when the disable flag was used.
6. Capture two valid movement points on an imported street.
7. Confirm only the accepted interval becomes green and the remainder remains red.
8. Confirm a second capturer sees the same project-shared result.

OpenStreetMap data is available under the ODbL and requires attribution: https://www.openstreetmap.org/copyright
