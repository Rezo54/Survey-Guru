# Survey Guru Security Model & Role Architecture v1.0

**Product Owner:** TES — Task Expert Systems  
**Initial Operational Environment:** Taskraft (Pty) Ltd  
**Status:** Approved Baseline / Living Document  
**Version:** 1.0

## 1. Non-Negotiable Security Principle

> **The UI is never an access-control or security boundary.**

Hiding a button, menu, page, field or route is UX only. Every protected read, write, update, delete, upload, download, export, AI action and administrative operation must be independently authorised by trusted API/backend/database controls.

A user who bypasses or manipulates the frontend, directly calls an endpoint, changes client-side state or crafts a database request must gain **zero additional authority**.

Survey Guru therefore follows **deny by default** and **least privilege**.

## 2. Authorisation Chain

Every sensitive request must resolve:

**Identity → Organisation → Workspace Membership → Permission/Role → Project/Assignment Scope → Data Domain → Data-Rights Classification → Requested Action → ALLOW/DENY**

Failure at any required layer denies the request.

## 3. Security Domains

### TES Platform Domain
Identity, organisations, memberships, product/system configuration and platform administration.

### Workspace / Client Domain
Projects, assignments, visits, responses, client observations, evidence and reporting.

### TES Market Universe
Permanent permitted outlet/reference/geographic/coverage and future opportunity intelligence. This domain has a separate permission layer and represents TES IP.

## 4. Platform Roles

### TES Super Administrator
Highest platform administration authority. Administrative authority does not automatically mean unrestricted access to all client-confidential data.

### TES Platform Administrator
Day-to-day provisioning/support/platform administration without unrestricted security authority or arbitrary access to restricted client data.

## 5. Organisation Roles

### Organisation Administrator
Manages permitted organisation users/settings and personnel allocation. Does not automatically gain access to every client workspace associated with the organisation.

### Organisation User
Basic organisation membership. Operational access is granted primarily through explicit workspace membership.

## 6. Workspace / Project Roles

### Workspace Administrator
Manages permitted workspace users, configuration, projects, project access and operational reporting.

### Project Manager
Manages allocated projects, territories, assignments, field workers, progress and permitted reporting.

### QA / Validator
Reviews visits/evidence, validates or rejects submissions, requests corrections and resolves permitted data-quality issues.

### Analyst
Reads permitted project data, analytics and reports and exports only where explicitly permitted. Cannot alter field submissions.

### Client Viewer
Reads specifically authorised dashboards/maps/reports/accepted results. Cannot manage Taskraft operations, modify field data, access other clients or access TES proprietary Market Universe intelligence unless separately licensed/authorised.

### Field Worker
Reads only required assignments/targets/survey definitions and creates/updates their permitted visits, responses and evidence. Does not browse the entire project dataset by default.

## 7. Permission-Based Authorisation

Roles resolve to explicit permissions rather than role names being hard-coded throughout application logic.

Example Project Manager permissions:

- `project.read`
- `project.update`
- `assignment.create`
- `assignment.update`
- `fieldworker.assign`
- `visit.read`
- `dashboard.read`
- `report.generate`

Example Field Worker permissions:

- `assignment.read_own`
- `visit.create`
- `visit.update_own`
- `response.create`
- `response.update_own`
- `evidence.upload`

## 8. Assignment-Level Security

Field workers receive minimum assignment-scoped data. Offline or online clients must not receive the whole project dataset merely because a user participates in the project.

## 9. TES Market Universe Permissions

Market intelligence requires explicit capabilities, e.g.:

- `market.outlet.lookup`
- `market.outlet.createCandidate`
- `market.outlet.verify`
- `market.outlet.merge`
- `market.coverage.view`
- `market.coverage.manage`
- `market.intelligence.view`
- `market.intelligence.export`
- `market.admin`

Taskraft or client access to Survey Guru functionality does not imply unrestricted export/access to TES Market Universe IP.

## 10. Client Isolation

Client/workspace isolation must be enforced by trusted backend/database controls, not frontend query filters. A frontend defect requesting unauthorised workspace data must receive a denial rather than data that the UI is expected to hide.

## 11. API-First Authorisation Requirement

Protected application functionality must be exposed through controlled service/API operations or equally trusted database-side enforcement.

