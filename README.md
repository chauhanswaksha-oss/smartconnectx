# SmartConnect X — Cloudflare edition

Digital business cards with permanent public links, customer accounts, UPI checkout, and manually renewed monthly/yearly subscriptions.

## Run and verify

Requires Node 22.12 or later.

```sh
npm ci
npm test
npm run build
npx wrangler deploy --dry-run
```

`npm run dev` starts Vite. The browser build is in `dist/`. `npm run deploy:cloudflare` builds and deploys to the Cloudflare account authenticated with Wrangler. On Windows PowerShell, use `npm.cmd` / `npx.cmd` if PowerShell blocks the `.ps1` shims; no execution-policy change is necessary.

## Deployment

This branch targets Cloudflare Workers static assets. Cloudflare Pages can also serve `dist/` with its SPA fallback. No ChatGPT Sites or Lovable hosting is required.

For Workers Builds, select this branch, set the build command to `npm run build` and deploy command to `npx wrangler deploy`. For manual upload, upload the contents of `dist/`, not the repository or node_modules. See [CLOUDFLARE.md](CLOUDFLARE.md) for the remaining account configuration.

The existing Vercel deployment is not changed by this branch. The earlier repository code was a local-storage portfolio builder; the Cloudflare edition adds Supabase-backed accounts, profiles, orders and subscriptions while continuing to read legacy profile snapshot links.

## Customer features

- Email/password signup, sign-in and password reset using Supabase Auth.
- Free: one saved digital card. Pro: create up to five cards during the paid period.
- Permanent card addresses, editable details, public/private toggle, QR sharing and vCard downloads.
- Monthly and yearly UPI checkout, payment-reference submission, order history and support requests.
- Pro starts only after an owner verifies payment. Renewal extends the existing access end date.
- There is no automatic debit, gateway settlement verification or UPI AutoPay mandate.
- Existing cards remain editable and available when Pro expires. Creating additional cards is blocked by the database after expiry.

## Owner features

`/admin` requires an explicitly provisioned owner identity. Ordinary customers cannot grant themselves owner access. Owners configure the receiving UPI ID, merchant name and prices, review payments, and reply to support requests.

Checkout starts disabled, and no receiving UPI ID is hardcoded. Initial editable catalog prices are ₹99/month and ₹499/year. Opening checkout requires the owner to confirm the receiving UPI ID and prices.

Payment confirmation is manual: match the recipient, full amount and 12-digit reference in the receiving bank/UPI app before approving. Submitting a reference is not proof of payment. The website records refund requests; it does not issue bank refunds.

## Data and security

`cloud-config.js` contains only the public Supabase URL and publishable key. Never put a service-role key, account password or Cloudflare API token in browser code.

Additive migrations are in `supabase/migrations/`. The existing `digital_cards` table is untouched. New `scx_*` tables use RLS. Client roles have read access according to policies, with all writes through narrow RPC functions. Each write authenticates the caller and checks ownership or an independently protected owner role. Prices, recipient details, subscription periods and payment states are server controlled. Approval is idempotent and updates payment and entitlement in one transaction. Slugs remain unchanged after creation.

`scx_private.admins` and `scx_private.audit` intentionally have no client RLS policies. The security-definer write functions intentionally execute with limited client grants and explicit authorization checks. Supabase Advisor flags these callable functions for review; this is an intentional RPC boundary, not blanket client access to the tables.

## Test coverage and limits

`npm test` includes profile encoding/URL safety, vCard generation, static-server traversal, UPI amount/recipient validation, redirect safety, DOM checkout states, owner controls, and PostgreSQL authorization/renewal/expiry tests. Database tests use an isolated PostgreSQL WASM instance (PGlite) with a minimal Supabase Auth schema contract. All synthetic identities and test payments are rolled back. No real payment is made.

Cloudflare dry-run validates the upload package but does not publish it. Actual Cloudflare account sign-in, live auth email delivery/redirect URLs, mobile browser rendering and a real UPI payment must be verified after account connection and owner setup. This repository does not claim those checks are complete.
