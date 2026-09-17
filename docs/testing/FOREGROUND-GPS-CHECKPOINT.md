# Foreground GPS tracking checkpoint

Base: `2a9cd2cf3a52d46c686117fd6f352658084f6186`, branch `agent/local-test-checkpoint`.

The authorised field map now provides Start foreground tracking / Stop tracking.
An active server search session and explicit user action are required. The client
uses a high-accuracy browser watch and submits at most once every ten seconds,
with only one upload in flight. Fixes older than thirty seconds are ignored.
The existing API remains responsible for identity, assignment, accuracy,
duplicate/speed validation, matching and shared coverage.

Hiding the page, going offline, leaving the page, changing sessions or receiving
a GPS/upload error stops collection. Resuming requires another explicit start.
Late callbacks are ignored and pending requests are aborted during cleanup.
An already received request may still finish on the server after Stop.
GPS Stop does not transition the persisted search session.

This checkpoint requires a visible page, unlocked screen, location permission,
secure browser context and internet access. It does not provide durable offline
queueing or native Android background tracking. Failed POSTs are not retried
automatically because the existing ingestion contract has no idempotency key.

## Validation

- `npm run typecheck`
- `npm test --workspace @survey-guru/api`
- `node --import tsx --test apps/web/test/foreground-tracker.test.ts`
- `npm run build`

In the Codex Windows sandbox, `tsx` failed during OS account lookup before tests
could execute. The same test sources were transformed with Node 24's
`stripTypeScriptTypes` and executed with `node --test`: 52 API tests and 5
foreground tracker tests passed. Type checks and the production build passed.

## Device verification before rollout

Use a DEV assignment on an HTTPS origin or localhost. Start the search, start
tracking, grant location permission, then move along an eligible street. Verify
recent progress, evidence counts and server-confirmed map coverage refresh.
Verify Stop prevents further uploads; hiding the page and reconnecting do not
silently resume tracking. Check permission denial, weak GPS, network loss and
session navigation. These real-device and authenticated integration checks have
not been run in this checkpoint environment.
