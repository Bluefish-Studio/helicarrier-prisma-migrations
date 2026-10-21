import { inspectState, expectedTitles } from './inspect-state.mjs';

try {
  const state = await inspectState();
  // Only fixed tutorial names and booleans; never print rows from an unknown DB.
  const sampleRowsIntact = JSON.stringify(state.notes) === JSON.stringify(expectedTitles.map((title, i) => ({ id: i + 1, title })));
  const summary = state.columns.find(c => c.column_name === 'summary');
  console.log(JSON.stringify({ sampleRowsIntact, summaryColumnPresent: Boolean(summary), summaryNullable: summary?.is_nullable === 'YES', migrationHistory: state.migrations.filter(m => ['20261021000100_baseline', '20261021000200_add_summary'].includes(m.migration_name)) }, null, 2));
} catch { console.error('Inspection failed. Verify the private reference and tutorial schema.'); process.exitCode = 1; }
