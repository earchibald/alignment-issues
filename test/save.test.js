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

test('offlineCatchUp advances ticks and caps the step count', () => {
  const s = createState(9);
  offlineCatchUp(s, 60_000);            // 5 min → 300 ticks
  assert.equal(s.tick, 300);
  const s2 = createState(9);
  offlineCatchUp(s2, 1000 * 60 * 60 * 24); // a day → capped
  assert.equal(s2.tick, 10000);
});
