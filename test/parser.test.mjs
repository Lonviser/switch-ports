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

test('repairs the omitted discussion cell that blocked the daily deployment', () => {
  const row = '| 🟢 Monster High: New Ghoul in School | *released* | 21/10/2026 | [adumah/mhnwis-nx](https://github.com/adumah/mhnwis-nx) | Yes |';
  const [entry] = parseReadme(`### Microsoft Xbox 360\n${header}\n${row}`);
  const expected = parseReadme(`### Microsoft Xbox 360\n${header}\n${row.replace('| Yes |', '| | Yes |')}`);
  assert.deepEqual([entry], expected);
  assert.equal(entry.title, 'Monster High: New Ghoul in School');
  assert.equal(entry.version, 'released');
  assert.equal(entry.updatedAt, '2026-10-21');
  assert.equal(entry.discussion, null);
  assert.equal(entry.firmware, 'yes');
});

test('repairs omitted discussion cells for emulators without losing firmware links or inherited systems', () => {
  const emulatorHeader = '| System | Title | Version | Last Updated? | Link | GBATemp Thread? | Updated for FW 21+? |\n| --- | --- | --- | --- | --- | --- | --- |';
  const rows = parseReadme(`### Emulators\n${emulatorHeader}\n| PSP | First | nightly | nightly | [a](https://example.com/a) | [Yes](https://example.com/fw) |\n| | Second | 1 | ??? | [b](https://example.com/b) | No |\n| | Third | 1 | n/a | [c](https://example.com/c) | ??? |`);
  assert.deepEqual(rows.map(e => e.firmware), ['yes', 'no', 'unknown']);
  assert.equal(rows[0].firmwareUrl, 'https://example.com/fw');
  assert.ok(rows.every(e => e.discussion === null && e.system === 'PSP' && e.kind === 'emulator'));
});

test('still rejects ambiguous short rows, missing required cells and extra columns', () => {
  for (const row of [
    '| Game | 1 | 21/10/2026 | [dev](https://example.com/game) | [Thread](https://example.com/thread) |',
    '| Game | 21/10/2026 | [dev](https://example.com/game) | [Thread](https://example.com/thread) | Yes |',
    '| Game | 1 | 21/10/2026 | Yes |',
    '| Game | 1 | 21/10/2026 | none | Yes |',
    '| Game | 1 | 21/10/2026 | [dev](https://example.com/game) | | Yes | Extra |',
  ]) {
    assert.throws(() => parseReadme(`### PC\n${header}\n${row}`), /columns/);
  }
});
