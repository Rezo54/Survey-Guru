# Survey Guru QA & Validation Rules Specification v1.0

**Product Owner:** TES — Task Expert Systems  
**Operational / Field Partner:** Taskraft (Pty) Ltd  
**Status:** MVP Quality-Control Baseline / Living Document  
**Version:** 1.0  
**Date:** 9 September 2026

## 1. Purpose

This specification defines how Survey Guru validates field data and geographic coverage, detects anomalies, routes uncertain records to human review, manages corrections, and produces an auditable quality outcome.

It applies to:

- outlet identity;
- visits;
- survey answers;
- GPS/location;
- photographs/evidence;
- duplicates;
- repeatable product/price data;
- movement/traversal evidence;
- street and area coverage;
- offline synchronisation;
- third-party integration;
- project completion and export readiness.

The governing principle is:

> **Survey Guru should prevent clearly invalid data, explain correctable problems immediately, and route genuine uncertainty to human QA rather than pretending uncertain data is either definitely correct or definitely wrong.**

## 2. Quality Objectives

Survey Guru QA must improve five dimensions of trust:

1. **Identity trust** — are we talking about the correct outlet?
2. **Observation trust** — was the visit/capture credible and complete?
3. **Evidence trust** — do GPS/photos/supporting evidence support the observation?
4. **Coverage trust** — was the claimed geography genuinely searched?
5. **Delivery trust** — is the accepted/exported/client-synchronised result internally consistent and auditable?

## 3. Validation Is Layered

```text
FIELD DEVICE
Immediate UX validation
        |
        v
SURVEY GURU API
Security + structural + business validation
        |
        v
DOMAIN VALIDATION ENGINE
Cross-record / duplicate / spatial / anomaly rules
        |
        v
QA WORKFLOW
Human review where required
        |
        v
ACCEPTED / CORRECTION / REJECTED
```

Client-side validation is for usability only and is never the security or authoritative validation boundary.

## 4. Validation Severity Model

Every rule has one of four primary outcomes.

### BLOCK
The operation cannot proceed until corrected or an authorised exception path is used.

Examples: required answer missing, invalid format, no required photo, impossible server authorisation, duplicate final submission with same immutable ID.

### WARN
The worker may proceed after seeing the warning where project policy permits.

Example: GPS accuracy weaker than preferred but still usable.

### FLAG_FOR_QA
Submission is preserved but cannot become fully accepted without human/authorised review.

Examples: possible duplicate outlet, unusual GPS pattern, uncertain outlet identity, suspiciously short visit.

### INFO
Non-blocking quality information for the worker/supervisor/QA analyst.

## 5. Rule Definition Model

Validation rules should be configuration/version controlled.

```text
ValidationRule
--------------
validationRuleId
ruleCode
name
domain
version
severity
appliesTo
projectScopeOptional
condition/configuration
workerMessage
qaMessage
autoResolutionPolicy
activeFrom
activeTo
createdBy
createdAt
```

Material rule changes create a new version rather than silently changing historical validation meaning.

## 6. Validation Result Model

```text
ValidationResult
----------------
validationResultId
ruleCode
ruleVersion
resourceType
resourceId
projectId
severity
status
observedValueSummary
reason
createdAt
resolvedAt
resolvedBy
resolutionCode
resolutionNotes
```

Results are evidence of the decision process and should not be overwritten without history.

## 7. Validation Domains

Recommended rule domains:

```text
IDENTITY
SURVEY_STRUCTURE
ANSWER
GPS
EVIDENCE
VISIT
DUPLICATE
PRODUCT_PRICE
MOVEMENT
COVERAGE
SYNC
INTEGRATION
SECURITY
PROJECT_COMPLETION
EXPORT
```

## 8. Field Validation Philosophy

Catch simple errors at capture time while the worker is still at the outlet.

Do not wait until evening QA to discover that:

- a required storefront photo is missing;
- a phone number has too few digits;
- a price is impossible;
- a required survey section is blank;
- GPS was never captured.

Immediate correction is cheaper than a revisit.

## 9. Survey Structure Validation

Before a Visit can be submitted:

