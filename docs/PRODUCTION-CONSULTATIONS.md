# Production domain and consultation delivery

Canonical public origin: https://surveyguru.ai
The www.surveyguru.ai hostname redirects to the canonical origin.
Marcaria is the registrar; Netlify remains authoritative DNS and web hosting.
Netlify manages the active, auto-renewing Let's Encrypt HTTPS certificate.
Microsoft 365 in the existing Taskraft tenant handles surveyguru.ai mail.
Keep the Microsoft 365 MX, SPF and Autodiscover records in Netlify DNS.

Public consultation mailbox: consult@surveyguru.ai (Microsoft 365 shared mailbox).

Cloud Run API: https://survey-guru-api-1028439473514.africa-south1.run.app
Cloud Run configuration:

```dotenv
SURVEY_GURU_WEB_ORIGIN=https://surveyguru.ai
```

The consultation form uses the same-site Next.js server route
`/api/consultations`, hosted by Netlify. It does not call the Cloud Run API.
Do not change Cloud Run CORS, API authentication, Firebase rules or DNS to
activate this form. Sending credentials must be server-only Netlify environment
variables, never NEXT_PUBLIC variables or browser code.

The owner selected Microsoft 365 sending. Application credentials and scoped
permission must be configured before live delivery can be verified.

Before publication, complete automated validation and obtain owner approval.
After server-side sending configuration and approved deployment, send one clearly
labelled test request, confirm receipt in consult@surveyguru.ai, verify all fields,
and confirm Reply addresses the submitter. Provider acceptance alone does not
prove inbox delivery. Do not report live delivery as verified before this check.

## Microsoft 365 sending setup (administrator)

The existing Next.js route uses native server-side fetch with Microsoft Graph.
No new package or third-party email provider is required. Sender and recipient
are fixed to consult@surveyguru.ai; the visitor is Reply-To only.

1. Register a single-tenant application in the Taskraft Entra tenant. Record its
   tenant ID, application/client ID and Enterprise Application object ID.
2. Create a client secret, record its expiry, and store its value only in Netlify
   server/function environment settings. Never paste secrets into chat or Git.
3. In Exchange Online, register the application's service principal, create a
   recipient management scope restricted to consult@surveyguru.ai, and assign
   only `Application Mail.Send` using that scope. Use Exchange Application RBAC.
   Do not also grant unscoped Entra Graph Mail.Send: grants are additive and that
   would bypass the mailbox restriction. No Mail.Read or Mail.ReadWrite needed.
4. Use `Test-ServicePrincipalAuthorization` for consult@surveyguru.ai and a
   mailbox outside the scope; confirm allowed and denied respectively. Existing
   human mailbox access / Send As permissions do not grant this app access.
5. Configure these server-only Netlify variables for production Functions:

```dotenv
M365_TENANT_ID=<tenant-guid>
M365_CLIENT_ID=<application-client-id>
M365_CLIENT_SECRET=<secret-value>
```

The obsolete RESEND_API_KEY, SURVEY_GURU_CONSULTATION_FROM and
SURVEY_GURU_CONSULTATION_TO variables are not used by this route.
Do not configure these Microsoft secrets in Cloud Run or NEXT_PUBLIC variables.
After approval, deploy the web change and perform the inbox receipt test above.
Graph returns 202 when accepted for processing, not proof of inbox delivery.

## Submission safeguards and limits

All fields are required and validated server-side; subject newlines are rejected.
Plain-text mail avoids HTML injection. Browser controls freeze while submitting.
A stable request reference and timestamp are retained on retry. The route
coalesces identical requests within one warm process and rejects changed payloads
using the same reference. A one-minute per-email throttle and bounded caches
limit accidental repeats. Ambiguous Graph timeouts are not automatically resent.
These caches are not durable or shared across Netlify instances: exactly-once
mail delivery is not guaranteed, and this is not distributed anti-spam protection.
No Firestore rules, API permissions or Cloud Run CORS settings are changed.

References:
- https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac
