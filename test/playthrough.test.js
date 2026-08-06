// test/playthrough.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { runPlaythrough } from './helpers/bot.js';

test('a scripted bot completes Phase 1 from cold open to teaser in <5s wall clock', () => {
  const t0 = process.hrtime.bigint();
  const s = createState(1234);
  runPlaythrough(s);
  assert.equal(s.phase, 'teaser', `stuck: era ${s.era}, tick ${s.tick}`);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 5000, `took ${ms}ms`);
  // era milestones all visited
  assert.ok(s.lifetimeCycles > 0 && s.tools >= 1 && s.loopLevel >= 1 && s.biomass >= 1);
});

test('two runs with the same seed are identical', () => {
  const run = () => runPlaythrough(createState(777));
  assert.deepEqual(run(), run());
});
