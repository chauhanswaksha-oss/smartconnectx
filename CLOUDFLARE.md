# Cloudflare launch configuration

The build is a static Vite app. Supabase supplies authentication and server-enforced data access, so no privileged database key is required in Cloudflare.

1. Authenticate to the intended Cloudflare account. Use a free Workers static-assets deployment or Pages upload; do not enable paid services without a spending decision.
2. Build with `npm ci` and `npm run build`. Workers reads `wrangler.jsonc`; Pages uses build output `dist/`.
3. Deploy the build and retain the exact live HTTPS URL returned by Cloudflare.
4. In the existing Supabase project's Authentication URL Configuration, add the exact new site origin and `/account`, `/reset-password` redirect destinations. Preserve existing Vercel URLs while migration is in progress. Verify email confirmations and password recovery reach the new site.
5. Check Supabase SMTP configuration. Built-in auth email delivery may be restricted; verify customer signup delivery and configure a production mail provider if required. Do not disable confirmation just to make testing pass.
6. Confirm the intended existing, verified owner identity before granting membership in `scx_private.admins` through a trusted server/database connection. This cannot be done from customer signup or browser code. Owner membership is currently unassigned pending explicit identity confirmation.
7. Sign in at `/admin`, enter the receiving UPI ID and merchant name, review the editable ₹99/month and ₹499/year prices, and open checkout when ready.
8. Test one low-value payment only with the owner's explicit payment authorization. Verify receipt in the bank app, approve it in the owner dashboard, and confirm the customer's Pro end date. Never approve based solely on a submitted reference.

No automatic recurring debit is configured. Supporting UPI AutoPay later requires a payment gateway, mandate consent, signed webhook verification and server-side reconciliation. A UPI ID by itself cannot provide that.

## Current verification

- Production build and Cloudflare package dry-run.
- 22 automated tests, including isolated PostgreSQL security/commerce integration.
- Live schema: RLS enabled on all new public tables; direct customer order writes denied; anonymous submission denied; checkout disabled; no real orders or subscriptions.
- Live owner access has not been granted. Automatic approval review requires explicit confirmation of the intended account.
- Live full-transaction testing through the connector returned an expired-request error. The same migration and commerce security tests pass locally in PostgreSQL (PGlite); live end-to-end payment and auth checks remain outstanding.
- Visual verification in the cloud browser is pending deployment because it cannot access the local development server.

The existing Supabase leaked-password-protection warning remains; it can be reviewed in Auth password-security settings. Do not interpret that warning as an already enabled protection.
