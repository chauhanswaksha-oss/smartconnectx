# SmartConnect X on Vercel

This branch contains customer login, permanent digital cards, manual UPI checkout, monthly/yearly subscriptions and an owner dashboard.

- Run: `npm ci`, then `npm run dev`.
- Verify: `npm test`, then `npm run build`.
- Deploy to the existing SmartConnect X Vercel project, using Vite and `dist/` as the output directory.
- Read [VERCEL.md](VERCEL.md) for the exact target and remaining launch configuration.

Checkout stays closed until the receiving UPI ID and prices are configured. No real payments or subscriptions have been activated. The owner identity needs explicit confirmation before admin access can be assigned.
