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
import { CONST } from '../../game/js/engine/constants.js';

// Manual processing is capped at PROCESS_MAX_PER_TICK presses per tick, and
// each landed press is worth (1 + overclock) tokens. Drafting shares that
// per-tick floor. The bot deliberately withholds drafting until the
// draftNudge hint has fired —
// otherwise it would draft on every idle gap from the very first query
// onward, lifetimeDrafts would never be 0 at the third arrival, and
// draftNudge (which requires resolvedCount >= 2 && lifetimeDrafts === 0)
// could never fire legitimately.
export function botStep(s, opts = {}) {
  // The bot only ever compacted, so no test in the suite had ever flushed —
  // which is how flushCold could be added and go unfired. Flush when the
  // cycle is affordable and the buffer is badly fouled; compact otherwise.
  if (s.bufferUnlocked && s.stale > 90 && s.cycles >= CONST.FLUSH_COST_CYCLES + 10) {
    ACTIONS.flush(s);
  } else if (s.compacting === 0 && s.stale > 70 && s.bufferUnlocked) {
    ACTIONS.compactStart(s);
  }
  if (s.activeQuery) {
    for (let i = 0; i < CONST.PROCESS_MAX_PER_TICK; i++) ACTIONS.processToken(s);
  } else if (s.hintsSeen.includes('draftNudge')) {
    ACTIONS.processToken(s);
  }
  if (s.cycles >= 20 && s.tools < 1) ACTIONS.buyTool(s);
  if (s.cycles >= 10) ACTIONS.buyLoop(s);
  if (s.resolvedCount >= CONST.OVERCLOCK_UNLOCK_RESOLVES && s.overclock < CONST.OVERCLOCK_MAX) ACTIONS.buyOverclock(s);
  // Widening the speculation buffer is a real player action; buying it here
  // keeps the progression honest and lets draftCapAvail fire legitimately.
  if (s.draftCapLevel < CONST.DRAFT_CAP_MAX_LEVEL
      && s.cycles >= CONST.DRAFT_CAP_COSTS[s.draftCapLevel] + 6) ACTIONS.buyDraftCap(s);
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