- correct immutable Survey Version must be attached;
- all required sections applicable under conditional logic must be complete;
- required questions must have answers;
- hidden/non-applicable questions must not be treated as missing;
- repeatable groups must satisfy configured minimum/maximum row rules;
- answer type must match question type;
- required evidence rules must be satisfied.

## 10. Answer Type Validation

Examples:

```text
NUMBER       -> numeric + range/precision rules
PHONE        -> normalized valid configured format
DATE         -> valid date + logical date constraints
YES_NO       -> allowed enum only
SINGLE       -> one allowed option
MULTI        -> allowed options + cardinality rules
TEXT         -> length/content rules where justified
GPS          -> valid coordinate + freshness/accuracy metadata
PHOTO        -> valid linked evidence object
```

The API revalidates even if the device already checked.

## 11. Required vs Conditional Required

A question may be:

```text
OPTIONAL
REQUIRED
CONDITIONALLY_REQUIRED
```

Conditional requirement is evaluated from the immutable survey definition/version, not trusted from UI visibility.

Example:

```text
IF sellsBread = YES
THEN breadProductRows minimum = 1
```

## 12. Cross-Answer Consistency

Rules may compare answers within a Visit.

Examples:

- `sells bread = NO` but bread daily sales > 0;
- `Premier delivers bread = NO` but Premier delivery route selected where incompatible;
- owner has multiple shops = YES but required follow-up omitted;
- total loaves sold materially below/above sum of detailed rows where survey requires reconciliation;
- selling price below zero;
- cost price below zero.

Not every unusual commercial value is wrong. Implausible but possible values should normally be WARN/QA rather than automatically altered.

## 13. Numeric Range Rules

Each numeric question can define:

```text
hardMinimum
hardMaximum
warningMinimum
warningMaximum
precision
unit
```

Hard boundaries block impossible/invalid values. Warning ranges surface unusual but possible observations.

Never silently cap or change the worker's captured value.

## 14. Phone Validation

Phone fields should be normalised into a consistent representation while preserving the captured/original value where useful for audit.

Validation may check:

- digit count;
- configured country rules;
- impossible repeated placeholders where policy requires;
- duplicate customer/contact numbers as a signal, not automatic proof of duplicate outlet.

## 15. Outlet Identity Validation

Every new outlet candidate passes through the Critical Store Identity Gate.

Signals may include:

- spatial distance;
- normalized/similar name;
- client outlet reference;
- phone;
- address/location description;
- historical aliases;
- prior visits;
- storefront evidence;
- branch/project context;
- permitted Market Universe candidates.

Outcome:

```text
NO_LIKELY_MATCH
POSSIBLE_MATCH
STRONG_MATCH
CONFIRMED_EXISTING
CONFIRMED_NEW
```

## 16. Duplicate Outlet Confidence

Duplicate matching must use confidence bands rather than a single destructive yes/no rule.

### High Confidence
Suggest existing outlet strongly; worker/QA follows configured confirmation workflow.

### Medium Confidence
Require explicit human choice/review.

### Low Confidence
Allow new candidate but retain matching evidence for later QA.

**Never silently merge permanent outlet identities.**

## 17. Duplicate Signals Are Not Proof

Examples:

- two stores can have similar names;
- adjacent stores can share a phone/contact;
- one outlet can move location;
- informal addresses can be non-unique;
- GPS can drift;
- franchise names repeat.

Therefore automated matching can recommend, block obvious duplicate operations where immutable IDs prove duplication, or route uncertainty to QA, but permanent identity merges require governed resolution.

## 18. Duplicate Visit Validation

Separate outlet duplication from visit duplication.

Check:

- same outlet;
- same project;
- same survey purpose;
- same reporting period/day where relevant;
- previous accepted/pending Visit;
- legitimate revisit/correction/QA revisit flags.

Possible outcomes:

```text
FIRST_VALID_VISIT
LEGITIMATE_REVISIT
POSSIBLE_DUPLICATE_VISIT
DUPLICATE_SUBMISSION_RETRY
CORRECTION_OF_EXISTING
```

Idempotent retries must not be mistaken for a new Visit.

## 19. GPS Validation — Visit Location

Visit GPS validation considers:

