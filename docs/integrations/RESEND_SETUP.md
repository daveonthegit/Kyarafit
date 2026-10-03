# Resend API setup

Current transactional mail is implemented in [`convex/emailHelpers.ts`](../../convex/emailHelpers.ts)
using the Resend SDK/HTTP API. Internal wrappers live in [`convex/email.ts`](../../convex/email.ts);
Better Auth uses the verification and reset helpers directly. This is **not** the retired
Go/SMTP integration, and `SMTP_*` environment variables have no effect on these helpers.

## Configuration

For a dedicated, authorized development deployment, configure these variables in its Convex
server environment (not a client bundle or tracked file):

| Variable         | Purpose                                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| `RESEND_API_KEY` | Server-side sending credential; keep it in the deployment's secret store |
| `EMAIL_FROM`     | Sender identity; use a verified domain for release mail                  |
| `APP_URL`        | App destination used by welcome-email links                              |

Without `RESEND_API_KEY`, the helper rejects sending. `EMAIL_FROM` currently falls back to a
Resend onboarding sender; this is for development, not proof of release-domain verification.
`APP_URL` has a localhost fallback. Confirm sender/domain and destination configuration before
release; see the authoritative helper for exact defaults and templates.

## Development verification

- Provision a Resend sending credential with the required scope through the authorized operator.
- Follow [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)
  for sender DNS, and [API-key guidance](https://resend.com/docs/dashboard/api-keys/introduction).
- Exercise verification/reset mail only with synthetic development accounts. Confirm provider
  acceptance, delivery, sender identity, and links; a unit test does not verify delivery.
- Never commit credentials, reset/verification URLs, recipient information, or provider logs.

Provider limits and pricing change; consult [Resend](https://resend.com/) instead of relying on
historical free-tier counts. Production configuration, DNS changes, and credential rotation are
operator actions. See [deployment preflight](../setup/DEPLOY_README.md).
