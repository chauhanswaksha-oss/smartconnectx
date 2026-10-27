# SmartConnect X on Cloudflare

This branch contains customer login, permanent digital cards, manual UPI checkout, monthly/yearly subscriptions and an owner dashboard.

- Run: `npm ci`, then `npm run dev`.
- Verify: `npm test`, `npm run build`, `npx wrangler deploy --dry-run`.
- Deploy to your connected Cloudflare account: `npm run deploy:cloudflare`.
- For Windows PowerShell execution-policy errors, use `npm.cmd` and `npx.cmd`.
- Read [CLOUDFLARE.md](CLOUDFLARE.md) for authentication redirects, email delivery and owner setup.

Checkout is disabled until the receiving UPI ID and prices are set. No real payments or subscriptions have been activated. The owner identity still needs explicit confirmation before admin access can be assigned.
