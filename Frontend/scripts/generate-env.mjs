// Angular no lee archivos .env: este script los traduce a src/environments/environment.ts.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'src/environments/environment.ts');

function parseEnvFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return {};
  }
  const vars = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || line.trimStart().startsWith('#')) continue;
    vars[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return vars;
}

const env = { ...parseEnvFile(resolve(root, '.env')), ...process.env };
const apiUrl = env.NG_APP_API_URL ?? 'http://localhost:80/api';

const contents = `// Generado por scripts/generate-env.mjs a partir de .env. No editar a mano.
export const environment = {
  apiUrl: ${JSON.stringify(apiUrl)},
} as const;
`;

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, contents);
console.log(`environment.ts generado con apiUrl=${apiUrl}`);
