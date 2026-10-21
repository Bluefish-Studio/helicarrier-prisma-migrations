import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { runPrisma } from '../scripts/prisma-cli.mjs';
import { assertRecoverable, inspectState, failedMigration, expectedTitles } from '../scripts/inspect-state.mjs';

test('transactional migration failure, guarded recovery, and compatible expansion', { timeout: 120000 }, async t => {
  const connectionString = process.env.TEST_DATABASE_URL;
  assert.ok(connectionString, 'Set TEST_DATABASE_URL to the isolated local test database.');
  let target;
  try { target = new URL(connectionString); } catch { assert.fail('Invalid test database configuration.'); }
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Tests require a loopback database.');
  assert.equal(target.pathname, '/helicarrier_prisma_guide', 'Tests require the dedicated disposable database.');
  assert.ok(!target.search || target.search === '?schema=public', 'Tests require the public schema without extra URL settings.');
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
  try { await client.connect(); } catch { assert.fail('Cannot connect to the isolated test database.'); }
  let fixture; let ownsTables = false;
  try {
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    assert.equal(tables.rowCount, 0, 'Tests refuse a non-empty database; use a fresh disposable database.');
    await mkdir('.test-runs', { recursive: true });
    fixture = await mkdtemp(resolve('.test-runs/migrations-'));
    await mkdir(`${fixture}/prisma/migrations`, { recursive: true });
    await cp('prisma/migrations/20261021000100_baseline', `${fixture}/prisma/migrations/20261021000100_baseline`, { recursive: true });
    await cp('prisma/migrations/migration_lock.toml', `${fixture}/prisma/migrations/migration_lock.toml`);
    await cp('prisma.config.ts', `${fixture}/prisma.config.ts`);
    await cp('prisma/schema.prisma', `${fixture}/prisma/schema.prisma`);
    const options = { cwd: fixture, env: { ...process.env, DATABASE_URL: connectionString } };
    ownsTables = true;
    await t.test('baseline and repeat deployment preserve exactly three rows', async () => {
      assert.equal((await runPrisma(['migrate', 'deploy'], options)).status, 0);
      assert.equal((await runPrisma(['migrate', 'deploy'], options)).status, 0);
      const state = await inspectState(connectionString);
      assert.deepEqual(state.notes.map(n => n.title), expectedTitles);
      assert.equal(state.migrations.length, 1);
      assert.ok(state.migrations[0].finished);
    });
    await mkdir(`${fixture}/prisma/migrations/${failedMigration}`);
    const migration = `${fixture}/prisma/migrations/${failedMigration}/migration.sql`;
    await cp('test/fixtures/failed-summary.sql', migration);
    await t.test('required column fails atomically; old reads and records survive', async () => {
      const failed = await runPrisma(['migrate', 'deploy'], options);
      assert.notEqual(failed.status, 0);
      // Explicit SQL transactions can mask P3018 with PostgreSQL's aborted-transaction error.
      assert.ok(failed.notNullFailure || failed.transactionAborted, JSON.stringify(failed));
      assertRecoverable(await inspectState(connectionString));
      const repeated = await runPrisma(['migrate', 'deploy'], options);
      assert.notEqual(repeated.status, 0);
      assert.ok(repeated.codes.includes('P3009'));
    });
    await t.test('recovery rejects changed rows, schema, and migration history', async () => {
      const state = await inspectState(connectionString);
      assert.throws(() => assertRecoverable({ ...state, notes: state.notes.slice(1) }));
      assert.throws(() => assertRecoverable({ ...state, columns: [...state.columns, { column_name: 'summary', is_nullable: 'YES' }] }));
      assert.throws(() => assertRecoverable({ ...state, columns: state.columns.map(c => ({ ...c, is_nullable: 'YES' })) }));
      assert.throws(() => assertRecoverable({ ...state, migrations: [...state.migrations, { migration_name: 'unknown', finished: true, rolled_back: false }] }));
      assert.throws(() => assertRecoverable({ ...state, migrations: state.migrations.map(m => ({ ...m, finished: true })) }));
    });
    await cp('test/fixtures/add-summary.sql', migration);
    await t.test('corrected SQL stays blocked until the failed migration is resolved', async () => {
      const blocked = await runPrisma(['migrate', 'deploy'], options);
      assert.notEqual(blocked.status, 0);
      assert.ok(blocked.codes.includes('P3009'));
      assertRecoverable(await inspectState(connectionString));
      assert.equal((await runPrisma(['migrate', 'resolve', '--rolled-back', failedMigration], options)).status, 0);
      assert.equal((await runPrisma(['migrate', 'deploy'], options)).status, 0);
      assert.equal((await runPrisma(['migrate', 'deploy'], options)).status, 0);
    });
    await t.test('nullable expansion backfills existing rows and supports an old writer', async () => {
      const state = await inspectState(connectionString);
      assert.equal(state.columns.find(c => c.column_name === 'summary')?.is_nullable, 'YES');
      assert.deepEqual(state.notes.map(n => n.title), expectedTitles);
      const rows = await client.query('SELECT summary FROM guide_release_notes ORDER BY id');
      assert.deepEqual(rows.rows.map(row => row.summary), ['Deploy from a Git repository.', 'Connect PostgreSQL through a private reference.', 'Apply reviewed migrations before switching traffic.']);
      await client.query("INSERT INTO guide_release_notes (id, title) VALUES (4, 'Old application write')");
      const compatible = await client.query('SELECT summary FROM guide_release_notes WHERE id = 4');
      assert.equal(compatible.rows[0].summary, null);
      await client.query('DELETE FROM guide_release_notes WHERE id = 4');
      assert.throws(() => assertRecoverable(state));
      assert.deepEqual(state.migrations.map(m => [m.finished, m.rolled_back]), [[true, false], [false, true], [true, false]]);
    });
  } finally {
    // Only tables created by this run, in the strictly named loopback test DB.
    if (ownsTables) await client.query('DROP TABLE IF EXISTS guide_release_notes, _prisma_migrations');
    await client.end();
    if (fixture) await rm(fixture, { recursive: true, force: true });
  }
});
