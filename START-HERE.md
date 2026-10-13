# Open SmartConnectX on your phone with ngrok

Run the server on a computer or Node-enabled host. Your phone opens the public HTTPS link it prints. This ZIP includes the modern Virat Kohli sample portfolio, editable portfolio builder, prebuilt website, server, and ngrok launcher.

1. Install Node.js 22.12 or later (https://nodejs.org).
2. Extract this ZIP and open a terminal inside the `smartconnectx` folder.
3. Run `npm ci`.
4. Copy `.env.example` to a file named `.env`. Fill in your **own current token** after `NGROK_AUTHTOKEN=`. Get one at https://dashboard.ngrok.com/get-started/your-authtoken. Keep this file private. Rotate a token previously pasted into chat.
5. Run `npm run share`.
6. Wait for **Open this link on your phone: https://…** and open that exact link on your phone.

Leave the terminal running. Press Ctrl+C to stop. If ngrok reports a token or network error, correct it and run the command again. No live link is created when ngrok fails.

To use only the local server, run `npm start`. To rebuild after editing the source, run `npm run build`.

Already using the official ngrok CLI? Run `npm start`, then run `ngrok http http://localhost:3000` in a second terminal. It will use your existing ngrok configuration.

Create and share your portfolio from the public ngrok address, not localhost. QR and NFC links only work while the server and tunnel run; permanent sharing needs stable hosting.

If your editor saves the token file as `.env.text` or `.env.txt`, the ngrok launcher accepts those names too. It checks `.env` first. All three files are private and excluded from Git.
