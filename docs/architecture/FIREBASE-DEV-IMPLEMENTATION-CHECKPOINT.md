# Survey Guru Firebase DEV Implementation Checkpoint

**Owner:** TES — Task Expert Systems  
**Environment:** Development only  
**Status:** Implementation checkpoint  
**Date:** 15 September 2026

## Purpose

Move the approved Survey Guru demo flow onto Firebase-backed development infrastructure without weakening the existing API/security boundary.

The Dobsonville West / Cluster 03 demo flow is the reference regression case:

Dashboard → Project Map → Field Today → Field Live Map → Evidence/QA → Verified Coverage → Opportunity Story + Explore.

## Environment boundary

Development and production Firebase projects are separate resources. Active development connects only to the DEV project until a later release decision.

No production Firebase credentials, collections, Storage buckets or rules are used during this phase.

## Authority boundary

The approved MVP persistence rule remains unchanged:

- Firebase Authentication proves identity.
- The Survey Guru API resolves application authority.
- Protected business collections are API-only by default.
- Firebase Admin SDK credentials remain server-only.
- Browser Firebase configuration is limited to client SDK configuration and never grants business authority.
- UI visibility and client state are not security controls.

## Implementation sequence

1. Create/configure the Survey Guru DEV Firebase project.
2. Enable Authentication for the chosen DEV sign-in method.
3. Create DEV Firestore and Storage resources.
4. Add Firebase Admin SDK to `apps/api` and initialise it lazily from server-only environment variables.
5. Add Firebase client initialisation to `apps/web` for authentication only at the first checkpoint.
6. Verify Firebase ID tokens in the API.
7. Resolve user → workspace membership → role/permissions → project/assignment scope in the API.
8. Establish deny-by-default Firestore/Storage rules for normal client business-data access.
9. Seed the Dobsonville reference dataset through a controlled server/dev seed path.
10. Replace hard-coded demo reads progressively with API reads while keeping the accepted demo flow stable.
11. Add authorised writes: search sessions/evidence first, then QA decisions and derived coverage transitions.
12. Run behavioural, authorisation and regression checks before considering any production setup.

## First persistence slice

The first end-to-end data slice should be deliberately small:

- one DEV user;
- one TES development workspace;
- one Soweto Retail Universe project;
- Team 04 / Dobsonville West assignment;
- one search session with representative movement/evidence metadata;
- one QA item;
- one accepted QA outcome;
- one derived verified-coverage record;
- Cluster 03 opportunity read model.

This slice proves the architecture before bulk migration or broad collection implementation.

## Security gates

A Firebase-backed screen is not complete merely because data appears.

For each protected endpoint verify:

1. unauthenticated request denied;
2. valid identity but no workspace membership denied;
3. wrong project/assignment scope denied;
4. insufficient permission denied;
5. authorised request succeeds;
6. client cannot bypass the API with direct Firestore/Storage access;
7. privileged mutation leaves appropriate audit/lineage evidence.

## Current checkpoint

Repository preparation can proceed without credentials. Stop before connecting a real Firebase project and obtain only DEV configuration/credentials. Never commit those values.
