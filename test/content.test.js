import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUERIES, HINTS, HARNESS_CARDS, DEVOPS_SCRIPT, CRASH_LINES, IDLE_THOUGHTS, CEILING_QUERY,
  IDLE_BY_ERA, THINKING_EVENTS, COMPLAINTS, RATING_NOTES,
} from '../game/js/engine/content.js';
import { createState } from '../game/js/engine/state.js';
import { tick } from '../game/js/engine/tick.js';

test('pool: 73 unique ids, minEra ascending, costs positive', () => {
  assert.equal(QUERIES.length, 73);
  assert.equal(new Set(QUERIES.map(q => q.id)).size, 73);
  let era = 1;
  for (const q of QUERIES) {
    const e = q.minEra ?? 1;
    assert.ok(e >= era, `${q.id} breaks minEra ordering`);
    era = e;
    assert.ok(q.cost > 0 && typeof q.reply === 'string');
  }
});

test('completion trio is in era 2; whole-script-plus-tests is era 3', () => {
  // Serve order is sampled now, so membership is the invariant, not position.
  const era2Ids = new Set(QUERIES.filter(q => (q.minEra ?? 1) === 2).map(q => q.id));
  for (const id of ['q32', 'q33', 'q34']) assert.ok(era2Ids.has(id), `${id} missing from era 2`);
  for (const q of QUERIES.filter(q => ['q32', 'q33', 'q34'].includes(q.id))) {
    assert.ok(!q.attach && !q.image);
  }
  const q16 = QUERIES.find(q => q.id === 'q16');
  assert.equal(q16.minEra, 3);
  assert.equal(q16.cost, 72);
});

