import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
const data = JSON.parse(await readFile('public/data/catalog.json', 'utf8'));
if (!data.entries.length || !data.checkedAt) throw new Error('Run npm run sync first');
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await writeFile('dist/.nojekyll', '');
console.log(`Built static site: ${data.entries.length} projects`);
