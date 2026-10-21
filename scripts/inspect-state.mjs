import pg from 'pg';

export const failedMigration = '20261021000200_add_summary';
export const expectedTitles = ['Give the idea a home', 'Keep the data connected', 'Make the release repeatable'];
export async function inspectState(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('Database reference missing.');
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    const notes = await client.query('SELECT id, title FROM guide_release_notes ORDER BY id');
    const columns = await client.query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'guide_release_notes' ORDER BY ordinal_position");
    const history = await client.query('SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM _prisma_migrations ORDER BY started_at');
    return { notes: notes.rows, columns: columns.rows, migrations: history.rows };
  } finally { await client.end(); }
}

export function assertRecoverable(state) {
  const expected = expectedTitles.map((title, i) => ({ id: i + 1, title }));
  if (JSON.stringify(state.notes) !== JSON.stringify(expected)) throw new Error('Unexpected data; recovery refused.');
  if (state.columns.length !== 2 || state.columns.map(c => c.column_name).join(',') !== 'id,title') throw new Error('Unexpected schema; recovery refused.');
  if (state.columns.some(c => c.is_nullable !== 'NO')) throw new Error('Unexpected nullability; recovery refused.');
  const baseline = state.migrations.filter(m => m.migration_name === '20261021000100_baseline');
  if (baseline.length !== 1 || !baseline[0].finished || baseline[0].rolled_back || state.migrations.length !== 2) throw new Error('Unexpected migration history; recovery refused.');
  const failures = state.migrations.filter(m => !m.finished && !m.rolled_back);
  if (failures.length !== 1 || failures[0].migration_name !== failedMigration) throw new Error('Unexpected migration history; recovery refused.');
}
