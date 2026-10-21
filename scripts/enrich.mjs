import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { githubRepo, imageScore, normalizeTitle } from './enrichment-utils.mjs';
import overrides from './artwork-overrides.mjs';

const catalog = JSON.parse(await readFile('public/data/catalog.json','utf8'));
let cache; try { cache = JSON.parse(await readFile('public/data/enrichment.json','utf8')); } catch { cache = { repositories:{}, images:{} }; }
const token = process.env.GITHUB_TOKEN;
const now = new Date().toISOString();
const get = async (url, json=true) => {
  const headers = {'User-Agent':'SwitchPorts-Library (https://github.com/Lonviser/switch-ports)'};
  if (url.startsWith('https://api.github.com/') && token) headers.Authorization = `Bearer ${token}`;
  let r;
  for(let attempt=0;attempt<3;attempt++){
    r=await fetch(url,{headers,signal:AbortSignal.timeout(25000)});
    if(r.status!==429 && r.status<500)break;
    if(attempt<2)await new Promise(resolve=>setTimeout(resolve,(attempt+1)*3000));
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (json) return r.json();
  if (!r.headers.get('content-type')?.startsWith('image/')) throw new Error('Not an image');
  const bytes = new Uint8Array(await r.arrayBuffer());
  if(bytes.length > 8_000_000) throw new Error('Oversize image');
  return bytes;
};
async function pool(values, fn, count=4) {
  let cursor=0;
  await Promise.all(Array.from({length:count},async()=>{while(cursor<values.length){const value=values[cursor++];await fn(value);}}));
}
await mkdir('public/assets/covers',{recursive:true});
const repos = [...new Set(catalog.entries.map(e=>githubRepo(e.url)).filter(Boolean))];
let freshStats=0;
await pool(repos,async repo=>{
  if (cache.repositories[repo]?.checkedAt && Date.now()-new Date(cache.repositories[repo].checkedAt)<20*3600000) return;
  try {
    const d = await get(`https://api.github.com/repos/${repo}`);
    cache.repositories[repo] = { stars:d.stargazers_count, defaultBranch:d.default_branch, checkedAt:now };
    freshStats++;
  } catch { /* A private/deleted repository keeps its last known statistics. */ }
});
console.log(`GitHub popularity: ${freshStats} refreshed, ${Object.keys(cache.repositories).length} available.`);
await writeFile('public/data/enrichment.json',JSON.stringify(cache,null,2)+'\n');
const trees=new Map();
const groups = [...new Map(catalog.entries.map(e=>[normalizeTitle(e.title),e])).values()];
let downloaded=0;
async function saveImage(entry,url,source) {
  const key=entry.artKey || normalizeTitle(entry.title);
  const bytes=await get(url,false);
  const info=await sharp(bytes).metadata();
  if(info.width<100 || info.height<70) throw new Error('Image too small');
  const file=createHash('sha256').update(url).digest('hex').slice(0,20)+'.webp';
  await sharp(bytes).rotate().resize({width:640,height:500,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toFile(`public/assets/covers/${file}`);
  cache.images[key]={path:`./assets/covers/${file}`,sourceUrl:url,source,checkedAt:now};
  downloaded++;
}
await pool(overrides,async override=>{
  const entry=catalog.entries.find(e=>e.title===override.title && (!override.category || e.category===override.category));
  if(!entry)return;
  const artKey=override.category ? entry.id : normalizeTitle(entry.title);
  const signature=createHash('sha256').update(JSON.stringify(override)).digest('hex').slice(0,16);
  if(cache.images[artKey]?.overrideSignature===signature)return;
  try{
    let url=override.url,source=override.source;
    if(override.steam){url=`https://cdn.akamai.steamstatic.com/steam/apps/${override.steam}/header.jpg`;source=`Steam · app ${override.steam}`;}
    if(override.wiki){
      const d=await get('https://en.wikipedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',prop:'pageimages',piprop:'thumbnail',pilicense:'any',pithumbsize:'600',titles:override.wiki,redirects:'1'}));
      url=Object.values(d.query?.pages||{}).find(p=>p.thumbnail)?.thumbnail.source.split('?')[0];source=`Wikipedia · ${override.wiki}`;
    }
    if(!url)throw new Error('No artwork on matched page');
    await saveImage({...entry,artKey},url,source);cache.images[artKey].overrideSignature=signature;
  }catch(error){console.log(`Artwork retry later: ${override.title}: ${error.message}`);}
},2);
await pool(groups,async entry=>{
  const key=normalizeTitle(entry.title);
  if(cache.images[entry.id])return;
  if(cache.images[key]?.path) {try{await access('public/'+cache.images[key].path.slice(2));return;}catch{}}
  const repo=githubRepo(entry.url);
  if(!repo) return;
  const branch=cache.repositories[repo]?.defaultBranch || 'HEAD';
  try {
    if(!trees.has(repo)) trees.set(repo,get(`https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`).catch(()=>null));
    const tree=await trees.get(repo);
    const candidates=(tree?.tree||[]).filter(f=>f.type==='blob' && f.size<8_000_000 && imageScore(f.path)>40).sort((a,b)=>imageScore(b.path)-imageScore(a.path)).slice(0,3);
    for(const candidate of candidates){
      try {await saveImage(entry,`https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${candidate.path.split('/').map(encodeURIComponent).join('/')}`,`GitHub · ${repo}`);return;}catch{}
    }
  } catch {}
},4);
console.log(`Project artwork downloaded: ${downloaded}.`);
// Exact Wikipedia article matches; no broad image search that can mix up sequels.
const aliases = {
  'The Legened of Zelda: Ocarina of Time':'The Legend of Zelda: Ocarina of Time', 'The Legend of Zelda: Wind Waker':'The Legend of Zelda: The Wind Waker', 'The Legend of Zelda: Wind Waker HD':'The Legend of Zelda: The Wind Waker HD', 'The Legend of Zelda: Oracle of Seasons / Oracle of Ages':'The Legend of Zelda: Oracle of Seasons and Oracle of Ages',
  'Pokemon Gen 1':'Pokémon Red, Blue, and Yellow', 'Pokemon Gen 2':'Pokémon Gold and Silver', 'The Simpson\'s Game':'The Simpsons Game', 'StarCraft64':'StarCraft', 'StarFox':'Star Fox 64',
  'The Room 3':'The Room Three', 'Need for Speed: Most Wanted':'Need for Speed: Most Wanted (2005 video game)', 'The Legend of Zelda: Link\'s Awakening DX':'The Legend of Zelda: Link\'s Awakening', 'Dragonball Z: Tenkaichi Budokai 3':'Dragon Ball Z: Budokai Tenkaichi 3',
  'Sonic 2006':'Sonic the Hedgehog (2006 video game)', 'Sonic The Hedgehog (2006)':'Sonic the Hedgehog (2006 video game)', 'Banjo Kazooie':'Banjo-Kazooie', 'Dark Knight Rises':'The Dark Knight Rises (video game)', 'Amazing Spider-Man 2':'The Amazing Spider-Man 2 (2014 video game)', 'Sonic & Sega All Stars Racing':'Sonic & Sega All-Stars Racing', 'Half Life':'Half-Life', 'Half Life 2':'Half-Life 2',
  'Alien vs. Predator: Gold':'Aliens versus Predator (1999 video game)', 'Elder Scrolls III Morrowind':'The Elder Scrolls III: Morrowind', 'Dethrace':'Carmageddon', 'Captain Claw':'Claw (video game)', 'Transport Tycoon Deluxe':'Transport Tycoon', 'Space Cadet':'3D Pinball for Windows', 'Doom':'Doom (1993 video game)', 'Diablo':'Diablo (video game)', 'XCOM':'UFO: Enemy Unknown', 'Outrun 2006: Coast 2 Coast':'OutRun 2006: Coast 2 Coast',
};
const missing=groups.filter(e=>!cache.images[e.id] && !cache.images[normalizeTitle(e.title)]);
await pool(missing,async entry=>{
  const titles=aliases[entry.title] ? [aliases[entry.title]] : [`${entry.title} (video game)`,entry.title];
  try{
    const data=await get('https://en.wikipedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',prop:'pageimages|pageprops|categories',cllimit:'max',piprop:'thumbnail',pilicense:'any',pithumbsize:'600',redirects:'1',titles:titles.join('|')}));
    for(const page of Object.values(data.query?.pages||{})){
      const relevant=page.categories?.some(c=>/video games|video game|emulat|game engine|gaming software/i.test(c.title));
      if(relevant && page.thumbnail?.source && !('disambiguation' in (page.pageprops||{}))){try{await saveImage(entry,page.thumbnail.source.split('?')[0],`Wikipedia · ${page.title}`);return;}catch{}}
    }
  }catch{}
},3);
cache.checkedAt=now;
await writeFile('public/data/enrichment.json',JSON.stringify(cache,null,2)+'\n');
const covered=catalog.entries.filter(e=>cache.images[e.id] || cache.images[normalizeTitle(e.title)]).length;
console.log(`Artwork coverage: ${covered}/${catalog.entries.length}. Missing: ${catalog.entries.filter(e=>!cache.images[e.id] && !cache.images[normalizeTitle(e.title)]).map(e=>e.title).join(', ')}`);