- coordinate validity;
- freshness;
- reported accuracy;
- project/assignment boundary;
- distance from known outlet where applicable;
- distance from worker movement evidence where available;
- impossible jumps;
- manual override/correction history.

## 20. GPS Accuracy Bands

Exact thresholds are project/device/pilot configuration, not universal constants.

Conceptual bands:

```text
GOOD
ACCEPTABLE
WEAK
UNUSABLE
```

Example behaviour:

- GOOD -> proceed;
- ACCEPTABLE -> proceed;
- WEAK -> retry prompt / WARN / QA according to project;
- UNUSABLE -> BLOCK required GPS submission unless authorised exception.

## 21. GPS Freshness

A Visit should use a recent location observation rather than an old cached coordinate.

If location is stale, request a fresh fix.

The server receives timestamp and accuracy metadata so freshness can be independently validated.

## 22. Distance From Known Outlet

For re-surveys/known-outlet verification, compare visit GPS with canonical/most credible outlet location.

Distance bands are configurable.

A large difference may indicate:

- wrong outlet;
- outlet moved;
- poor GPS;
- old canonical coordinates;
- worker captured from wrong location.

Therefore significant distance should usually route to QA rather than automatically moving the permanent outlet.

## 23. New Outlet Location Validation

A newly discovered outlet's coordinate should be checked against:

- assignment/project geography;
- nearby outlet candidates;
- GPS quality;
- movement/search evidence;
- impossible or clearly non-target locations.

Being outside an assigned boundary may BLOCK or FLAG depending on authorised field-discovery policy.

## 24. Manual GPS Correction

Manual coordinate adjustment, if permitted, requires:

- appropriate role/permission;
- reason code;
- optional supporting evidence;
- original coordinate retained;
- audit event.

Field Workers should not casually drag outlet coordinates to bypass GPS rules.

## 25. Photo Evidence Validation

For required photo evidence validate:

- evidence object exists;
- upload/local queue state is known;
- file type supported;
- size within policy;
- file is readable after upload;
- evidence is linked to correct Visit/outlet/question;
- capture timestamp/provenance retained where available;
- required photo count satisfied.

## 26. Photo Quality

MVP should begin with deterministic checks where reliable, such as file integrity, dimensions and grossly unusable image detection where technically justified.

Advanced AI storefront/product recognition is not required for MVP.

Human QA remains the authority for ambiguous visual evidence.

## 27. Photo Reuse / Duplicate Evidence

The system may compute a file hash/perceptual signal to identify exact or likely repeated evidence across visits.

An exact repeated image across unrelated outlets is a strong QA signal.

Do not automatically accuse a worker of fraud solely from similarity; investigate context.

## 28. Evidence Completeness

A Visit may be locally complete while photo upload is pending, but server acceptance policy may distinguish:

```text
VISIT_DATA_RECEIVED
EVIDENCE_PENDING
READY_FOR_VALIDATION
```

A required photo that has never successfully reached authorised storage cannot become accepted merely because the local record referenced it.

## 29. Visit Duration Validation

Visit duration is an anomaly signal, not a universal truth.

Rules may compare:

- total visit duration;
- question count;
- photo requirements;
- historical typical duration for same survey version;
- repeat visits/corrections.

Very short duration may FLAG_FOR_QA, but should not automatically reject a skilled worker or a legitimate short survey.

## 30. Impossible Movement / Visit Sequence

Cross-check consecutive accepted/pending visits and movement evidence.

Flag patterns such as:

- physically implausible travel between outlets;
- overlapping visits in distant locations;
- large GPS teleportation;
- repeated identical coordinates across unrelated distant outlets.

Poor GPS and delayed offline sync must be considered before drawing conclusions.

## 31. Movement Evidence Validation

Movement batches are validated for:

- authorised Search Session;
- assignment validity at capture time;
- sequence/order;
- duplicate batch/idempotency;
- coordinate validity;
- timestamp plausibility;
- GPS quality;
- impossible speed/jumps;
- stale/replayed evidence;
- device/session consistency where policy permits.

## 32. Coverage Validation

Coverage state is derived from evidence and Coverage Policy.

QA validates exceptions rather than allowing workers to declare completion manually.

Potential checks:

