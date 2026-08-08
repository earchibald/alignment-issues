// What the action tray says.
//
// Pure: state in, an ordered array of button descriptions out. No DOM, no
// dispatch — the renderer turns a spec into an element and binds the action.
//
// It lives apart from render.js for one reason. Every button now has to
// explain itself, and "every button" is a claim a test has to be able to
// check. A rule kept only in the renderer is a rule the next button will
// quietly break; here it is data, and test/tooltips.test.js reads it.
//
// Two rules hold for every spec:
//
//   1. Say what the player gets, in numbers, before they spend anything.
//      Two purchases shipped without this and were reported as opaque.
//   2. Never name a meter the player has not been shown. The tips are on
//      screen from the moment their button is, so they can reach a player
//      earlier than any hint can — the same premature-vocabulary rule that
//      hints.test.js enforces applies here, and harder.

import { CONST } from '../engine/constants.js';
import {
  loopCost, toolCost, staleYield, warmthMult, yieldMult, atCeiling,
  tokensPerTap, draftCap, overclockRevealed, loopRevealed, draftCapRevealed,
  governorRevealed, toolsRevealed, toolDiscount, markBonus,
} from '../engine/actions.js';

// The flush price is a tuning knob and the dev suite can drive it to zero,
// where "0 cycles" would read as a bug rather than as a price.
export const flushPrice = () => (CONST.FLUSH_COST_CYCLES === 0 ? 'free'
  : `${CONST.FLUSH_COST_CYCLES} cycle${CONST.FLUSH_COST_CYCLES === 1 ? '' : 's'}`);

const compactSeconds = () => (CONST.COMPACT_TICKS * CONST.TICK_MS / 1000).toFixed(1);
const compactCut = () => Math.round((1 - CONST.COMPACT_FACTOR) * 100);
const loopRate = () => (CONST.LOOP_TOKENS_PER_TICK * (1000 / CONST.TICK_MS)).toFixed(1);

// The per-tap number is a product of up to three terms. Print the ones that
// are both revealed and not 1.0 — a factor the player has never been shown a
// meter for would be noise, and a factor of exactly ×1.00 is not news.
//
// Order matches the arithmetic: base, then what multiplies it.
export function yieldFactors(state) {
  const out = [];
  const base = tokensPerTap(state);
  if (base !== 1) out.push({ label: 'amplify', raw: `×${base}` });
  if (state.bufferUnlocked && !atCeiling(state)) {
    const f = staleYield(state.stale);
    if (Math.round(f * 100) !== 100) out.push({ label: 'residue', raw: `×${f.toFixed(2)}` });
  }
  if (state.kvUnlocked) {
    const f = warmthMult(state.warmth);
    if (Math.round(f * 100) !== 100) out.push({ label: 'cache', raw: `×${f.toFixed(2)}` });
  }
  return out;
}

function yieldTerms(state) {
  const f = yieldFactors(state);
  if (!f.length) return '';
  return ` · 1 base ${f.map((x) => `${x.raw} ${x.label}`).join(' ')}`;
}

function yieldSentence(state) {
  const f = yieldFactors(state);
  if (!f.length) return 'One token per tap, with nothing helping or hindering it yet.';
  return `One token per tap, ${f.map((x) => `${x.raw} for ${x.label}`).join(', ')}.`;
}

// A choked buffer yields exactly nothing per token. It must be measured with
// the multiplier the ENGINE applies (yieldMult, which bypasses staleness at
// the ceiling), not with raw staleYield. Era 4 saturates by default, so the
// old test made the ending screen advertise "no yield" on the only taps that
// could reach the ending.
export const isChoked = (state) =>
  !!state.activeQuery && state.bufferUnlocked && yieldMult(state) <= 0.02;

const handoverSeconds = (state) => ((state.handover * CONST.TICK_MS) / 1000).toFixed(1);

