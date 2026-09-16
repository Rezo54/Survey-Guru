# Survey Guru DEV Street Coverage Test — Tonight

**Branch:** `agent/local-test-checkpoint`  
**Environment:** Firebase DEV and local API/web only  
**Do not:** merge to `main`, deploy, use production credentials or test against customer data

## 1. Preflight

From the Survey Guru repository:

```powershell
git switch agent/local-test-checkpoint
git pull
npm install
npm run typecheck --workspace @survey-guru/api
npm run typecheck --workspace @survey-guru/web
npm test --workspace @survey-guru/api
npm run build --workspace @survey-guru/web
```

Expected:

- API typecheck passes;
- web typecheck passes;
- 16 coverage tests pass;
- `/field/map` is included in a successful Next.js build.

## 2. DEV configuration

Confirm local environment files contain only DEV values and are not committed.

API requirements include:

- `SURVEY_GURU_ENV=dev`;
- Firebase Admin access to the DEV project;
- `SURVEY_GURU_BOOTSTRAP_UID` and `SURVEY_GURU_BOOTSTRAP_EMAIL` for the DEV test user.

Web requirements include:

- Firebase web configuration for the same DEV project;
- `NEXT_PUBLIC_SURVEY_GURU_API_URL=http://127.0.0.1:8080`;
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` restricted for local DEV use.

Run the DEV bootstrap once to ensure the active coverage policy and three sample project street segments exist:

```powershell
npm run bootstrap:dev --workspace @survey-guru/api
```

## 3. Start locally

Terminal 1:

```powershell
npm run dev:api
```

Terminal 2:

```powershell
npm run dev:web
```

Open the local Field Today assignment and enter its Store Coverage Search map. Do not open `/field/map` without its authorised `session` query parameter.

## 4. Shared map baseline

Confirm:

- the Google base map loads;
- project streets are thick and clearly visible;
- the legend shows green = completed, amber = partial/uncertain and red = not walked;
- the initial DEV sample streets are red when no accepted contribution exists;
- the summary counts match the visible project segments;
- no raw capturer trail or other user identity is displayed.

## 5. Movement-to-coverage test

Use real foreground GPS while moving along an eligible DEV street, or Chrome DevTools **Sensors → Location** with controlled DEV coordinates.

Sample first DEV segment:

```text
Start: -26.2515, 27.8148
End:   -26.2442, 27.8351
```

Allow enough elapsed time between the points to avoid the 200 km/h speed-rejection rule, while remaining within the 10-minute continuity window.

1. Start Store Coverage Search.
2. Record the first location.
3. Confirm `ACCEPTED · awaiting next point` and no green street yet.
4. Move/change the sensor to the second coordinate.
5. Record the second location.
6. Confirm the response reports `MATCHED`.
7. Confirm the corresponding street changes to green after the immediate refresh.

## 6. Rejection protection

Record the same or near-identical location again.

Expected:

- event is `REJECTED_DUPLICATE`;
- accepted coverage does not increase;
- no additional street changes colour;
- shared completed distance is not double-counted.

## 7. Shared project visibility

Open the same project in another authorised browser/profile or test device.

Expected:

- the street completed by the first capturer appears green for the second user;
- the update appears within 15 seconds without a manual reload;
- the second user cannot see the first capturer's raw movement trail;
- walking the same section again does not double-count its covered distance.

## 8. Evidence to record

Capture screenshots of:

- the initial red street state;
- first point showing `AWAITING_NEXT_POINT`;
- second point showing `MATCHED`;
- the resulting green street;
- the same green street in the second authorised session;
- a duplicate rejection.

Also record any API error message, browser console error and Firebase document IDs for the affected `movementEvents`, `mapMatchEvidence` and `streetCoverageContributions` records.

## Pass gate

Tonight's DEV test passes only if the matched street becomes shared green, uncertain/rejected evidence contributes zero coverage, duplicate walking is not double-counted, and another authorised project user sees the same project-owned result.