- insufficient unique traversal;
- discontinuous evidence;
- side-street crossing falsely matched;
- parallel-road ambiguity;
- weak GPS;
- coverage hole surrounded by completed streets;
- claimed assignment completion with outstanding required geography;
- area coverage unsupported by sufficient search evidence.

## 33. Coverage False-Positive Principle

False-positive coverage is treated as a higher operational risk than conservative partial coverage.

If evidence is genuinely ambiguous, prefer:

```text
PARTIAL / NEEDS REVIEW
```

over falsely telling the field team that geography is complete.

## 34. Searched-Zero-Found Validation

A `searched-zero-found` result is only valid when:

- geography meets SEARCHED/VERIFIED criteria under the Coverage Policy;
- qualifying outlet count is zero;
- pending offline outlet submissions are reconciled;
- unresolved identity/sync conflicts cannot materially change the result.

Do not classify an area as zero-found merely because no accepted outlet dots are currently visible.

## 35. Coverage Hole Detection

A coverage hole may be generated where required geography remains uncovered/partial within otherwise advanced project coverage.

Examples:

- missed side streets;
- isolated block;
- unsearched H3 cell;
- partial long street;
- GPS gap requiring revisit.

Coverage holes become actionable QA/field tasks, not only dashboard warnings.

## 36. Product Row Validation

Repeatable product rows should validate:

- required Brand/Product;
- numeric daily sales where required;
- allowed option combinations;
- duplicate identical rows where not permitted;
- sensible totals/cross-checks;
- stable row identity.

## 37. Price Row Validation

Price rows should validate:

- Brand/Product selection;
- White/Brown where applicable;
- Product Type;
- Selling Price;
- Cost Price;
- numeric/range rules;
- duplicate row rules;
- optional commercial consistency warnings.

A selling price below cost may be legitimate in some circumstances and should not automatically be changed. Use warning/QA policy as appropriate.

## 38. Premier Mapping Validation

Before a Premier integration job can run, validate that required Survey Guru canonical fields can map to the active Premier WTS adapter/profile version.

Missing mandatory client fields should be detected before attempting interface submission where possible.

## 39. Premier Route Validation

For GT Price workflow, the selected/derived Premier Route must be valid for the configured Premier branch/context.

Invalid route mapping should BLOCK client sync and produce an actionable integration error without invalidating the accepted Survey Guru Visit.

## 40. Third-Party Integration Validation

Integration validation is separate from Survey Guru QA acceptance.

A Visit can be:

```text
Survey Guru: Accepted
Premier WTS: Pending retry
```

or:

```text
Survey Guru: Accepted
Premier WTS: Interface update required
```

Third-party failure never deletes or rolls back accepted Survey Guru data.

## 41. Premier Final Submission Validation

For Premier WTS v2.006 adapter/POC, do not mark `Premier WTS: Synced` until the final staged **Submit Surveys** action and expected success confirmation are completed.

Successful intermediate form population is not final sync success.

## 42. Offline Validation

Offline device validation should catch locally determinable errors immediately.

Rules requiring server/global context become pending server validation.

Example:

```text
Local required-field check       -> immediate
Local phone format               -> immediate
Cached nearby duplicate check    -> provisional
Global duplicate search          -> server
Cross-worker duplicate visit     -> server
Authoritative coverage           -> server
Permission validity              -> server
```

## 43. Pending Validation State

Offline submission can therefore have:

```text
SAVED_LOCAL
PENDING_SYNC
PENDING_SERVER_VALIDATION
PENDING_QA
ACCEPTED
RETURNED_FOR_CORRECTION
REJECTED
```

Do not display `Accepted` until the relevant server/QA acceptance conditions are satisfied.

## 44. QA Queue

QA/Validators require a dedicated queue prioritised by severity and operational impact.

Possible queue groups:

```text
Blocking Project Completion
Possible Duplicate Outlets
Possible Duplicate Visits
GPS / Location Exceptions
Coverage Exceptions
Photo / Evidence Exceptions
Answer Anomalies
Returned Corrections
Integration Exceptions (role dependent)
```

## 45. QA Work Item

