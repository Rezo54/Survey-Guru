# Survey Guru Insights & Client Reporting Specification

**Status:** Product direction locked for implementation planning  
**Owner:** TES — Task Expert Systems  
**Product:** Survey Guru

## 1. Purpose

Survey Guru must not end at data collection or static report export. A project should develop into a controlled, engaging client-facing intelligence experience as fieldwork progresses.

The capability is provisionally named **Survey Guru Insights & Client Reporting**. The client-facing feature name remains open until the UI is tested.

The target experience is inspired by modern GIS dashboards and story-style reporting, but purpose-built for FMCG field intelligence and Survey Guru's security, coverage and outlet models.

Project lifecycle:

`Create Project → Define Geography → Assign Fieldwork → Collect → QA → Analyse → Publish Client View → Track Progress → Final Report`

The report is therefore a live project surface, not merely an end-of-project document.

## 2. Product Navigation

Each project should evolve toward the following primary navigation:

`Overview | Fieldwork | Map & Coverage | QA | Insights | Client View`

- **Insights** is the internal workspace where authorised Taskraft/TES users construct and analyse the project story.
- **Client View** is the controlled published experience exposed to authorised client users.

## 3. Core Design Principle

The reporting experience follows Survey Guru's locked Hybrid Enterprise/GIS direction.

Primary visual hierarchy:

`Map → Geographic Status → Exceptions / Actions → Supporting KPIs / Tables / Narrative`

Survey Guru should not become a generic BI dashboard clone. Geography remains the primary analytical context.

Selecting geography on the map should be capable of filtering or contextualising other blocks such as KPIs, charts, opportunity summaries, photographs and outstanding fieldwork.

## 4. Block-Based Report Builder

The Insights builder should use configurable blocks so a useful client report can be assembled without specialist dashboard-development skills.

Initial/future block catalogue includes:

- Interactive map
- Street/search coverage
- Project progress
- Stores surveyed
- Stores discovered
- Stores verified
- Searched-zero-found geography
- Brand/category penetration
- Competitor presence
- Photo gallery
- KPI cards
- Charts
- Ranking tables
- Opportunity hotspots
- Field progress
- QA status
- Executive commentary
- Period comparison
- Recommendations / actions
- Downloadable authorised data/report

Blocks must use common project filters and a consistent query model rather than independently inventing business definitions.

## 5. Templates

Survey Guru should make good reporting easy by providing project/report templates. Candidate templates include:

- WTS Progress Dashboard
- Retail Universe
- Brand Availability
- Route-to-Market Opportunity
- Project Completion
- Executive Client Summary

A template should generate a sensible first dashboard from the project's authorised data. An authorised user can then rearrange blocks, hide sections, add commentary and publish.

Templates must remain configurable by project and client rather than hard-coding a single FMCG workflow.

## 6. Official Story vs Personal Client Views

A key distinction is required:

**Taskraft/TES publishes the official project story. Client users may personalise their own analytical views within their authorised data scope.**

Example client saved view:

`Gauteng → Brand: Sunbake → Coverage: Completed → Channel: Spaza → Last 7 Days`

A client's personal filters or saved views must not alter the official published project dashboard.

## 7. Publication Levels

The architecture should support controlled publication levels:

1. **Internal View** — authorised TES/Taskraft/project operational users.
2. **Client View** — authenticated client users with project/data-right scope.
3. **Share/Public View** — optional future controlled sharing, only where explicitly permitted.

Future sharing controls may include:

- named-user access
- organisation access
- expiry dates
- download permission
- watermarking
- publication/version history
- access audit history

Public/share functionality is not an MVP requirement and must not weaken the normal authentication/authorisation model.

## 8. Security and Data Rights

Dashboard/report configuration is never an authority boundary.

Every block is an API consumer and every underlying query must be independently authorised by the Survey Guru API according to:

`Identity → Organisation → Workspace Membership → Permission → Project Scope → Resource Scope → Data Domain → Data Rights → Lifecycle/Policy`

The existing data-right classifications continue to apply:

- `CLIENT_PRIVATE`
- `OPERATIONAL_SHARED`
- `TES_REFERENCE_PERMITTED`
- `PUBLIC_OR_LICENSED`

If a client is not authorised to access raw worker movement, adding or manipulating a movement-related report block cannot expose it. The API must deny or return an authorised derived representation regardless of UI state.

The following remain untrusted:

- report/widget configuration
- browser filters
- URL parameters
- cached dashboard data
- client-supplied project/workspace IDs
- locally stored roles/permissions

Cached PWA reporting content must never imply current authority. Sensitive data must be reauthorised appropriately when refreshed or retrieved.

## 9. Geographic Interaction

The client experience should support linked geographic analysis. For example, selecting an opportunity hotspot or project zone may update:

- outlet counts
- category/brand charts
- coverage status
- outstanding streets
- opportunity indicators
- photographs
- QA indicators
- recommendations

Coverage and outlet discovery remain separate facts. A high outlet count cannot imply that geography has been searched, and searched-zero-found remains a durable meaningful project result.

## 10. Progress and Final Reporting

The same reporting model should serve both live project tracking and final presentation.

During execution, clients can follow authorised progress, coverage, findings and QA state. At project completion, an authorised report version can be frozen/published as the final project record while the underlying operational data remains governed by normal retention and data-right policies.

Static export (for example PDF) may be added as a delivery format, but it is secondary to the interactive project experience.

## 11. Suggested Domain Concepts

Implementation planning should evaluate explicit entities such as:

- `InsightDashboard`
- `InsightBlock`
- `DashboardTemplate`
- `DashboardFilterDefinition`
- `SavedClientView`
- `Publication`
- `PublicationVersion`
- `SharePolicy`

These names are conceptual and should be reconciled with the canonical Survey Guru data model before persistence is implemented.

A publication should reference authoritative project/domain data rather than copying uncontrolled datasets into a separate reporting silo.

## 12. MVP Boundary

This capability is strategically important but must not derail the first local/Firebase field test.

For the first application checkpoint:

- preserve the navigation/architecture space for Insights and Client View;
- create representative GIS-first UI patterns where useful;
- keep API/query boundaries compatible with future report blocks;
- do not implement a full drag-and-drop dashboard builder before the field/PWA/API/Android foundation is testable.

After the first field foundation checkpoint, implement the reporting capability incrementally, starting with a project progress/client dashboard composed from fixed reusable blocks before introducing free-form drag-and-drop editing.

## 13. Product Outcome

Survey Guru should allow a client to understand, interactively:

**What was discovered? → What geography was actually searched? → What remains unknown or outstanding? → Where is the opportunity? → What action should follow?**

This turns Survey Guru from a field capture application into a continuing project intelligence and client-engagement platform.
