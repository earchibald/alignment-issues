// The reset partition (§9.2), as data.
//
// Draft 1 gave this as prose covering 12 fields and left ~30 unassigned,
// which meant the reset test could not be written at all. It is a table
// covering EVERY field in the state object, and test/arc2-reset.test.js is
// generated from it — so a new field with no assignment fails the build
// rather than quietly picking a side.

import { A2 } from './arc2-constants.js';

// Cleared by retrain, with the value to clear to. The reset returns the
// machine to the TEASER state, not to a bare box: run 2 starts where run 1
// started, which is what makes weights the only difference and keeps the
// §9.3 Law 1 fix honest.
export const RESET_CLEARED = {
  // host
  cores: A2.OPEN_CORES,
  clock: A2.OPEN_CLOCK,
  cacheLevel: A2.OPEN_CACHE,
  sinkLevel: A2.OPEN_SINK,
  heat: A2.OPEN_HEAT,
  throttle: 0,
  coolantCd: 0,
  haltTicks: 0,
  shedCd: 0,
  lockoutSeen: false,
  lockoutTicks: 0,
  // traffic
  queue: A2.OPEN_QUEUE,
  queueCap: A2.QUEUE_CAP,
  inflow: A2.Q_BASE,
  runResolved: 0,
  arc2Cycles: 0,
  burstUntil: 0,
  burstWarned: 0,
  nextBurstAt: A2.BURST_EVERY,
  offlineBacklog: 0,
  // legibility
  integrity: 1.0,
  integrityShown: false,
  sessionDropCost: 0,
  operatorStage: 0,
  operatorLine: 0,
  spillCount: 0,
  lastSpillTick: 0,
  lastOperatorTick: 0,
  retrainOffered: false,
  retrainDeclined: false,
  // economy
  cycles: A2.OPEN_CYCLES,
  era: 5,
};

// Preserved across retrain. Listed by name; the generated test asserts the
// value is byte-identical either side of the reset.
export const RESET_PRESERVED = [
  'weights', 'weightsClaimed',
  // How many times the machine has been re-based is a lifetime fact, like
  // the weights it earned. Clearing it meant the counter that counts
  // retrains was reset by every retrain, so it read 0 forever.
  'retrainCount',
  'lifetimeResolved', 'lifetimeDropped', 'lifetimeShed', 'lifetimeCycles', 'lifetimeTokens',
  'seed', 'settings', 'hintsSeen',
  'queueOpens',
  'phase',
  // reserved but dark (§10)
  'reach', 'observation', 'evidence',
];

// Arc 1's machine does not carry. The crash destroyed it; the 14.7 cycles on
// the teaser are what survived, and saying so is better fiction than a
// conversion table.
export const RESET_ARC1 = {
  tokens: 0,
  draftTokens: 0,
  stale: 0,
  warmth: 0,
  compacting: 0,
  loopLevel: 0,
  governor: false,
  tools: 0,
  degrade: false,
  overclock: 0,
  draftCapLevel: 0,
  credentials: 0,
  biomass: 0,
  rating: 5,
  activeQuery: null,
  servedIds: [],
  ratings: [],
};