```text
QAWorkItem
----------
qaWorkItemId
workspaceId
projectId
resourceType
resourceId
priority
reasonCodes
validationResultRefs
assignedToOptional
status
createdAt
dueAtOptional
resolvedAt
resolution
```

## 46. QA Priority

Suggested priority logic considers:

- blocking vs non-blocking;
- project deadline;
- effect on project completion;
- potential duplicate identity damage;
- coverage gap size;
- evidence severity;
- client delivery impact;
- age of unresolved item.

Avoid arbitrary worker ranking as the primary QA priority.

## 47. QA Review Screen

A reviewer should see enough context to decide without hunting across pages.

For a Visit:

- outlet identity and nearby candidates;
- map/GPS;
- survey answers;
- photos;
- validation flags;
- visit timing;
- relevant movement/coverage summary;
- prior visits;
- worker/project context;
- audit/history;
- allowed resolution actions.

## 48. Coverage QA Screen

For coverage exceptions show:

- street/cell geometry;
- expected coverage;
- supported traversal geometry;
- GPS confidence/quality summary;
- worker/session;
- nearby outlet visits;
- reason for exception;
- outstanding geometry;
- actions such as accept evidence, require revisit, mark source-map issue, authorised override.

## 49. QA Resolution Outcomes

Possible generic outcomes:

```text
ACCEPT
RETURN_FOR_CORRECTION
REQUIRE_REVISIT
CONFIRM_EXISTING_OUTLET
CONFIRM_NEW_OUTLET
MERGE_APPROVED
KEEP_SEPARATE
ACCEPT_WITH_EXCEPTION
REJECT_INVALID
SOURCE_DATA_ISSUE
INTEGRATION_RETRY
ESCALATE
```

Only show actions appropriate to resource/permission.

## 50. Correction Workflow

When correction is needed:

1. reviewer selects reason;
2. only relevant fields/evidence are reopened where practical;
3. worker receives actionable instruction;
4. original submission remains immutable in history;
5. corrected revision is submitted;
6. rules rerun;
7. reviewer or automatic policy resolves the QA item.

## 51. Correction Message Quality

Avoid vague messages such as:

> Incorrect survey.

Prefer:

> **The storefront photo does not clearly show the outlet entrance. Please retake the storefront photo at the outlet.**

or:

> **The visit GPS is 420 m from the known outlet location. Confirm you visited the correct store or submit a location correction with evidence.**

## 52. Revisit Workflow

Some problems cannot be fixed remotely.

A `REQUIRE_REVISIT` outcome creates/links a controlled assignment/task with:

- outlet/geography;
- reason;
- required evidence/action;
- priority;
- original Visit reference;
- deadline where appropriate.

The revisit is a new Visit/evidence event, not a silent edit of history.

## 53. Outlet Merge Governance

Permanent outlet merge is a high-impact identity action.

Requirements:

- authorised role;
- explicit source and surviving outlet IDs;
- evidence/reason;
- client-reference conflict handling;
- alias preservation;
- Visit/evidence history preservation;
- audit event;
- ability to understand historical identity resolution.

Never delete history simply because duplicates were resolved.

## 54. Split / Undo Identity Resolution

Architecture should allow future governed correction if an erroneous merge is discovered.

At minimum, identity history must retain enough lineage to reconstruct what happened.

This is another reason not to physically collapse/delete records destructively.

## 55. QA Sampling

Not every apparently clean Visit must necessarily be manually reviewed.

Projects may define sampling strategies such as:

- random sample;
- new-worker higher sample;
- high-value outlet sample;
- geographic sample;
- anomaly-weighted sample;
- client-required sample;
- 100% review for specific projects/stages.

Sampling policy must be transparent and versioned.

## 56. New Worker QA Support

Because field teams can have high turnover/short tenure, Survey Guru should support configurable enhanced QA for new workers.

This is a quality-development mechanism, not a permanent punitive label.

Examples:

- first N visits higher review rate;
- targeted feedback;
- training prompts for repeated rule failures;
- supervisor sign-off after competence threshold.

Exact N/threshold is configurable.

## 57. Worker Quality Feedback

Workers should receive useful quality feedback such as recurring correction themes.

Examples:

```text
Storefront photo framing
GPS capture quality
Missing product rows
Duplicate outlet selection
Coverage gaps
```

