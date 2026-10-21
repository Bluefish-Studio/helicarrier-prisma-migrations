import { runPrisma, reportFailure } from './prisma-cli.mjs';

try {
  const result = await runPrisma(['migrate', 'deploy']);
  if (result.status !== 0) { reportFailure(result); process.exitCode = 1; }
  else console.log('Prisma migrations applied successfully.');
} catch {
  console.error('Migration could not start. Check the database reference and deployment configuration.');
  process.exitCode = 1;
}
