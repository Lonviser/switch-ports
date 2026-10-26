import { createHash } from 'node:crypto';

export const SOURCE = 'https://github.com/robzilla10001/SwitchPorts';
export const RAW_SOURCE = 'https://raw.githubusercontent.com/robzilla10001/SwitchPorts/main/README.md';
const clean = text => text.replace(/<[^>]*>/g, '').replace(/[*`]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[🟢🟠🔴]/gu, '').replace(/\s+/g, ' ').trim();
const link = text => text.match(/\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/)?.[1] || null;
const date = text => {
  const m = clean(text).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const value = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(value);
  return Number.isFinite(+d) && d.toISOString().startsWith(value) ? value : null;
};

export function parseReadme(markdown) {
  let category = '', headers = [], previousTitle = '', previousSystem = '';
  const entries = [];
  for (const line of markdown.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)) {
    const heading = line.match(/^###\s+(.+)/);
    if (heading) { category = clean(heading[1]); headers = []; previousTitle = ''; previousSystem = ''; continue; }
    if (!category || (!line.trim().startsWith('|') && !/Last Updated\?.*\|/.test(line))) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|\s*$/, '').split(/(?<!\\)\|/).map(s => s.trim());
    if (cells.every(c => /^:?-+:?$/.test(c))) continue;
    if (cells.some(c => /Last Updated\?/i.test(c))) { headers = cells.map(clean); continue; }
    if (!headers.length) continue;
    const discussionColumn = headers.indexOf('GBATemp Thread?');
    const firmwareColumn = headers.indexOf('Updated for FW 21+?');
    // Some upstream rows omit the empty discussion cell before the firmware value.
    // Only repair that recognizable layout; other column mismatches still fail.
    if (cells.length === headers.length - 1 && discussionColumn === headers.length - 2 &&
        firmwareColumn === headers.length - 1 && link(cells[headers.indexOf('Link')] || '') &&
        /^(?:\d{2}\/\d{2}\/\d{4}|nightly|\?{3}|n\/a)$/i.test(clean(cells[headers.indexOf('Last Updated?')] || '')) &&
        /^(?:yes|no|\?{3})$/i.test(clean(cells[discussionColumn]))) {
      cells.splice(discussionColumn, 0, '');
    }
    if (cells.length !== headers.length) throw new Error(`Unexpected columns in ${category}: ${line}`);
    const get = name => cells[headers.indexOf(name)] || '';
    const rawTitle = get('Game') || get('Title');
    const title = clean(rawTitle) || previousTitle;
    const url = link(get('Link'));
    if (!title || !url) throw new Error(`Missing title or project link: ${line}`);
    previousTitle = title;
    const system = clean(get('System')) || (category === 'Emulators' ? previousSystem : category);
    previousSystem = system;
    const status = rawTitle.includes('🟠') ? 'archived' : rawTitle.includes('🔴') ? 'inactive' : 'listed';
    const fw = get('Updated for FW 21+?');
    const id = createHash('sha256').update(`${category}|${title}|${url}`).digest('hex').slice(0, 16);
    entries.push({ id, title, category, system, kind: category === 'Emulators' ? 'emulator' : 'port', version: clean(get('Version')), updatedAt: date(get('Last Updated?')), dateLabel: clean(get('Last Updated?')), url, discussion: link(get('GBATemp Thread?')), firmware: /\byes\b/i.test(clean(fw)) ? 'yes' : /\bno\b/i.test(clean(fw)) ? 'no' : 'unknown', firmwareUrl: link(fw), status, markedRecent: rawTitle.includes('🟢') });
  }
  const unique = [...new Map(entries.map(e => [e.id, e])).values()];
  if (unique.length !== entries.length) throw new Error('Duplicate project rows in source');
  return unique;
}
