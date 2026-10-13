import path from 'node:path';

// Text editors sometimes append these extensions when saving .env.
export function loadLocalEnvironment(directory) {
  for (const name of ['.env', '.env.text', '.env.txt']) {
    try {
      process.loadEnvFile(path.join(directory, name));
      return name;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return null;
}