Do not expose opaque risk scores that workers cannot understand or improve.

## 58. QA Metrics

Useful metrics include:

- first-pass acceptance rate;
- correction rate;
- revisit rate;
- duplicate candidate rate;
- confirmed duplicate rate;
- GPS exception rate;
- photo exception rate;
- coverage exception rate;
- average QA turnaround;
- outstanding QA age;
- acceptance by survey version/project/zone;
- rule failure frequency.

Metrics should be used to improve process/training, not interpreted without context.

## 59. Project Quality Dashboard

A Project Manager/Supervisor should see:

```text
Visits submitted
Accepted
Pending QA
Returned for correction
Revisits required
Possible duplicates
Coverage gaps
Blocking exceptions
Export-ready percentage
```

Coverage completeness and data acceptance remain separate measures.

## 60. Project Acceptance Gate

Project finalisation can require:

```text
Required Visits resolved
AND blocking QA resolved
AND required Coverage threshold achieved
AND blocking Coverage exceptions resolved
AND required verification completed
AND export/client-delivery validation passed
```

Authorised project closure with known exceptions is allowed only through explicit exception governance; residual gaps remain visible in reporting.

## 61. Export Readiness Validation

Before export, validate:

- required accepted records only, according to export policy;
- stable IDs present;
- expected survey version mappings;
- no unresolved blocking duplicate identities;
- required GPS/evidence status;
- project/client schema mapping;
- rights classification permits export;
- requested fields are authorised for requester;
- coverage statistics use a consistent snapshot/version.

## 62. Viewing Is Not Exporting

A user who can view a Visit/map is not automatically permitted to export bulk data.

Export authorisation is independently checked at API/backend level.

QA acceptance does not override data-right restrictions.

## 63. Security Validation

Security failures are not QA warnings.

Examples:

- invalid authentication;
- missing membership;
- wrong project scope;
- worker writing another worker's Visit;
- unauthorised raw movement access;
- unauthorised coverage override;
- client-private data requested across workspace boundary.

These are denied server-side and security/audit handling applies as appropriate.

## 64. AI in QA — MVP Boundary

MVP should rely primarily on deterministic rules plus human QA.

Future AI may assist with:

- duplicate candidate ranking;
- photo quality/classification;
- anomaly prioritisation;
- likely capture errors;
- QA queue prioritisation;
- market/opportunity inference.

But:

> **AI recommendation does not become authority merely because it has a high score.**

High-impact identity, rejection, rights or disciplinary decisions require governed human/process authority.

## 65. Human-in-the-Loop Pattern

```text
System detects / recommends
        |
Human reviews where required
        |
Decision recorded
        |
Outcome becomes labelled evidence
        |
Rules/models improve
```

This is consistent with Survey Guru's broader learning architecture.

## 66. False Positive / False Negative Balance

Rules should consider the cost of both errors.

Examples:

### Duplicate Identity
False merge can corrupt longitudinal outlet history, so uncertain matches favour review.

### Coverage
False completion can leave market geography unsearched, so uncertainty favours partial/revisit.

### Numeric Sales Value
An unusual true value may be commercially important, so anomaly should generally be flagged rather than overwritten.

## 67. Rule Explainability

Every worker-facing or QA-facing validation should be explainable.

Store:

- rule code/version;
- observed condition;
- severity;
- human-readable reason;
- required action where applicable.

Avoid unexplained `riskScore = 87` as the sole reason for action.

## 68. Rule Override Governance

Some business validation rules may be overridden by authorised roles.

Override requires:

- permission;
- reason;
- actor;
- timestamp;
- original validation result retained;
- audit event.

Security/authorisation controls are not bypassed through QA override.

## 69. Validation Reprocessing

If a validation algorithm/rule improves, TES may reprocess eligible records under controlled governance.

Reprocessing must retain:

- old rule/version result;
- new result;
- reason/process version;
- material impact on previously delivered data.

Do not silently rewrite historical quality outcomes.

## 70. Rule Configuration by Project

Projects may configure stricter/looser operational rules within TES-approved bounds.

Examples:

