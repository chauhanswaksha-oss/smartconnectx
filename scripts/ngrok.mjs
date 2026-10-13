import path from 'node:path';
import ngrok from '@ngrok/ngrok';
import { createStaticServer, projectDirectory, runtimeOptions } from '../server.mjs';

try { process.loadEnvFile(path.join(projectDirectory, '.env')); }
catch (error) { if (error.code !== 'ENOENT') { console.error('Could not read .env. Check its permissions and format.'); process.exit(1); } }
const token = process.env.NGROK_AUTHTOKEN?.trim();
if (!token) {
  console.error('Add NGROK_AUTHTOKEN to your private .env file, then run npm run share again.');
  console.error('Get your token from https://dashboard.ngrok.com/get-started/your-authtoken');
  process.exit(1);
}
let server;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await ngrok.disconnect().catch(() => {});
  if (server) await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { stop().then(() => process.exit(0)); });
try {
  const { port } = runtimeOptions();
  server = await createStaticServer({ host: '127.0.0.1', port });
  console.log(`Local server ready at http://127.0.0.1:${port}`);
  console.log('Connecting to ngrok…');
  const listener = await ngrok.forward({ addr: `http://127.0.0.1:${port}`, authtoken: token });
  console.log(`\nOpen this link on your phone: ${listener.url()}`);
  console.log('Create your portfolio from that public link, then share its QR code or NFC link.');
  console.log('Keep this terminal open. Press Ctrl+C to stop the server and tunnel.');
} catch (error) {
  const message = String(error.message || error).split(token).join('[redacted]');
  console.error(`Ngrok did not connect: ${message}`);
  console.error('Check your token and network access to connect.ngrok-agent.com.');
  console.error('For networks requiring an HTTP proxy, use the official ngrok CLI with its supported proxy_url configuration.');
  await stop();
  process.exitCode = 1;
}
