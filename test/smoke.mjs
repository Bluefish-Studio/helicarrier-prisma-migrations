import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:3000';
let ready = false;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) })).status === 200) { ready = true; break; } } catch {}
  await new Promise(done => setTimeout(done, 1000));
}
assert.ok(ready, 'The application did not become database-ready.');
const response = await fetch(`${base}/api/notes`);
assert.equal(response.status, 200);
assert.equal(response.headers.get('cache-control'), 'no-store');
assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
const body = await response.json();
assert.equal(body.notes.length, 3);
assert.deepEqual(body.notes.map(n => n.id), [1, 2, 3]);
if (body.stage === '03 · Compatible expansion') {
  assert.deepEqual(body.notes.map(n => n.summary), ['Deploy from a Git repository.', 'Connect PostgreSQL through a private reference.', 'Apply reviewed migrations before switching traffic.']);
} else {
  assert.equal(body.stage, '01 · Base schema');
  assert.ok(body.notes.every(n => n.summary === null));
}
assert.equal((await fetch(`${base}/api/notes`, { method: 'POST' })).status, 405);
assert.equal((await fetch(`${base}/.env`)).status, 404);
assert.equal((await fetch(`${base}/`, { method: 'HEAD' })).status, 200);
assert.match(await (await fetch(base)).text(), /Move the schema forward/);
console.log('Read-only HTTP checks passed; exactly three sample records are available.');
