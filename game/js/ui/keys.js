// Hotkey wiring for "hi. you there?" — Phase 1.
// installKeys(dispatch, isCoarse) attaches a single keydown listener.
// isCoarse is accepted for API symmetry with the brief but unused here —
// chip visibility for coarse pointers is handled entirely by CSS.

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
