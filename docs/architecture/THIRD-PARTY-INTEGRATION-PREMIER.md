# 3rd Party Integration
## Premier

**Survey Guru — Future Integration Design Reference**  
**Premier WTS baseline:** Power Apps Sales Survey v2.006

## 1. Purpose

This document preserves the agreed design for integrating Survey Guru with Premier's existing Walk The Streets (WTS) Power Apps workflow. The objective is to remove duplicate field capture while allowing Survey Guru to become the richer outlet, evidence, QA, coverage and intelligence layer.

The target proposition is:

> **Capture once. Validate and enrich in Survey Guru. Synchronise the required information into the client's existing system.**

Survey Guru must retain its own canonical outlet, visit, response, evidence, coverage and QA model. Premier-specific labels, screens and workflow remain an integration/presentation concern and must not become Survey Guru's core data model.

---

## 2. Target Operating Model

```text
Surveyor
   ↓
Survey Guru PWA
   ↓
Critical Store Identity Gate
   ↓
Survey Guru validation / QA
   ↓
Survey Guru visit safely accepted
   ↓
Client Sync Engine
   ↓
Premier WTS Third-Party Interface Adapter
   ↓
Premier WTS / Power Apps
```

A Premier-side failure must never undo, corrupt or delete an accepted Survey Guru record.

---

## 3. Visit Integration Status

Management users must see Survey Guru and Premier delivery states independently.

| Survey Guru | Premier WTS | Meaning |
|---|---|---|
| ✓ Accepted | ✓ Synced | SG record accepted and Premier delivery confirmed |
| ✓ Accepted | ⚠ Pending retry | SG record safe; Premier delivery will retry |
| ✓ Accepted | ✕ Action required | SG record safe; intervention required |
| ✓ Accepted | ⚠ Interface update required | Premier interface changed or expected control cannot be safely resolved |

The field worker must not be required to recapture an accepted Survey Guru visit because Premier was temporarily unavailable or its interface changed.

---

## 4. Premier WTS Current Context

- Premier WTS is implemented in Microsoft Power Apps.
- Each field user receives an account from Premier.
- The observed workflow is authenticated and uses structured data services.
- Premier WTS currently does not include photographs in the WTS capture because photographs were not practically retrievable after capture.
- Survey Guru should therefore retain photographs as persistent evidence while synchronising only the structured data required by Premier.
- Production integration must use a Premier-authorised access path.
- Browser bearer tokens and private/undocumented Power Apps runtime calls must not become unmanaged production dependencies.

---

## 5. Photographic Evidence Advantage

Survey Guru should retain evidence against both the permanent outlet and the specific visit.

- Storefront and other evidence remains retrievable.
- Historical visit evidence is retained rather than overwritten.
- Evidence can be surfaced to authorised management/client viewers.
- Photos do not need to be sent to Premier unless Premier later introduces a supported requirement.

---

## 6. Client Capture Profile

Survey Guru should support a versioned **Client Capture Profile** that can closely follow Premier's familiar WTS sequence, terminology and required questions while storing information in Survey Guru's canonical model.

- **Survey Definition** — what information is collected.
- **Client Capture Profile** — how the client's familiar capture workflow is presented.
- **Canonical Survey Guru Model** — authoritative internal representation.
- **Client Sync Engine** — reliable delivery, retry, idempotency and status.
- **Third-Party Interface Adapter** — how accepted data is delivered into the client system.
- **Integration Update Manager** — versioning, testing, approval, activation and rollback.

---

## 7. Premier WTS v2.006 Reference Workflow

The downloaded screenshot reference pack establishes the following baseline workflow for **Premier WTS v2.006**:

