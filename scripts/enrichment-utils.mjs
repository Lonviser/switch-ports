export const normalizeTitle = text => text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^a-z0-9]/g,'');
export function githubRepo(url) {
  const u = new URL(url);
  if (u.hostname !== 'github.com') return null;
  return u.pathname.split('/').filter(Boolean).slice(0,2).join('/').replace(/\.git$/, '');
}
export function imageScore(path) {
  if (!/\.(png|jpe?g|webp)$/i.test(path) || /(?:^|\/)(?:vendor|third.party|thirdparty|3rdparty|3rd_party|submodules|glm|node_modules|extern|external|test|tests|deps|lib|libraries)\//i.test(path)) return 0;
  const name = path.split('/').pop().toLowerCase();
  let score = /^icon0?\.(jpg|jpeg|png)$/.test(name) ? 110 : /^(?:switch[-_]?)?icon[-_]?(?:switch|nx)?\.(png|jpg|jpeg)$/.test(name) ? 105 : /^(cover|boxart|banner|header|hero|poster)\.(png|jpg|jpeg|webp)$/.test(name) ? 95 : /(?:^|[-_])(?:icon|boxart|cover)(?:[-_.])/i.test(name) ? 80 : /^logo\.(png|jpg|jpeg)$/.test(name) ? 65 : /screenshot|screen_shot|gameplay/i.test(path) ? 45 : 0;
  if (!score) return 0;
  if (/switch|libnx|nro/i.test(path)) score += 25;
  if (/steam\/(header|hero|portrait)/i.test(path)) score += 20;
  if (/android|windows|macos|osx|msvc|xcode|web|favicon|cmake|\.github|docs\/archive|tools\//i.test(path)) score -= 40;
  return score - path.split('/').length * 2;
}
