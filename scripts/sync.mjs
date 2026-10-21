import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseReadme, SOURCE, RAW_SOURCE } from './parser.mjs';

const path = new URL('../public/data/catalog.json', import.meta.url);
let previous = null;
try { previous = JSON.parse(await readFile(path, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
let response;
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    response = await fetch(RAW_SOURCE, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'SwitchPorts-Library/1.0', 'Cache-Control': 'no-cache' } });
    if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
    break;
  } catch (error) { if (attempt === 2) throw error; await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); }
}
const markdown = await response.text();
const entries = parseReadme(markdown);
if (entries.length < 100 || (previous && entries.length < previous.entries.length * 0.8)) throw new Error('Source validation failed: unexpected catalogue size. Published data is preserved.');
if (new Set(entries.map(e => e.category)).size < 5) throw new Error('Source validation failed: missing categories');
const now = new Date().toISOString();
const old = new Map((previous?.entries || []).map(e => [e.id, e]));
const changes = [];
for (const entry of entries) {
  const before = old.get(entry.id);
  entry.firstSeenAt = before?.firstSeenAt || now;
  const changed = before && ['version', 'updatedAt', 'firmware', 'status'].some(k => entry[k] !== before[k]);
  entry.changedAt = changed ? now : before?.changedAt || null;
  if (previous && (!before || changed)) changes.push({ id: entry.id, title: entry.title, kind: before ? 'updated' : 'added', at: now, version: entry.version });
}
const hash = createHash('sha256').update(markdown).digest('hex');
const data = { schemaVersion: 1, source: SOURCE, sourceHash: hash, checkedAt: now, sourceChangedAt: previous?.sourceHash === hash ? previous.sourceChangedAt : now, schedule: '07:17 Europe/Minsk', entries, changes: [...changes, ...(previous?.changes || [])].slice(0, 200) };
await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
await writeFile(new URL(`${path.href}.tmp`), JSON.stringify(data, null, 2) + '\n');
await rename(new URL(`${path.href}.tmp`), path);
console.log(`Synced ${entries.length} projects in ${new Set(entries.map(e => e.category)).size} categories; ${changes.length} changes.`);
