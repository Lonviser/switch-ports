// Optional one-time asset refresh. Original game artwork: Steam / respective owners.
import { writeFile, mkdir } from 'node:fs/promises';
const covers = { 'half-life':70, sonic:213610, torchlight:41500, 'street-fighter':45760, 'space-hulk':242570, flatout:2990, 'space-channel':71260, quake:2310, quake2:2320, doom:2280, duke:225140, wolfenstein:9010, jedi:6030, 'dark-alliance':1695830, 'max-payne':12140, rct2:285330, 'stone-story':603390 };
await mkdir('public/assets', { recursive:true });
for (const [name,id] of Object.entries(covers)) {
  const response = await fetch(`https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`, { signal:AbortSignal.timeout(20000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`${name}: HTTP ${response.status}`);
  await writeFile(`public/assets/${name}.jpg`,new Uint8Array(await response.arrayBuffer()));
  console.log(`Saved ${name}.jpg`);
}
