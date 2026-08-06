// test/helpers/bot.js
// Shared scripted-bot driver, factored out of the original inline loop in
// playthrough.test.js so other tests (e.g. harness.test.js) can run a full
// progression without duplicating the policy.
//
// botStep(s, opts) performs one policy step (no tick). opts.degrade, when
// true, additionally toggles the degradation routine on once it's available
// (era >= 3) and not already on — needed by tests that must observe the
// 'degradeFirst' hint, which the baseline playthrough policy never triggers.
import { ACTIONS } from '../../game/js/engine/actions.js';
import { tick } from '../../game/js/engine/tick.js';

export function botStep(s, opts = {}) {
  if (s.compacting === 0 && s.stale > 70 && s.bufferUnlocked) ACTIONS.compactStart(s);
  ACTIONS.processToken(s);
  if (s.cycles >= 20 && s.tools < 1) ACTIONS.buyTool(s);
  if (s.cycles >= 10) ACTIONS.buyLoop(s);
  if (opts.degrade && s.era >= 3 && !s.degrade) ACTIONS.toggleDegrade(s);
  if (s.era === 4 && s.reclaimPool > 0) ACTIONS.reclaim(s);
  if (s.phase === 'crash') ACTIONS.advanceCrash(s);
}

// Runs botStep + tick until phase reaches 'teaser' or maxSteps is hit.
// Mirrors the exact loop shape used by playthrough.test.js.
export function runPlaythrough(s, opts = {}, maxSteps = 400000) {
  let guard = 0;
  while (s.phase !== 'teaser' && guard++ < maxSteps) {
    botStep(s, opts);
    tick(s);
  }
  return s;
}