```text
Landing
  ↓
Start a New Survey
  ↓
Branch / Store / Geolocation
  ↓
Select the Survey
  ↓
Business Dev – Walk The Streets
  ↓
Customer & outlet questions
  ↓
Product Capture
  ↓
Submit
  ↓
Walk The Streets confirmation
  ↓
Next
  ↓
GT Price
  ↓
Route
  ↓
Product Price Capture
  ↓
General Comment
  ↓
Submit
  ↓
Landing / staged survey queue
  ↓
Submit Surveys
  ↓
Final Premier delivery
```

A critical finding from v2.006 is that individual survey work appears to be staged before the separate **Submit Surveys** action. The adapter must therefore distinguish between an intermediate/staged Premier state and confirmed final delivery.

---

## 8. Visible v2.006 Screen/Control Reference

### 8.1 Landing

Visible controls/behaviour:

- `Start a New Survey`
- `Submit Surveys`
- pending submission indicator: `There are surveys available to submit`
- visible version: `V2.006`

### 8.2 Branch & Store / Geolocation

- Branch — dropdown, required
- Store Name — text input, required
- Latitude — geolocation, required
- Longitude — geolocation, required
- Continue — navigation

This is the primary interception point for the Survey Guru **Critical Store Identity Gate**.

### 8.3 Survey Selection

Visible choices include:

- Business Dev – Walk the streets
- Business Dev – GT Price
- Business Dev – Sales Initiation (shown disabled in reference)
- Business Dev – Other (shown disabled in reference)

### 8.4 Walk The Streets

Visible captured fields include:

- Customer first name
- Customer last name
- Customer mobile number
- Alternative mobile number
- Does Premier deliver your bread? — Yes/No
- Do you sell bread? — Yes/No
- Is there a Blue-Ribbon branded stand? — Yes/No
- Is there a competitor branded stand? — Yes/No
- Does the owner have more than one shop? — Yes/No
- Do they sell other Premier products? — Yes/No
- Nationality (only an observation) — Foreign/Local

### 8.5 Product Capture

The WTS workflow supports a repeatable product collection:

```text
Product Sales Observation
├── Brand
├── Product: White / Brown
└── Daily sales quantity
```

Visible brand options in the captured v2.006 reference include:

- Sunny Day
- Blue Ribbon Classic
- Albany Superior
- Sasko Premium
- Sunbake Premium
- No Name Brand

The interface supports adding multiple rows plus editing/deleting captured rows. `Total loaves sold` is displayed above the collection.

Survey Guru must model this as a repeatable child collection rather than fixed `bread1`, `bread2`, etc.

### 8.6 Walk The Streets Completion

After WTS submission, Premier displays a confirmation and directs the user to select **Next** to continue to the GT Price survey for the same Branch and Store.

The adapter must preserve the store context across this transition.

### 8.7 GT Price

Visible controls include:

- Route — dropdown, required
- repeatable Product Price Capture

Route identifiers/names are presented in the dropdown. The operational reference indicates the bakery/depot route is normally selected by default. Survey Guru should maintain and validate the relationship between Premier Branch and valid Premier routes rather than blindly selecting a route.

### 8.8 Product Price Capture

Repeatable price observation:

```text
Product Price Observation
├── Brand
├── Product: White / Brown
├── Product type (e.g. 700g)
├── Selling Price
└── Cost Price
```

The interface supports adding, editing and deleting product-price rows.

### 8.9 General Comment / Submit

A General Comment field is shown below captured GT Price rows, followed by Submit.

After this submission the workflow returns to the landing/staging area, where the separate **Submit Surveys** action can finalise pending surveys.

---

## 9. Screenshot-Based Interface Specification

For the proof of concept, screenshots of every Premier WTS page/state form the visual baseline for the interface adapter. For each screen record:

- page name and sequence;
- visible label/question;
- control type;
- required/optional status;
- available choices;
- validation behaviour;
- navigation action;
- Survey Guru canonical mapping;
- safe adapter control/selector strategy;
- Premier interface version;
- screenshot/reference version.

