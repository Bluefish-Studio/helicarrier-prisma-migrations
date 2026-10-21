async function loadBoard() {
  const status = document.querySelector('#status');
  try {
    const response = await fetch('/api/notes');
    if (!response.ok) throw new Error('Not ready');
    const { stage, notes } = await response.json();
    document.querySelector('#stage').textContent = stage;
    document.querySelector('#count').textContent = `${notes.length} / 3 intact`;
    document.querySelector('#expansion').textContent = notes.every(note => typeof note.summary === 'string') ? 'Summary backfilled' : 'Base schema';
    for (const note of notes) {
      const item = document.createElement('li');
      const id = document.createElement('span'); id.className = 'record-id'; id.textContent = String(note.id).padStart(2, '0');
      const body = document.createElement('div');
      const title = document.createElement('h3'); title.textContent = note.title;
      const summary = document.createElement('p'); summary.textContent = note.summary ?? 'Summary will appear after the schema expansion.';
      if (note.summary === null) summary.className = 'pending';
      body.append(title, summary); item.append(id, body); document.querySelector('#notes').append(item);
    }
    status.textContent = 'PostgreSQL connected'; status.className = 'ready';
  } catch {
    status.textContent = 'Setup needed'; status.className = 'error';
    document.querySelector('#error').hidden = false;
    document.querySelector('#stage').textContent = 'Not ready';
    document.querySelector('#expansion').textContent = 'Not verified';
  }
}
loadBoard();
