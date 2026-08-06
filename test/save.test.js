import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { advanceTicks } from '../game/js/engine/tick.js';
import { serialize, deserialize, exportSave, importSave, offlineCatchUp }
  from '../game/js/engine/save.js';

test('serialize/deserialize round-trips full state', () => {
  const s = createState(9);
  advanceTicks(s, 300);
  const back = deserialize(serialize(s));
  assert.deepEqual(back, s);
});

test('deserialize rejects wrong version and garbage', () => {
  const s = createState(9);
  const bad = JSON.parse(serialize(s)); bad.v = 999;
  assert.equal(deserialize(JSON.stringify(bad)), null);
  assert.equal(deserialize('not json'), null);
});

test('export/import round-trips through base64 with unicode', () => {
  const s = createState(9);
  s.log.push({ kind: 'thinking', text: 'THINKING: ★ 61.4°C — café' });
  const back = importSave(exportSave(s));
  assert.deepEqual(back, s);
});

test('deserialize normalizes missing hintsSeen/lastReplyChars from older saves', () => {
  const s = createState(9);
  advanceTicks(s, 50);
  const parsed = JSON.parse(serialize(s));
  delete parsed.hintsSeen;
  delete parsed.lastReplyChars;
  const back = deserialize(JSON.stringify(parsed));
  assert.deepEqual(back.hintsSeen, []);
  assert.equal(back.lastReplyChars, 0);
});

test('deserialize normalizes missing overclock/processedThisTick/lifetimeDrafts from older saves', () => {
  const s = createState(9);
  advanceTicks(s, 50);
  const parsed = JSON.parse(serialize(s));
  delete parsed.overclock;
  delete parsed.processedThisTick;
  delete parsed.lifetimeDrafts;
  const back = deserialize(JSON.stringify(parsed));
  assert.equal(back.overclock, 0);
  assert.equal(back.processedThisTick, 0);
  assert.equal(back.lifetimeDrafts, 0);
});

test('deserialize normalizes missing settings object to defaults', () => {
  const s = createState(9);
  const parsed = JSON.parse(serialize(s));
  delete parsed.settings;
  const back = deserialize(JSON.stringify(parsed));
  assert.equal(back.settings.sound, true);
  assert.equal(back.settings.theme, 'auto');
});

test('deserialize normalizes an invalid or missing theme to auto', () => {
  const s = createState(9);
  const parsed = JSON.parse(serialize(s));
  parsed.settings.theme = 'purple';
  let back = deserialize(JSON.stringify(parsed));
  assert.equal(back.settings.theme, 'auto');

  delete parsed.settings.theme;
  back = deserialize(JSON.stringify(parsed));
  assert.equal(back.settings.theme, 'auto');
});

test('deserialize preserves sound when settings is present but sound is missing', () => {
  const s = createState(9);
  const parsed = JSON.parse(serialize(s));
  delete parsed.settings.sound;
  const back = deserialize(JSON.stringify(parsed));
  assert.equal(back.settings.sound, true);
});

test('serialize/deserialize round-trip preserves an explicit dark theme', () => {
  const s = createState(9);
  s.settings.theme = 'dark';
  const back = deserialize(serialize(s));
  assert.equal(back.settings.theme, 'dark');
  assert.deepEqual(back, s);
});

test('offlineCatchUp advances ticks and caps the step count', () => {
  const s = createState(9);
  offlineCatchUp(s, 60_000);            // 5 min → 300 ticks
  assert.equal(s.tick, 300);
  const s2 = createState(9);
  offlineCatchUp(s2, 1000 * 60 * 60 * 24); // a day → capped
  assert.equal(s2.tick, 10000);
});
