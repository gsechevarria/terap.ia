import { readFile, writeFile } from 'node:fs/promises';
import { assertLocalDatabase } from './lib/local-only.mjs';
const status = JSON.parse(await readFile(process.argv[2], 'utf8'));
const values = {
 NEXT_PUBLIC_SUPABASE_URL: assertLocalDatabase(status.API_URL),
 NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
 SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
};
if (Object.values(values).some(v => typeof v !== 'string' || !v || /[\r\n]/.test(v))) throw new Error('Estado local incompleto');
await writeFile('.env.test', Object.entries(values).map(([k,v]) => k+'='+v).join('\n')+'\n', { mode: 0o600 });
