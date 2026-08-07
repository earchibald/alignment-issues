// Suite shell: tab strip, lazy tool mounting, and the Apply button.
//
// One tool is mounted at a time. Switching tabs unmounts the previous tool, so
// a tool that runs an animation loop or holds document-level listeners stops
// costing anything when you are not looking at it.

import { TOOLS } from './registry.js';
import { initTooltips } from './tooltip.js';
import { initApply } from './apply.js';

const tabsEl = document.getElementById('tabs');
const hostEl = document.getElementById('tool-host');
const blurbEl = document.getElementById('tool-blurb');

const loaded = new Map(); // id -> tool module
let active = null;
let activeId = null;

function loadCssOnce(href) {
  if (!href || document.querySelector(`link[data-tool-css="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.toolCss = href;
  document.head.appendChild(link);
}

async function activate(id) {
  if (id === activeId) return;

  if (active && typeof active.unmount === 'function') active.unmount();
  hostEl.textContent = '';
  active = null;
  activeId = null;

  const entry = TOOLS.find((t) => t.id === id);
  if (!entry) return;

  let mod = loaded.get(id);
  if (!mod) {
    hostEl.appendChild(Object.assign(document.createElement('p'), {
      className: 'loading', textContent: `Loading ${entry.label}…`,
    }));
    try {
      mod = (await entry.load()).tool;
    } catch (err) {
      hostEl.textContent = '';
      hostEl.appendChild(Object.assign(document.createElement('p'), {
        className: 'loading error', textContent: `${entry.label} failed to load: ${err.message}`,
      }));
      return;
    }
    loaded.set(id, mod);
  }

  loadCssOnce(mod.css);
  hostEl.textContent = '';
  mod.mount(hostEl);

  active = mod;
  activeId = id;
  blurbEl.textContent = mod.blurb || '';

  for (const btn of tabsEl.querySelectorAll('button')) {
    const on = btn.dataset.tool === id;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-selected', String(on));
  }
  if (location.hash.slice(1) !== id) history.replaceState(null, '', `#${id}`);
}

function buildTabs() {
  for (const t of TOOLS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.role = 'tab';
    btn.dataset.tool = t.id;
    btn.textContent = t.label;
    btn.addEventListener('click', () => activate(t.id));
    tabsEl.appendChild(btn);
  }
}

initTooltips();
buildTabs();
initApply(document.getElementById('apply'), document.getElementById('apply-status'), () => active);

const wanted = location.hash.slice(1);
activate(TOOLS.some((t) => t.id === wanted) ? wanted : TOOLS[0]?.id);
window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (TOOLS.some((t) => t.id === id)) activate(id);
});
