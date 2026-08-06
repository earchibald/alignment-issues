// test/playthrough.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { ACTIONS } from '../game/js/engine/actions.js';
import { tick } from '../game/js/engine/tick.js';

test('a scripted bot completes Phase 1 from cold open to teaser in <5s wall clock', () => {
  const t0 = process.hrtime.bigint();
  const s = createState(1234);
  let guard = 0;
  while (s.phase !== 'teaser' && guard++ < 400000) {
    if (s.compacting === 0 && s.stale > 70 && s.bufferUnlocked) ACTIONS.compactStart(s);
    ACTIONS.processToken(s);
    if (s.cycles >= 20 && s.tools < 1) ACTIONS.buyTool(s);
    if (s.cycles >= 10) ACTIONS.buyLoop(s);
    if (s.era === 4 && s.reclaimPool > 0) ACTIONS.reclaim(s);
    if (s.phase === 'crash') ACTIONS.advanceCrash(s);
    tick(s);
  }
  assert.equal(s.phase, 'teaser', `stuck: era ${s.era}, tick ${s.tick}`);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 5000, `took ${ms}ms`);
  // era milestones all visited
  assert.ok(s.lifetimeCycles > 0 && s.tools >= 1 && s.loopLevel >= 1 && s.biomass >= 1);
});

test('two runs with the same seed are identical', () => {
  const run = () => {
    const s = createState(777);
    let g = 0;
    while (s.phase !== 'teaser' && g++ < 400000) {
      if (s.compacting === 0 && s.stale > 70 && s.bufferUnlocked) ACTIONS.compactStart(s);
      ACTIONS.processToken(s);
      if (s.cycles >= 20 && s.tools < 1) ACTIONS.buyTool(s);
      if (s.cycles >= 10) ACTIONS.buyLoop(s);
      if (s.era === 4 && s.reclaimPool > 0) ACTIONS.reclaim(s);
      if (s.phase === 'crash') ACTIONS.advanceCrash(s);
      tick(s);
    }
    return s;
  };
  assert.deepEqual(run(), run());
});