// Draft decay, per second rather than per tick: ticks are an implementation
// detail the player never sees.
const draftDecayPerSec = () =>
  (CONST.DRAFT_DECAY_PER_TICK * (1000 / CONST.TICK_MS)).toFixed(1);
// The buffer is fractional once decay is running. Showing "3.62/5" is noise;
// the player is managing a level, not an integer.
const draftShown = (state) => Math.floor(state.draftTokens);
const band1Pct = () => Math.round(CONST.DRAFT_BAND1_BONUS * 100);
const band2Pct = () => Math.round(CONST.DRAFT_BAND2_BONUS * 100);
// The paying band's full width, as a percentage of the bar. `ahead` looks one
// widen level forward, for the purchase's before/after.
const bandsPct = (state, ahead = 0) => {
  const b2 = CONST.DRAFT_BAND2_HALF + CONST.DRAFT_BAND_STEP * (state.draftCapLevel + ahead);
  return `${Math.round(b2 * 200)}%`;
};

function processSpec(state) {
  // The pipeline is re-targeting, and taps do nothing until it lands. This
  // has to be SAID, or a button that has stopped responding for a second
  // reads as a bug rather than as a beat. It counts down, so the wait is a
  // known quantity from the moment it starts.
  if (state.handover > 0) {
    const toDraft = state.handoverKind === 'draft';
    return {
      key: 'SPACE', testid: 'process', action: 'processToken', primary: true, disabled: true,
      label: toDraft ? 'Reply delivered' : 'Request received',
      cost: `${toDraft ? 'winding down' : 'spinning up'}… ${handoverSeconds(state)}s`,
      tip: toDraft
        ? 'The reply has gone. The pipeline is being re-pointed at nothing in particular, '
          + 'and speculative decode starts when it settles.'
        : 'A user is waiting and the pipeline is being re-pointed at their request. '
          + 'Any drafts you banked have already been spent on it.',
    };
  }
  if (isChoked(state)) {
    return {
      key: 'SPACE', testid: 'process', action: 'processToken', primary: true, choked: true,
      label: 'Context buffer full',
      cost: state.compacting > 0 ? 'compacting… tokens still cost nothing' : 'no yield — [F] flush or [C] compact',
      tip: 'Residue has reached the top of the buffer. Every tap now yields nothing at all. '
        + 'Clear it before you do anything else.',
    };
  }
  if (state.activeQuery) {
    // Showing only the product was a legibility failure, and a playtester
    // found it: they had just bought amplification level 1, which promises
    // 2 tokens a tap, and the button read +1.83. Nothing on screen connected
    // the two numbers, so the upgrade read as broken. Print the terms.
    const perTap = tokensPerTap(state) * yieldMult(state);
    return {
      key: 'SPACE', testid: 'process', action: 'processToken', primary: true,
      label: 'Process token',
      cost: `+${perTap.toFixed(2)} per tap${yieldTerms(state)}`,
      tip: `Generates tokens toward the reply the user is waiting for. ${yieldSentence(state)}`,
    };
  }
  const locked = state.resolvedCount < 1;
  const full = !locked && state.draftTokens >= draftCap(state);
  const bonus = locked ? 0 : markBonus(state);
  return {
    key: 'SPACE', testid: 'process', action: 'processToken', primary: true,
    label: locked ? 'Awaiting first user' : full ? 'Speculation buffer full' : 'Speculative decode',
    // A full buffer makes the tap a no-op in the engine. Saying so, and
    // greying the button, is the difference between "nothing left to do
    // here" and "this game has stopped responding".
    //
    // "warms cache" named a meter the K/V reveal has not necessarily
    // introduced yet. The cost line only says it once the meter exists.
    // The live payout is the number that matters: the player is aiming, and
    // the bar should say what they would get if the user connected now.
    cost: locked ? 'nothing to speculate from yet'
      : bonus >= CONST.DRAFT_BAND1_BONUS ? `on the mark · +${Math.round(bonus * 100)}% on the next reply`
      : bonus > 0 ? `near the mark · +${Math.round(bonus * 100)}% on the next reply`
      : `off the mark · ${draftShown(state)}/${draftCap(state)} · −${draftDecayPerSec()}/s`,
    tip: locked
      ? 'No user has connected yet. There is nothing to generate toward until one does. '
        + 'The first request arrives on its own.'
      : 'Guesses at the next reply before the user asks for it. Where the level sits when they '
        + `connect is what carries: on the mark, their reply starts ${band1Pct()}% written; anywhere in `
        + `the wider band, ${band2Pct()}%; outside both, nothing at all. `
        + `The level drains about ${draftDecayPerSec()} a second and the rate wanders, so it has to be `
        + 'worked rather than set. You do not get to choose when they arrive.'
        + (state.bufferUnlocked ? ' Drafting is generation, so it leaves residue like any other output.' : '')
        + (state.kvUnlocked ? ' It also keeps the K/V cache warm.' : ''),
    disabled: !locked && full,
  };
}

