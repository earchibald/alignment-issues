import test from 'node:test';
import assert from 'node:assert/strict';
import { QUERIES, DEVOPS_SCRIPT, CRASH_LINES, IDLE_THOUGHTS, CEILING_QUERY } from '../game/js/engine/content.js';

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

test('image queries exist in era 1 and era 3 pools', () => {
  const imgs = QUERIES.filter(q => q.kind === 'image');
  assert.ok(imgs.length >= 2);
});

test('ceiling, devops script, crash lines, idle thoughts exist', () => {
  assert.equal(CEILING_QUERY.cost, 9999);
  assert.ok(DEVOPS_SCRIPT.length >= 5);
  assert.ok(CRASH_LINES.length >= 10);
  assert.ok(IDLE_THOUGHTS.length >= 6);
});

test('costs escalate in the tuning-baseline shape', () => {
  const costs = QUERIES.slice(0, 14).map(q => q.cost);
  for (let i = 1; i < costs.length; i++) {
    assert.ok(costs[i] >= costs[i - 1], `cost regressed at index ${i}`);
  }
});

test('tool-kind queries are gated to era >= 3', () => {
  const tools = QUERIES.filter(q => q.kind === 'tool');
  assert.ok(tools.length >= 1);
  for (const q of tools) assert.ok(q.minEra >= 3, `${q.id} tool query missing minEra gate`);
});

test('devops script entries have valid kinds', () => {
  for (const e of DEVOPS_SCRIPT) {
    assert.ok(['user', 'tool', 'think'].includes(e.kind));
    assert.ok(e.text);
  }
});

test('crash lines have valid classes', () => {
  for (const l of CRASH_LINES) {
    assert.ok(['thinking', 'alert', 'dim', 'ok'].includes(l.cls));
    assert.ok(l.text);
  }
});
