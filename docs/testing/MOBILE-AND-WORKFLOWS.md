# Mobile tracking and workflow checkpoint

## Web testing

Run the API and web app with the existing Firebase configuration and HTTPS URLs. Open `/sign-in`, then an active Field Today assignment. Start tracking, disable the network while keeping the screen visible, walk, reconnect, and confirm pending locations return to zero. Only server-matched evidence changes street coverage. A temporary GPS timeout continues waiting for a fix. Browser tracking pauses when hidden.

Locations are stored in IndexedDB, scoped by account and search session. Unacknowledged points retain their event IDs. The server accepts delayed points for seven days, serialises session updates in a transaction, and does not increment counters twice. Invalid points remain visible as a blocked queue. Unassignment closes the search session and prevents later uploads; evidence remains on the device for administrative resolution.

## Android and iPhone setup

The existing `apps/android` workspace now contains dependencies for both platforms. It loads the dynamic Next.js app from a configured HTTPS origin; it is not a fully offline bundled app. Use a stable hostname rather than an expiring quick-tunnel address, because browser storage belongs to that origin.

From `apps/android`:

```powershell
$env:SURVEY_GURU_MOBILE_WEB_URL = 'https://YOUR-STABLE-WEB-HOST'
npx cap add android
node configure-platforms.cjs
npx cap sync android
npx cap open android
```

On macOS with Xcode and signing configured, use `npx cap add ios`, run `node configure-platforms.cjs`, then `npx cap sync ios` and `npx cap open ios`. Do not add a platform twice. Never commit credentials or signing material. Permit the mobile/web origin in Firebase Authentication and the API's CORS configuration.

The Start background tracking button appears only in an installed build with the GPS plugin available. It requests location and notification permissions. A persistent status banner provides Stop tracking even after navigating to capture a store. The mobile queue uses native HTTP for upload so Android WebView HTTP throttling does not stop syncing.

**Device validation is required.** The version-pinned native journal extension writes each fix into app-private disk storage before invoking the web callback. Pending files survive web suspension and app restart; only acknowledged events are deleted. Upload resumes when the bridge is available. The journal stops collecting on storage failure and retains evidence. It is limited to 65,000 pending files; sync regularly. It does not promise continued GPS collection after process termination; iOS force-quit stops location updates.

`npm install` applies `apps/android/apply-journal.cjs` through the root postinstall hook. If lifecycle scripts were disabled, run this script explicitly before `cap sync`. It patches only plugin 8.4.6 and refuses another version. Android and Swift native sources are included under `apps/android/journal`; review and rebuild the patch before upgrading the GPS plugin. No credentials are stored in the journal.

Test locked-screen walking for 20 minutes, airplane mode, reconnection, token expiry, permission removal, store capture navigation, sign-out, app termination and battery-saving modes on both platforms before field deployment. Android SDK and Xcode compilation have not been performed in this Windows workspace. The Capacitor CLI also encounters this sandbox's `uv_os_get_passwd ENOMEM` error before platform generation; run the platform setup on your normal development terminal.
References: https://github.com/Cap-go/capacitor-background-geolocation and https://capacitorjs.com/docs . Dependency pinned to 8.4.6 with Capacitor 8.4.1.

## Roles and areas

Super administrators use `/settings/roles` to activate registered users with Field Worker, Supervisor, QA, Analyst or a custom workspace role. Registration does not grant business access. Platform administrator privilege cannot be granted by a custom role. Existing platform administrators are retained.

Administrators use `/operations` to create named work areas and assign field agents or supervisors. Work areas use the parent project's boundary in this checkpoint; they do not yet define independent sub-polygons. Create separate bounded projects for separate geographic areas. Unassign preserves history and closes associated sessions. Supervisors submit assigned areas with a note; QA accepts or returns submitted areas. Area acceptance is a review workflow and does not fabricate verified street coverage.

QA can select any active workspace project and view all submitted customers, exception records and rejected records. Insights use the selected project and work area; demo content lives only under `/demo`.

## Consultation email

The server-side web route supports Resend. Configure in `apps/web/.env.local` (or production secret settings):

```dotenv
RESEND_API_KEY=YOUR_SERVER_SECRET
SURVEY_GURU_CONSULTATION_FROM=Survey Guru <YOUR-VERIFIED-SENDER>
SURVEY_GURU_CONSULTATION_TO=admin@taskraft.org
```

Later change the recipient to `admin@surveyguru.ai`. The sender domain must be verified with Resend. These values must never use a NEXT_PUBLIC prefix. Without configuration, the form clearly reports unavailability and offers direct email. No live test email has been sent. Requests are validated, use provider idempotency keys and a basic process-local rate limit; add gateway rate limiting before a multi-instance public rollout.
