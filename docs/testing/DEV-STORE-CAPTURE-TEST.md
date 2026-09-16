# Development store-capture test

This test exercises the new assignment-scoped questionnaire and photo flow. It creates development Firestore and Storage records. It does not verify a store, mark it ready for export or send it to Premier/another third party.

## Prerequisites

- Pull `agent/local-test-checkpoint`.
- Keep the existing Firebase Admin and web Firebase values in their respective `.env.local` files.
- Add `FIREBASE_STORAGE_BUCKET` to `apps/api/.env.local`. Use the exact same bucket value as `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` in `apps/web/.env.local`.
- Firebase Storage must be enabled for the development project.
- The signed-in development capturer must be allowed to upload an image only beneath `workspaces/{workspaceId}/projects/{projectId}/captures/{captureId}/`. Do not temporarily open the whole bucket for testing.
- Run the existing development bootstrap so the user has the active Soweto assignment.

## Start locally

From the repository root, use two PowerShell windows:

```powershell
npm run dev --workspace @survey-guru/api
```

```powershell
npm run dev --workspace @survey-guru/web
```

Sign in, open the authorised field map/session, and choose **Capture a store**.

## Happy path

1. Enter a store name and owner/contact.
2. Enter comma-separated brands, one observed product, its price and estimated monthly volume.
3. Choose **Use current store location** and confirm the accuracy message appears.
4. Take or select a storefront image.
5. Choose **Submit store for verification**.

Expected result:

- the page confirms **Store submitted**;
- one `storeCaptures` document exists with the current workspace, project, assignment and capturer IDs;
- its status is `SUBMITTED`, not `VERIFIED` or `READY_FOR_EXPORT`;
- the photo object is under that capture's authorised Storage path;
- the object has SHA-256 custom metadata matching the capture photo metadata;
- returning to the coverage map does not change any street merely because a store was submitted.

## Guardrail checks

- Omit location: submission stays on the form with a clear message.
- Omit the photo: submission stays on the form.
- Remove a required questionnaire value: browser validation blocks submission.
- Set an incorrect API bucket: the draft may be saved, but final submission is rejected because the photo cannot be verified.
- Attempt a capture ID belonging to another user or assignment: the API returns forbidden.
- Confirm there is no Premier/third-party delivery. Only `READY_FOR_EXPORT` and `SYNCED` are publishable states, and this form stops at `SUBMITTED`.

## Deliberately not in this checkpoint

- reviewer screens and QA decisions;
- same-location existing-store candidate selection in the UI (the tested domain matcher is present, but the search endpoint/UI is a later slice);
- configurable questionnaire-builder UI;
- offline photo upload retry;
- historical Taskraft store import, cleaning or ownership reclassification.
