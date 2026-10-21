import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReadme } from '../scripts/parser.mjs';
const header = '| Game | Version | Last Updated? | Link | GBATemp Thread? | Updated for FW 21+? |\n| --- | --- | --- | --- | --- | --- |';
test('preserves alternate ports, dates, source statuses and firmware links', () => {
  const rows = parseReadme(`### PC\n${header}\n| 🟠 Game A | *1.2* | 20/10/2026 | [dev](https://github.com/a/b/tree/switch) | | [Yes](https://github.com/a/fw) |\n| | 2.0 | ??? | [fork](https://github.com/c/d) | | No |\n| 🔴 Old | n/a | 31/02/2026 | [web](https://example.com) | | ??? |`);
  assert.equal(rows.length, 3); assert.equal(rows[0].status, 'archived'); assert.equal(rows[0].updatedAt, '2026-10-20'); assert.equal(rows[0].firmwareUrl, 'https://github.com/a/fw');
  assert.equal(rows[1].title, 'Game A'); assert.notEqual(rows[0].id, rows[1].id); assert.equal(rows[1].updatedAt, null); assert.equal(rows[2].updatedAt, null);
});
test('emulator system inheritance and nightly versions', () => {
  const rows = parseReadme('### Emulators\n| System | Title | Version | Last Updated? | Link | GBATemp Thread? | Updated for FW 21+? |\n| --- | --- | --- | --- | --- | --- | --- |\n| PSP | First | *nightly* | *nightly* | [a](https://example.com/a) | | Yes |\n| | Second | 1 | 01/01/2026 | [b](https://example.com/b) | | No |');
  assert.equal(rows[1].system, 'PSP'); assert.equal(rows[0].kind, 'emulator'); assert.equal(rows[0].version, 'nightly');
});
test('fails closed on malformed tables instead of publishing incomplete data', () => {
  assert.throws(() => parseReadme(`### PC\n${header}\n| Missing | 1 |`), /columns/);
  assert.throws(() => parseReadme(`### PC\n${header}\n| No URL | 1 | ??? | none | | No |`), /link/);
});
test('ignores hidden tables and supports Markdown headers without a leading pipe', () => {
  const rows = parseReadme(`<!--### Hidden\n${header}\n| Fake | 1 | ??? | [x](https://example.com/fake) | | No | -->\n### PC\n${header.slice(2)}\n| Real | 1 | 01/10/2026 | [x](https://example.com/real) | | Yes |`);
  assert.equal(rows.length, 1); assert.equal(rows[0].category, 'PC'); assert.equal(rows[0].title, 'Real');
});
