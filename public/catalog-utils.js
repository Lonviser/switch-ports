export const imageKey = title => title.toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^a-z0-9]/g,'');
export function repositoryKey(url) { const u=new URL(url); return u.hostname==='github.com' ? u.pathname.split('/').filter(Boolean).slice(0,2).join('/').replace(/\.git$/,'') : null; }
export function compareProjects(a,b,sort='popular') {
  const dateOrder=(b.updatedAt || '').localeCompare(a.updatedAt || '') || a.title.localeCompare(b.title,'ru');
  if(sort==='popular') return (b.stars ?? -1)-(a.stars ?? -1) || dateOrder;
  if(sort==='title') return a.title.localeCompare(b.title,'ru') || dateOrder;
  if(sort==='oldest') return (a.updatedAt || '9999').localeCompare(b.updatedAt || '9999') || a.title.localeCompare(b.title,'ru');
  return dateOrder;
}