Sensitive operations such as role/membership changes, exports, bulk operations, outlet promotion/merge, rights changes and AI processing of restricted information require independent server-side authorisation.

The server must validate authority from trusted identity/session context. It must not trust client-supplied role, organisation, workspace ownership, permission or data-right claims.

## 12. Evidence Security

Evidence follows workspace/project/data-right authorisation. Object-storage URLs must not become public access mechanisms. Access requires authenticated and authorised retrieval or appropriately short-lived controlled access.

## 13. Location Security

Outlet location, visit location and field-worker location are separate data classes. Field-worker movement data requires purpose limitation, minimum necessary granularity, project/working context, retention controls and restricted access.

## 14. Export Security

Viewing data does not imply export rights. Separate permissions should cover report viewing/generation and underlying data/evidence/market exports.

## 15. Audit Events

Security-sensitive actions must be append-oriented and auditable, including authentication events, denied access, invitations, role/membership changes, project access, exports, visit reopening, post-submission edits, QA overrides, outlet merges, Market Universe promotion, rights changes, bulk downloads and API/service credential lifecycle.

## 16. Authentication

Initial administrative/client authentication may use Firebase Authentication or an approved identity provider. Privileged accounts should support/require MFA according to role. Session expiry, account disablement, reset and brute-force/rate controls are required.

MFA is mandatory for TES privileged administrators and should be mandatory for high-privilege operational administrators.

## 17. Device and Offline Security

Future controls may include registered/revocable devices, unusual-device detection, application-version enforcement and remote session invalidation.

Offline mode caches only minimum assignment data required for work. Protected offline data must be encrypted appropriately and synchronised through authorised APIs when connectivity returns.

## 18. API / Integration Security

Human, integration and service identities use authentication plus explicit scopes and workspace/data-right checks. API access never bypasses human-equivalent data boundaries.

## 19. AI / Service Identity Security

AI agents are identities with minimum function-specific permissions. An AI QA agent receives only the data/actions necessary for QA; a reporting agent receives only permitted project/report data.

> **AI agents receive the minimum data and action permissions necessary for their specific function.**

## 20. Autonomous Agent Principle

> **No autonomous agent receives simultaneous authority over code, production credentials and deployment.**

This is a formal TES development/security rule.

## 21. Environment Separation

Development, Staging/Test and Production use separated data stores, credentials, storage, service identities and security configuration where appropriate. Real customer data is not casually copied into development; synthetic/test data is the default.

## 22. Secrets

Firebase Admin credentials, API secrets, AI-provider secrets, client credentials, signing secrets and equivalent sensitive values are prohibited from source control. Secrets use approved environment/secret-management facilities.

## 23. Break-Glass Access

Future emergency elevated access should require explicit reason, elevated authorisation, limited duration, audit recording and automatic expiry rather than silent universal administrator access.

## 24. Backend Authority Principle

> **The backend determines authority. The UI improves usability.**

Security tests must include direct endpoint/API calls that deliberately bypass UI restrictions and verify denial.

## 25. Mandatory Security Acceptance Tests

Before production release, tests must prove at minimum:

1. Unauthenticated requests cannot access protected data/actions.
2. A valid user cannot access another workspace by changing IDs.
3. A field worker cannot enumerate or retrieve unassigned project data.
4. A client cannot access another client's workspace.
5. UI manipulation cannot elevate permissions.
6. Client-supplied roles/permissions are ignored as authority.
7. Read access does not imply export access.
8. Workspace access does not imply TES Market Universe export access.
9. Direct object-storage access cannot bypass evidence authorisation.
10. Revoked memberships/sessions lose access as designed.
11. AI/service identities cannot exceed their scopes.
12. Data-right boundaries block unauthorised promotion into TES Market Universe.
13. Privileged actions create audit events.

## 26. Firebase Implementation Direction

The forthcoming Firebase Collection Specification must be designed around this security model. Collection layout and denormalised security fields must support efficient server-side authorisation and strict workspace isolation.

Direct broad browser access to protected Firestore collections must not become the application's trust model. Where direct Firebase client access is used for narrowly defined functionality, Firestore/Storage Security Rules must independently enforce the same restrictions; UI checks are never sufficient.

---

This is a living TES security architecture document. Any implementation that conflicts with the non-negotiable API/backend authority principle must be treated as a security defect.