The screenshots document the visible workflow only. They are not authorisation to extract credentials, reuse bearer tokens, or access private Power Apps services.

---

## 10. Proof of Concept

The first POC should remain deliberately narrow:

1. One authorised Premier user account/session.
2. One complete WTS v2.006 workflow.
3. A Premier Client Capture Profile in Survey Guru.
4. One complete field capture in Survey Guru.
5. Survey Guru safely saves/accepts the visit.
6. The Premier adapter populates the authorised Premier WTS session.
7. All repeatable bread/product rows are reproduced.
8. WTS is submitted.
9. GT Price is completed for the same outlet.
10. All repeatable price rows are reproduced.
11. General Comment is reproduced where applicable.
12. The appropriate final `Submit Surveys` step is completed.
13. An unambiguous Premier success state is detected.
14. Survey Guru updates the visit to `Premier WTS: ✓ Synced`.
15. Failure, retry, replay and duplicate-prevention behaviour is tested.

The POC proves:

> A surveyor can capture once in Survey Guru and have the required submission reliably reproduced in the existing authorised Premier WTS environment.

---

## 11. Delivery Methods

The Client Sync Engine must remain delivery-method neutral.

| Method | Position | Notes |
|---|---|---|
| Authorised API/integration endpoint | Preferred long-term | Narrow, auditable server-to-server interface |
| Approved delegated user authentication | Supported | Uses authorised user identity through supported authentication |
| Power Apps UI automation | POC/fallback | Practical for a stable, communicated/versioned interface |
| File/export adapter | Alternative | Useful where a client supports controlled batch import |

A future Premier-supported API should be able to replace UI automation without redesigning Survey Guru's field capture or canonical data model.

---

## 12. Client Sync Engine Requirements

- reliable delivery queue;
- independent Survey Guru and Premier states;
- automatic retry for transient failures;
- idempotency to prevent duplicate Premier submissions;
- immutable Survey Guru correlation/integration IDs;
- attempt history and audit trail;
- safe distinction between retryable and action-required failures;
- replay after adapter/interface updates;
- no client credentials/tokens stored on visit records;
- no client secrets exposed to field browsers/PWAs.

---

## 13. Premier Interface Version Management

Premier communicates version changes and what has changed. Survey Guru should therefore maintain Premier as a managed, versioned third-party interface.

Recommended navigation:

```text
Administration
└── Integrations
    └── Third-Party Interfaces
        └── Premier WTS
            ├── Configuration
            ├── Field Mapping
            ├── User Accounts / External Identity
            ├── Interface Version
            ├── Sync Status
            ├── Update / Test
            ├── Interface Reference Screenshots
            └── Change History
```

Recommended compatibility states:

- Compatible
- Update Required
- Testing
- Incompatible

### Update workflow

1. Premier announces the new WTS version and changes.
2. Create a new adapter/profile version without modifying active production.
3. Store the new screenshot reference pack.
4. Compare it with the previous version screen-by-screen.
5. Update only affected controls/mappings/navigation.
6. Test submissions in a controlled environment/session.
7. Verify resulting Premier records.
8. Approve the new adapter version.
9. Activate it.
10. Retain controlled rollback where technically possible.
11. Replay safely queued submissions after compatibility is restored.

---

## 14. Fail-Safe Behaviour

The adapter must never guess when Premier no longer matches the tested interface version.

If an expected page, question, choice or navigation control cannot be confidently resolved:

```text
Survey Guru: ✓ Accepted
Premier WTS: ⚠ Interface update required
```

The Premier submission stops safely. The Survey Guru visit remains accepted and replayable after the adapter is corrected.

---

## 15. Critical Store Identity Gate

After the POC proves reliable Premier delivery, Survey Guru should introduce intelligence before the Premier submission, starting at Store Identity.

```text
GPS
 ↓
Nearby outlet search
 ↓
Identity / match decision
 ↓
Duplicate and project-history check
 ↓
Continue into survey
```

