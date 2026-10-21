import { inspectState, assertRecoverable, failedMigration } from './inspect-state.mjs';
import { runPrisma, reportFailure } from './prisma-cli.mjs';

// This deliberately handles only the exact disposable failure taught here.
// It is never part of the normal db:migrate command and is not a general repair tool.
try {
  assertRecoverable(await inspectState());
  console.log('Recovery preflight passed: original three rows intact; summary column absent; expected migration failed.');
  const result = await runPrisma(['migrate', 'resolve', '--rolled-back', failedMigration]);
  if (result.status !== 0) { reportFailure(result); process.exitCode = 1; }
  else console.log('Failed tutorial migration marked rolled back. Apply the reviewed correction next.');
} catch { console.error('Recovery refused. The database does not match the exact failed tutorial state. No migration was resolved.'); process.exitCode = 1; }
