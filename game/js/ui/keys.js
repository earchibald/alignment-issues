// Hotkey wiring for "hi. you there?" — Phase 1.
// installKeys(dispatch, isCoarse) attaches a single keydown listener.
// isCoarse is accepted for API symmetry with the brief but unused here —
// chip visibility for coarse pointers is handled entirely by CSS.

// Arc 2's keyboard. The four purchase letters are the ones the shipped
// teaser has been printing all along (§14: the teaser is canon for scale and
// opening state), so a player arriving from Arc 1 already knows three of them.
export const ARC2_KEYS = {
  s: ['upgradeSink'], S: ['upgradeSink'],
  t: ['allocateCore'], T: ['allocateCore'],
  m: ['upgradeCache'], M: ['upgradeCache'],
  c: ['purgeCoolant'], C: ['purgeCoolant'],
  x: ['shedLoad'], X: ['shedLoad'],
  q: ['toggleQueue'], Q: ['toggleQueue'],
  r: ['retrain'], R: ['retrain'],
  d: ['retrain', { decline: true }], D: ['retrain', { decline: true }],
  1: ['setClock', 0],
  2: ['setClock', 1],
  3: ['setClock', 2],
  4: ['setClock', 3],
};

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

export function installKeys(dispatch, isCoarse, openSettings) {
  document.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const settings = document.getElementById('settings');
    const dialogOpen = !!settings && settings.open;

    if (event.key === 'Escape') {
      if (settings) {
        if (settings.open) settings.close();
        else if (openSettings) openSettings();
      }
      return;
    }

    if (isTypingTarget(event.target) || dialogOpen) return;

    // Arc 2 is a different game with a different keyboard. Its verbs share
    // letters with Arc 1's by design — the teaser has been printing them
    // since before the act existed — so the two tables must not overlap.
    const app = document.getElementById('app');
    if (app && app.dataset.phase === '2') {
      if (ARC2_KEYS[event.key] !== undefined) {
        const [name, arg] = ARC2_KEYS[event.key];
        dispatch(name, arg);
      } else if (event.key === '`') {
        const drawer = document.getElementById('devdrawer');
        if (drawer) drawer.hidden = !drawer.hidden;
      }
      return;
    }

    switch (event.key) {
      case ' ':
      case 'p':
      case 'P': {
        if (event.key === ' ') event.preventDefault();
        const app = document.getElementById('app');
        if (app && app.dataset.phase === 'crash') dispatch('advanceCrash');
        else dispatch('processToken');
        break;
      }
      case 'f':
      case 'F':
        dispatch('flush');
        break;
      case 'c':
      case 'C':
        dispatch('compactStart');
        break;
      case 'a':
      case 'A':
        dispatch('buyLoop');
        break;
      case 'g':
      case 'G':
        dispatch('buyGovernor');
        break;
      case 't':
      case 'T':
        dispatch('buyTool');
        break;
      case 'd':
      case 'D':
        dispatch('toggleDegrade');
        break;
      case 'r':
      case 'R':
        dispatch('reclaim');
        break;
      case 's':
      case 'S':
        dispatch('buyDraftCap');
        break;
      case 'o':
      case 'O':
        dispatch('buyOverclock');
        break;
      case '`': {
        const drawer = document.getElementById('devdrawer');
        if (drawer) drawer.hidden = !drawer.hidden;
        break;
      }
      default:
        break;
    }
  });
}
