import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
// Browser architecture: this value is PUBLIC in the built JS and request URLs.
// Read the existing .env locally or the Netlify build environment. Never log it.
let local = {};
try {
  local = parseEnv(await readFile(new URL('../.env', import.meta.url), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw new Error('Unable to read local environment configuration.');
}
const apiKey = (process.env.ALPHA_VANTAGE_API_KEY ?? local.ALPHA_VANTAGE_API_KEY ?? '').trim();
if (
  (!apiKey || apiKey === 'your_alpha_vantage_api_key_here') &&
  !process.argv.includes('--allow-empty')
) {
  console.error('Set ALPHA_VANTAGE_API_KEY in .env or the Netlify build environment.');
  process.exitCode = 1;
} else {
  const folder = new URL('../src/environments/', import.meta.url);
  await mkdir(folder, { recursive: true });
  await writeFile(
    new URL('environment.local.ts', folder),
    `// Generated and Git-ignored. The API key is public in the browser.\nexport const localEnvironment = ${JSON.stringify({ apiKey: apiKey === 'your_alpha_vantage_api_key_here' ? '' : apiKey })};\n`,
  );
  console.log(
    apiKey
      ? 'Browser API configuration generated (key not displayed).'
      : 'Browser API configuration generated without a key.',
  );
}