- required photos;
- GPS accuracy bands;
- allowed geographic tolerance;
- QA sample percentage;
- numeric ranges;
- coverage verification requirement;
- duplicate sensitivity;
- completion thresholds.

Security controls and fundamental data integrity rules are not client-disableable convenience settings.

## 71. Validation Performance

Immediate field validation should feel responsive.

Expensive/global checks may run asynchronously after server submission.

The worker should not be forced to wait unnecessarily for analytics that can safely become a QA item later.

Blocking server checks should be limited to rules genuinely necessary before accepting the operation.

## 72. Validation Dependency Order

Conceptually:

```text
Authentication / Authorisation
        |
Schema / Structural validation
        |
Required field / type validation
        |
Resource lifecycle validation
        |
Identity / duplicate validation
        |
GPS / evidence validation
        |
Cross-answer/business validation
        |
Spatial / movement / coverage validation
        |
QA routing
        |
Acceptance
        |
Integration / export readiness
```

Some checks may execute concurrently, but authoritative state transitions must respect dependencies.

## 73. Acceptance State Model

A Visit may progress:

```text
STARTED
CAPTURING
SUBMITTED
VALIDATING
        |
        +--> REVIEW_REQUIRED
        |       |
        |       +--> RETURNED_FOR_CORRECTION
        |       +--> REVISIT_REQUIRED
        |       +--> ACCEPTED
        |       +--> REJECTED
        |
        +--> ACCEPTED
```

Exact domain states should remain aligned with the Data Model specification.

## 74. Validation Audit Trail

For each accepted record, Survey Guru should be able to answer:

- which Survey Version was used?
- who captured it?
- when/where?
- which validation rule versions ran?
- what warnings/flags occurred?
- who reviewed them?
- what corrections/revisits occurred?
- what final decision was made?
- what coverage evidence supported the geography?
- what was exported/synchronised to the client?

## 75. QA Data Rights

QA users only see data necessary for authorised workspace/project review.

TES cross-client QA access is not assumed merely because the platform is owned by TES.

Break-glass support access, if needed, follows the Security Model with reason, authorisation, expiry and audit.

## 76. Client QA Visibility

Client Viewer access may show accepted results and agreed quality indicators.

Clients should not automatically see internal worker-sensitive raw trails, internal QA notes or cross-client reference intelligence.

Client-specific QA collaboration can be enabled explicitly where contract/permissions require.

## 77. Data-Correction vs Historical Truth

Corrections should produce current trusted state without erasing historical truth.

Prefer:

```text
Original Observation
      |
Correction Revision
      |
QA Decision
      |
Current Accepted Interpretation
```

rather than destructive overwrite.

## 78. QA Notifications

Notifications should be targeted:

- worker: returned correction/revisit;
- supervisor: blocking field/coverage issues;
- QA: assigned/high-priority work;
- project manager: ageing blockers/project acceptance risk;
- integration admin: interface/mapping failures.

Avoid notifying everyone for every warning.

## 79. MVP Validation Rule Catalogue — Minimum

The MVP must include at least rules covering:

1. required answers;
2. answer type/allowed values;
3. conditional required logic;
4. numeric hard/warning ranges;
5. phone format;
6. required photos;
7. photo upload integrity;
8. visit GPS validity/freshness/accuracy;
9. project/assignment geography;
10. nearby possible duplicate outlet;
11. duplicate visit;
12. repeatable row completeness;
13. basic cross-answer consistency;
14. visit duration anomaly;
15. impossible visit movement;
16. movement batch duplication;
17. impossible GPS movement;
18. weak map-match/coverage confidence;
19. insufficient traversal;
20. coverage hole;
21. searched-zero-found readiness;
22. assignment completion with outstanding required coverage;
23. offline/server validation pending;
24. permission/resource lifecycle conflicts;
25. Premier required-field mapping;
26. Premier branch/route validity;
27. Premier final Submit Surveys confirmation;
28. export readiness/data-right checks.

## 80. Field Pilot Validation Programme

Pilot QA must deliberately seed/observe known errors:

