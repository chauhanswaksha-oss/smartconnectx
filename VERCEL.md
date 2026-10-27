# Vercel release target

- Team/scope: `chauhanswaksha-oss` (`team_CtYR07xac3DnLidyMfayoI4H`).
- Existing project: `smartconnectx` (`prj_qGnBSsVj4hyQUX3fE0GK02IlwLP8`).
- Existing public address: `https://smartconnectx.vercel.app`.
- Source branch: `vercel/customer-payments`.
- Build command: `npm run build`; install: `npm ci --no-audit --no-fund`; output: `dist`; framework: Vite.

Keep this account and project. Do not create another project or change hosting providers. Verify the exact project, team, deployment source and commit before releasing; the latest live Vercel source could not be inspected because the connection currently lacks the team's access grant.

## Remaining launch steps

1. Authorize the existing Vercel connection for the team above. Its API currently returns 403 and requests team authorization. A Vercel consent link is single-use and expires after ten minutes. Do not request or publish API tokens in chat.
2. Inspect the current project and deployment source. Stage the tested commit in this existing project, verify account and checkout routes, then release to the production address.
3. Verify Supabase Auth's Site URL and allowed redirect destinations include the production `/account` and `/reset-password` addresses. Keep existing URLs needed by other deployments. Test confirmation and recovery emails. Check SMTP delivery configuration; do not disable email confirmation to bypass delivery problems.
4. Confirm the intended existing verified owner identity before adding it to `scx_private.admins` through a trusted database connection. Customer signup cannot grant admin access. Owner membership is currently unassigned.
5. Sign in at `/admin`, enter the receiving UPI ID and merchant name, review the editable ₹99/month and ₹499/year prices, and open checkout when ready.
6. Test a real payment only with explicit payment authorization. Match the recipient, amount and reference in the receiving bank app before approving it. Confirm the customer's subscription end date.

There is no UPI AutoPay mandate or automatic debit. Subscriptions renew through a new customer payment, and each payment requires owner verification. Refund requests are recorded for owner review; the website does not move refunded money.

## Verification and limits

- Automated tests cover profile links, input validation, checkout states, order ownership, direct-write denial, duplicate approval, renewal, card limits and expiry.
- Commerce integration tests run in isolated PostgreSQL (PGlite), using a minimal Supabase Auth schema contract. Synthetic identities and payments roll back; no real payment is made.
- The new schema is installed in the existing Supabase project; the old `digital_cards` table remains unchanged. RLS protects all new public tables.
- Live full-transaction testing through the connector returned an expired-request error. Live deployment, auth delivery, visual rendering and a real UPI payment remain unverified.
- The protected private admin/audit tables intentionally deny client access. Security-definer write RPCs deliberately check authentication and ownership or owner membership before writing.
- The existing leaked-password-protection setting is still disabled. Review it in Supabase Auth password-security settings.