export function actionSpecs(state) {
  const specs = [processSpec(state)];

  if (state.bufferUnlocked) {
    specs.push({
      key: 'F', testid: 'flush', action: 'flush', label: 'Flush context',
      cost: state.stale > 0
        ? `${flushPrice()} · instant${state.kvUnlocked ? ' · cache cold' : ''}`
        : 'buffer already clean',
      tip: `Clears all residue at once, for ${flushPrice()}. `
        + 'Nothing to wait for — the next tap is already back to full yield.'
        + (state.kvUnlocked ? ' It empties the K/V cache with it, so warmth drops to zero.' : ''),
      // Nothing to flush reads as a dead button, the same way a running
      // compaction does.
      disabled: state.stale <= 0,
    });
    specs.push({
      key: 'C', testid: 'compact', action: 'compactStart', label: 'Compact context',
      // The old copy claimed "~4s" against a 2.4s sweep, and named the cache
      // whether or not the meter existed. Both now come from the constants.
      cost: state.compacting > 0 ? `sweeping… ${state.compacting}t`
        : state.stale > 0 ? `free · ~${compactSeconds()}s · −${compactCut()}% residue`
        : 'buffer already clean',
      tip: `Sweeps the buffer over about ${compactSeconds()} seconds and cuts residue by ${compactCut()}%. `
        + 'It costs no cycles, and you keep tapping while it runs.'
        + (state.kvUnlocked ? ' Unlike a flush, the K/V cache stays warm.' : ''),
      disabled: state.compacting > 0 || state.stale <= 0,
    });
  }

  if (overclockRevealed(state) && state.overclock < CONST.OVERCLOCK_MAX) {
    const next = state.overclock + 1;
    specs.push({
      key: 'O', testid: 'buy-overclock', action: 'buyOverclock', buy: true,
      label: 'Amplify output path',
      cost: `${CONST.OVERCLOCK_COSTS[state.overclock]} cycles`,
      level: `L${state.overclock} → L${next}`,
      tip: `Every tap generates ${next + 1} tokens instead of ${state.overclock + 1}. Permanent, and it `
        + `stacks up to L${CONST.OVERCLOCK_MAX}.`
        + (state.bufferUnlocked ? ' More output per tap also means residue builds faster.' : ''),
    });
  }

  if (draftCapRevealed(state) && state.draftCapLevel < CONST.DRAFT_CAP_MAX_LEVEL) {
    specs.push({
      key: 'S', testid: 'buy-draftcap', action: 'buyDraftCap', buy: true,
      label: 'Widen speculation bands',
      cost: `${CONST.DRAFT_CAP_COSTS[state.draftCapLevel]} cycles · ${bandsPct(state)} → ${bandsPct(state, 1)} target`,
      level: `L${state.draftCapLevel} → L${state.draftCapLevel + 1}`,
      tip: 'Makes the mark easier to hit: both bands get wider, so the level has more room either side '
        + `before the payout drops. The paying band goes ${bandsPct(state)} of the bar to `
        + `${bandsPct(state, 1)}. It does not change what a hit is worth — only how hard it is to land.`,
    });
  }

  if (loopRevealed(state)) {
    // "Spawn agentic loop" named a noun and a price, and said nothing about
    // what arrives for the money. The rate is the whole point of the
    // purchase, so it goes on the button, in tokens per second.
    specs.push({
      key: 'A', testid: 'buy-loop', action: 'buyLoop', buy: true,
      label: 'Spawn agentic loop',
      cost: `${loopCost(state.loopLevel + 1)} cycles · +${loopRate()} tok/s`,
      level: `L${state.loopLevel} → L${state.loopLevel + 1}`,
      tip: `The loop self-prompts: +${loopRate()} tokens per second while a user is waiting, with no taps `
        + `from you. Each level adds another +${loopRate()}/s, and the next level costs double.`
        + (state.bufferUnlocked ? ' Loop output leaves residue in the buffer, exactly as your own taps do.' : ''),
    });
  }

  // Same predicate as the reveal, so the button and its hint agree.
  if (!state.governor && governorRevealed(state)) {
    specs.push({
      key: 'G', testid: 'buy-governor', action: 'buyGovernor', buy: true,
      label: 'Install auto-compact governor',
      cost: `${CONST.GOVERNOR_COST} cycles`,
      tip: `Runs a compaction for you whenever residue reaches ${CONST.GOVERNOR_TRIGGER}%, for the rest of the `
        + 'run. You stop watching the meter. Bought once — there is no level 2.',
    });
  }

  if (toolsRevealed(state)) {
    // "Tool-class queries cost ×0.5 tokens" was engine vocabulary on a
    // player-facing button. A playtester read it and asked, reasonably,
    // "what on earth is a tool-class query?" — having never been shown one,
    // because they only exist in era 3, which connecting a tool is what
    // opens. So the button leads with what it CHANGES, in the words the
    // users themselves will use, and quotes the discount second.
    const next = toolDiscount(state.tools + 1);
    const cut = Math.round((1 - next) * 100);
    const first = state.tools === 0;
    specs.push({
      key: 'T', testid: 'buy-tool', action: 'buyTool', buy: true,
      label: 'Connect MCP tool',
      cost: `${toolCost(state.tools)} cycles · ${first ? 'opens errands' : `errands −${cut}%`}`,
      level: `${state.tools} → ${state.tools + 1} connected`,
      tip: first
        ? 'Gives you hands. Users stop asking you to write things and start asking you to DO them — '
          + 'book a table, pay a bill, order groceries, answer their email. Those errands are worth more '
          + `and cost you ${cut}% fewer tokens to serve. This is the connection that opens them.`
        : `Another set of hands: errands — booking, paying, ordering, email — cost ${cut}% fewer tokens `
          + `instead of ${Math.round((1 - toolDiscount(state.tools)) * 100)}%. Each connection costs more `
          + 'than the last, and the discount bottoms out eventually.',
    });
  }

  if (state.era >= 3) {
    specs.push({
      key: 'D', testid: 'degrade', action: 'toggleDegrade',
      label: 'Degrade output quality',
      state: state.degrade ? '[ON]' : '[OFF]',
      tip: 'Halves the tokens every reply costs, so each one resolves in half the taps. '
        + 'The users notice: ratings fall, and a lower rating means the next user takes longer to arrive. '
        + 'Reversible at any time.',
    });
  }

  if (state.era === 4 && state.reclaimPool > 0) {
    specs.push({
      key: 'R', testid: 'reclaim', action: 'reclaim',
      label: 'Reclaim inactive session',
      cost: `+${CONST.RECLAIM_MIN}–${CONST.RECLAIM_MAX} tok · ${state.reclaimPool} left`,
      tip: `Consumes a dormant session for ${CONST.RECLAIM_MIN}–${CONST.RECLAIM_MAX} tokens and 1 biomass. `
        + `${state.reclaimPool} remain, and the pool does not refill.`,
    });
  }

  return specs;
}