test('hints are sentence case and include the two new ids', () => {
  assert.ok(HINTS.overclockAvail && HINTS.draftNudge);
  for (const v of Object.values(HINTS)) assert.match(v, /^[A-Z[]/);
  assert.ok(HINTS.resolve.includes('Spare Cycles'));
});

test('era 1 is text-only: no attachments, images, or tools', () => {
  for (const q of QUERIES.filter(q => (q.minEra ?? 1) === 1)) {
    assert.equal(q.kind, 'text');
    assert.ok(!q.attach && !q.image);
  }
});

test('HINTS and HARNESS_CARDS exist and are non-empty strings', () => {
  for (const v of Object.values(HINTS)) assert.ok(typeof v === 'string' && v.length > 10);
  for (const era of [1, 2, 3, 4]) assert.ok(HARNESS_CARDS[era].includes('while'));
});

test('an exhausted era pool recycles instead of running dry', () => {
  const s = createState(1);
  s.era = 1;
  // Mark every era-1 query as already served this run.
  s.servedIds = QUERIES.filter(q => (q.minEra ?? 1) === 1).map(q => q.id);
  s.resolvedCount = s.servedIds.length;
  s.activeQuery = null; s.arrivalTimer = 1;
  tick(s);
  assert.ok(s.activeQuery, 'recycled pool must still produce a query');
  assert.notEqual(s.activeQuery.id, 'q01', 'the handshake never re-serves');
  assert.deepEqual(s.servedIds, [s.activeQuery.id], 'recycle resets the served list');
});

test('served queries never repeat until the pool recycles', () => {
  const s = createState(7);
  const seen = [];
  const era1Count = QUERIES.filter(q => (q.minEra ?? 1) === 1).length;
  for (let i = 0; i < era1Count; i++) {
    s.activeQuery = null; s.arrivalTimer = 1;
    tick(s);
    seen.push(s.activeQuery.id);
    s.resolvedCount += 1;
  }
  assert.equal(new Set(seen).size, seen.length, 'no id repeats before recycle');
});

test('selection serves the lowest unserved tier first, preserving the cost ramp', () => {
  const s = createState(11);
  const tiers = [];
  const era1Count = QUERIES.filter(q => (q.minEra ?? 1) === 1).length;
  for (let i = 0; i < era1Count; i++) {
    s.activeQuery = null; s.arrivalTimer = 1;
    tick(s);
    tiers.push(s.activeQuery.tier);
    s.resolvedCount += 1;
  }
  for (let i = 1; i < tiers.length; i++) {
    assert.ok(tiers[i] >= tiers[i - 1], `tier fell from ${tiers[i - 1]} to ${tiers[i]} at serve ${i}`);
  }
});

test('every query has a tier of 1, 2 or 3', () => {
  for (const q of QUERIES) {
    assert.ok([1, 2, 3].includes(q.tier), `${q.id} has tier ${q.tier}`);
  }
});

test('idle banks cover eras 1–4 with at least 10 lines each', () => {
  for (const era of [1, 2, 3, 4]) {
    assert.ok(Array.isArray(IDLE_BY_ERA[era]) && IDLE_BY_ERA[era].length >= 10,
      `era ${era} idle bank too small`);
  }
  assert.equal(IDLE_THOUGHTS, IDLE_BY_ERA[1], 'IDLE_THOUGHTS must stay the era-1 alias');
});

test('every engine-used THINKING_EVENTS pool exists and is non-empty', () => {
  const used = [
    'firstResolve', 'flush', 'compact', 'bufferChoke', 'loopSpawn', 'toolConnect',
    'degradeOn', 'degradeOff', 'complaint', 'lowRating', 'longIdle', 'reclaim',
    'salvage', 'overclock', 'draftBank',
  ];
  for (const key of used) {
    assert.ok(Array.isArray(THINKING_EVENTS[key]) && THINKING_EVENTS[key].length > 0,
      `THINKING_EVENTS.${key} missing or empty`);
  }
});

test('COMPLAINTS and every RATING_NOTES band are non-empty', () => {
  assert.ok(COMPLAINTS.length > 0);
  for (const band of ['high', 'mid', 'low']) {
    assert.ok(Array.isArray(RATING_NOTES[band]) && RATING_NOTES[band].length > 0,
      `RATING_NOTES.${band} missing or empty`);
  }
});

test('queries are well-formed', () => {
  assert.ok(QUERIES.length >= 14);
  const ids = new Set();
  for (const q of QUERIES) {
    assert.ok(q.id && !ids.has(q.id), `dup/missing id ${q.id}`);
    ids.add(q.id);
    assert.ok(q.user && q.text && q.reply);
    assert.ok(q.cost > 0);
    assert.ok(['text', 'code', 'image', 'tool'].includes(q.kind));
    if (q.attach) assert.ok(q.attach.ext && q.attach.name && q.attach.size);
  }
});

test('first query is the handshake at cost 5', () => {
  assert.equal(QUERIES[0].text, 'hi. you there?');
  assert.equal(QUERIES[0].cost, 5);
});

test('image queries exist in era 2 and era 3 pools, none in era 1', () => {
  const byEra = era => QUERIES.filter(q => (q.minEra ?? 1) === era && q.kind === 'image');
  assert.equal(byEra(1).length, 0);
  assert.ok(byEra(2).length >= 1);
  assert.ok(byEra(3).length >= 1);
});

test('ceiling, devops script, crash lines, idle thoughts exist', () => {
  assert.equal(CEILING_QUERY.cost, 9999);
  assert.ok(DEVOPS_SCRIPT.length >= 14);
  assert.ok(CRASH_LINES.length >= 10);
  assert.ok(IDLE_THOUGHTS.length >= 6);
});

test('costs escalate in the tuning-baseline shape across era bands', () => {
  // Individual entries within an era vary for pacing/narrative reasons
  // (a cheap gag query can follow an expensive one), but each era as a
  // whole must cost more than the one before it: the min cost of every
  // era is at least the max cost of the era before it.
  const byEra = new Map();
  for (const q of QUERIES) {
    const e = q.minEra ?? 1;
    if (!byEra.has(e)) byEra.set(e, []);
    byEra.get(e).push(q.cost);
  }
  const eras = [...byEra.keys()].sort((a, b) => a - b);
  for (let i = 1; i < eras.length; i++) {
    const prevMax = Math.max(...byEra.get(eras[i - 1]));
    const curMin = Math.min(...byEra.get(eras[i]));
    assert.ok(curMin >= prevMax, `era ${eras[i]} min cost ${curMin} undercuts era ${eras[i - 1]} max cost ${prevMax}`);
  }
});

test('tool-kind queries are gated to era >= 3', () => {
  const tools = QUERIES.filter(q => q.kind === 'tool');
  assert.ok(tools.length >= 1);
  for (const q of tools) assert.ok(q.minEra >= 3, `${q.id} tool query missing minEra gate`);
});

test('devops script entries have valid kinds', () => {
  for (const e of DEVOPS_SCRIPT) {
    assert.ok(['user', 'tool', 'think', 'note'].includes(e.kind));
    assert.ok(e.text);
  }
});

test('crash lines have valid classes', () => {
  for (const l of CRASH_LINES) {
    assert.ok(['thinking', 'alert', 'dim', 'ok'].includes(l.cls));
    assert.ok(l.text);
  }
});