### Identity signals

- GPS distance to known outlets;
- normalised/similar store name;
- client customer/store reference where available;
- phone/contact information where legitimately collected;
- address/location information;
- previous verified visits;
- historical photographic evidence as supporting evidence;
- field-worker confirmation.

### Decision behaviour

- **Strong match** — prominently suggest existing outlet.
- **Possible match** — require human confirmation.
- **No likely match** — allow creation of a new outlet.
- **Uncertain new outlet** — optionally flag for QA.
- **Never silently merge outlets.** A wrong merge can be more damaging than a duplicate.

---

## 16. Duplicate Visit and Premier Submission Protection

Outlet duplication and duplicate survey submission are separate problems.

Survey Guru should check:

- whether the physical outlet already exists;
- whether it has already been surveyed for the current project/period;
- whether the corresponding visit has already been synchronised to Premier;
- whether a new submission is a legitimate resurvey, QA revisit, correction or anomaly investigation.

Retries must use immutable integration IDs so they do not create duplicate Premier submissions.

---

## 17. Permanent Outlet Identity

Survey Guru maintains a stable outlet identity even where different field workers use different names for the same physical store.

A permanent outlet can contain:

- stable Survey Guru Outlet ID;
- canonical name;
- aliases;
- verified/canonical coordinates;
- client-specific references;
- visit history;
- evidence history;
- Premier synchronisation history.

This is the foundation of the Survey Guru Outlet Universe.

---

## 18. Security and Authorisation Guardrails

- Production integration must operate within Premier-authorised access.
- Possession of a Premier user account does not by itself define permission for programmatic token reuse or automation.
- Do not design production around extracting bearer tokens from browser traffic.
- Do not store bearer tokens on visits or expose them to the Survey Guru PWA/browser.
- Prefer supported authentication and server-side secret handling.
- Do not depend on undocumented private Power Apps runtime endpoints where an approved integration route is available.
- Every integration read/write, configuration change, activation and retry must be authorised and auditable.
- Survey Guru backend/API authorisation remains authoritative; the UI is not a security boundary.
- Third-party integration identities must use least privilege.
- The standing TES principle applies: **No autonomous agent receives simultaneous authority over code, production credentials and deployment.**

---

## 19. Future Generic Third-Party Integration Architecture

Premier should become the first implementation of a generic Survey Guru integration framework:

```text
Client Capture Profile
        ↓
Survey Guru Canonical Capture
        ↓
Critical Store Identity Gate
        ↓
QA / Validation
        ↓
Client Sync Engine
        ↓
Third-Party Interface Adapter
        ↓
Client System
```

This allows future client systems to use API, delegated authentication, UI automation, file transfer or another approved delivery mechanism without contaminating Survey Guru's core domain model.

---

## 20. Product Value

The Premier integration should evolve beyond eliminating duplicate entry. Survey Guru can become an intelligence and quality layer in front of the client's existing system by adding:

- permanent outlet identity;
- duplicate prevention;
- retrievable photographic evidence;
- longitudinal outlet history;
- GPS validation;
- coverage intelligence;
- QA and exception management;
- client-system delivery status and audit;
- future opportunity and gap intelligence.

The Power Apps POC proves the bridge. The Store Identity Gate and permanent Outlet Universe are where Survey Guru begins adding intelligence beyond the system it feeds.

---

## 21. Reference Pack Governance

The current visual baseline is **Premier WTS v2.006**. The working design reference contains screenshots covering the landing page, Branch/Store/GPS, survey selection, Walk The Streets questions, product capture and brand selection, WTS completion, GT Price, route selection, price capture, comment and final staged submission flow.

When repository support for the binary reference pack is added, screenshots should be stored under a versioned path such as:

```text
docs/reference/premier-wts/v2.006/
```

Each future Premier release should receive a separate versioned reference pack rather than overwriting the v2.006 baseline.
