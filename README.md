# SmartConnectX

A responsive, self-service personal portfolio and digital contact card. People fill in their own details, then share their portfolio with a QR code or an NFC tag.

## Run locally

Requires Node.js 22.12+ (Node.js 24 LTS recommended).

```sh
npm ci
npm run dev
```

## Create and share a portfolio

1. Choose **Create your portfolio**.
2. Add your name, role, story, and optional profile photo URL.
3. Add the contact details and social links you want to make public.
4. Add up to three projects, or continue without any.
5. Copy your portfolio link or download its QR code from the share screen.

A shared link contains a compressed snapshot of the profile. It opens the same profile in a fresh browser, without an account or backend. The owner's editable profile is also saved in their browser when storage is available. A visitor can create their own portfolio without overwriting the shared one.

To update a shared portfolio, edit it and distribute the new link or QR code. Existing links preserve the earlier snapshot. All details included in a link are visible to anyone who has that link; include only contact information intended for sharing.

## NFC

Deploy the site at a public address first. Copy the complete portfolio link into a URL / web link record using an NFC writer app, then write it to a compatible NFC tag. Check the tag's storage capacity: links containing profile information can exceed small tags. Test the QR code and NFC tag with another phone. Programming physical NFC tags is done with the phone's writer app, not this website.

## Verify and deploy

```sh
npm test
npm run build
npm run preview
```

Deploy `dist/` to any static HTTPS hosting provider. No server, database, or secret keys are needed. Generate shared links from the deployed site so they use its public address. The welcome page contains clearly labeled sample content, which is replaced when a person creates their portfolio.

Contact downloads use Unicode-safe vCards with folded lines. QR images are generated locally with a quiet margin and high-resolution export. Fonts are bundled locally; optional profile image URLs must be publicly accessible HTTP(S) images. Failed image loads fall back to the person's initials.

There is no account system, cloud synchronization, or permanent short-link service. A shared portfolio is a snapshot rather than an automatically updating hosted profile.

## GitHub Pages deployment

The included `.github/workflows/deploy-pages.yml` tests, builds, and deploys the site after a push to `main`. In this repository's **Settings → Pages**, select **GitHub Actions** as the build source. Publishing requires an account with repository write access and permission to configure Pages.

The workflow builds with `--base=/smartconnectx/` for the repository's project path. Change that base if the repository is renamed or you use a custom domain.

For a manual deployment to another static host, run `npm run build -- --base=./` and upload the contents of `dist/`.

## Local server and ngrok

A built-in Node server serves only `dist/`. Run `npm run build` and `npm start` to use it locally at port 3000. `/healthz` reports readiness. `PORT` changes the port, and `HOST` changes the bind address. The default bind is loopback; ngrok forwards to this server.

To share with a phone:

1. Install Node.js 22.12+ on the computer or server that will stay running.
2. Run `npm ci` from this project's directory.
3. Copy `.env.example` to `.env` and privately set `NGROK_AUTHTOKEN` to your own current ngrok token. `.env` is ignored and must never be shared.
4. Run `npm run build` if using the source checkout. The downloadable server ZIP includes a prebuilt `dist/`.
5. Run `npm run share`. It starts the local server and connects using the official ngrok Node SDK.
6. Open the printed public HTTPS link on your phone. Create the portfolio from that address so QR/NFC links use the public origin.

Keep the computer and terminal running. Ctrl+C closes both the server and tunnel. Tunnel links are temporary; use a stable hosting address or an ngrok domain for long-lived NFC cards. Rotate any token that was pasted into chat before using it.

If the official ngrok CLI is already authenticated, you can instead run `npm start`, then run `ngrok http http://localhost:3000` in another terminal. The Node server accepts ngrok's host header without disabling Vite host checks or exposing development source files.

The ngrok launcher was verified for missing-token handling. A live tunnel could not be created in this cloud: its mandatory proxy rejects ngrok's control transport with `TLSV1_ALERT_NO_APPLICATION_PROTOCOL` and closes the authentication stream, even with the official CLI proxy configuration and system certificate verification. Run the downloaded package on a computer or host whose network supports ngrok. Other networks using an HTTP proxy can use the official ngrok CLI's supported `proxy_url` configuration, but that configuration did not resolve this cloud's transport limitation.
