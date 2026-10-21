import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

export async function runPrisma(args, { cwd = process.cwd(), env = process.env } = {}) {
  if (!env.DATABASE_URL) throw new Error('A private DATABASE_URL reference is required.');
  const child = spawn(process.execPath, [resolve('node_modules/prisma/build/index.js'), ...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    output += chunk.toString();
    if (output.length > 1024 * 1024) child.kill('SIGTERM');
  });
  const status = await new Promise((done, reject) => { child.on('error', reject); child.on('close', code => done(code)); });
  // Prisma CLI output can contain database locations. Publish only known codes.
  return { status, codes: [...new Set(output.match(/\bP\d{4}\b/g) || [])], notNullFailure: /23502|contains null values/.test(output), transactionAborted: /current transaction is aborted/.test(output) };
}

export function reportFailure(result) {
  const codes = result.codes.length ? ` (${result.codes.join(', ')})` : '';
  console.error(`Migration command failed${codes}.`);
  if (result.notNullFailure) console.error('The new required column cannot be added while existing rows have no value.');
  if (result.transactionAborted) console.error('PostgreSQL aborted the migration transaction. Inspect its SQL and the database state.');
  console.error('Inspect the schema and migration history before recovery. Connection details are omitted.');
}