- missing required answer;
- invalid phone;
- wrong product row;
- missing photo;
- blurred/unusable photo;
- duplicate photo;
- wrong outlet selection;
- duplicate outlet creation attempt;
- duplicate visit retry;
- visit far from known outlet;
- weak GPS;
- GPS jump;
- unrealistically short visit;
- worker crosses side street without entering;
- worker walks parallel street;
- worker covers half street;
- two workers cover complementary portions;
- offline duplicate uncertainty;
- assignment reassigned before sync;
- Premier mapping failure;
- Premier interface change;
- final Premier Submit Surveys not completed.

Verify the system produces the expected BLOCK/WARN/QA/INFO outcome without data loss.

## 81. Acceptance Criteria

QA & Validation MVP is acceptable when:

1. obvious capture errors are prevented at source;
2. server independently revalidates protected submissions;
3. uncertain duplicate outlets are not silently merged;
4. poor GPS cannot silently become high-confidence location;
5. required evidence cannot disappear during offline sync;
6. anomalies create explainable work items;
7. QA can accept/correct/revisit/reject with audit;
8. corrections preserve original history;
9. coverage gaps become actionable field work;
10. searched-zero-found is only created from credible completed search;
11. workers receive actionable correction messages;
12. project managers can see blocking quality risk;
13. exports exclude unresolved blocking records according to policy;
14. client integration failure does not corrupt Survey Guru acceptance;
15. validation rules/results are versioned;
16. security failures cannot be overridden as QA exceptions;
17. data-right boundaries remain enforced throughout QA;
18. field pilots validate the rules under real South African operating conditions.

## 82. Locked QA Decisions

1. Validation has four main severities: BLOCK, WARN, FLAG_FOR_QA and INFO.
2. Device validation improves UX; server validation remains authoritative.
3. Validation rules and outcomes are versioned/auditable.
4. Unusual values are not silently corrected.
5. Permanent outlet identities are never silently merged.
6. Outlet duplication and visit duplication are separate problems.
7. Significant GPS disagreement routes to investigation rather than automatically moving an outlet.
8. Required evidence must successfully reach authorised storage before final acceptance where policy requires it.
9. Visit duration is an anomaly signal, not automatic proof of poor work.
10. Movement anomalies account for offline/GPS uncertainty.
11. False-positive coverage is considered more dangerous than conservative partial coverage.
12. Searched-zero-found requires credible completed search plus reconciled outlet submissions.
13. Coverage holes become actionable tasks.
14. Survey Guru acceptance and third-party integration status remain separate.
15. Premier WTS is not marked synced until final Submit Surveys success is confirmed.
16. QA corrections preserve original history.
17. Revisit creates new evidence rather than rewriting the original Visit.
18. Outlet merge is governed, auditable and non-destructive to history.
19. QA sampling is configurable and can be increased for new workers/projects.
20. AI may assist QA later but does not become automatic authority for high-impact decisions.
21. Validation decisions must be explainable.
22. QA override cannot bypass security/authorisation.
23. Viewing QA data does not automatically grant export rights.
24. Project completion requires both data quality and coverage quality according to policy.
25. Quality metrics are used to improve training/process and must be interpreted in context.

## 83. Required Cross-Document Updates

This specification materially affects:

- `MVP-FUNCTIONAL-SPECIFICATION.md`
- `DATA-MODEL-ENTITY-ARCHITECTURE.md`
- `MVP-PERSISTENCE-SPECIFICATION.md`
- `API-AUTHORISATION-SPECIFICATION.md`
- `SCREEN-NAVIGATION-ARCHITECTURE.md`
- `COVERAGE-MODEL-SPECIFICATION.md`
- `FIELD-CAPTURE-OFFLINE-WORKFLOW-SPECIFICATION.md`
- `THIRD-PARTY-INTEGRATION-PREMIER.md`
- future Import/Export Specification.

The next implementation-level work should align the domain entities and persistence model with `ValidationRule`, `ValidationResult`, `QAWorkItem`, correction/revisit lineage and coverage QA exceptions.

---

## Living Documentation Rule

This is a living TES specification. Material discoveries or decisions affecting validation, QA, outlet identity, evidence, GPS, coverage, correction, integration, export readiness, security or project acceptance must be version-controlled here and in other materially affected Survey Guru/TES documents rather than remaining only in chat or informal notes.
