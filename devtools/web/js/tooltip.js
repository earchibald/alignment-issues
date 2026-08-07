// Rendered tooltips, not native `title` ones.
//
// Native title tooltips are drawn by the browser chrome, and some embedded
// browser views never paint them at all — the attribute is present and the
// tooltip simply never appears. Anything the user has to hover to understand
// therefore has to be drawn by the page itself.
//
// Usage: put the text in data-tip. Hover or keyboard focus shows it.

let tip = null;
let timer = 0;
let current = null;

const DELAY = 90;
const GAP = 12;

function ensure() {
  if (tip) return tip;
  tip = document.createElement('div');
  tip.className = 'tip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  return tip;
}

function place(x, y) {
  const node = ensure();
  const box = node.getBoundingClientRect();
  // Prefer below-right of the cursor, flip when that would leave the viewport.
  let left = x + GAP;
  let top = y + GAP;
  if (left + box.width > window.innerWidth - 8) left = Math.max(8, x - box.width - GAP);
  if (top + box.height > window.innerHeight - 8) top = Math.max(8, y - box.height - GAP);
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
}

function show(text, x, y) {
  const node = ensure();
  node.textContent = text;
  node.classList.add('on');
  place(x, y);
}

function hide() {
  clearTimeout(timer);
  current = null;
  if (tip) tip.classList.remove('on');
}

export function initTooltips(root = document) {
  root.addEventListener('mouseover', (e) => {
    const host = e.target.closest('[data-tip]');
    if (!host || host === current) return;
    current = host;
    clearTimeout(timer);
    const { clientX, clientY } = e;
    timer = setTimeout(() => show(host.dataset.tip, clientX, clientY), DELAY);
  });

  root.addEventListener('mousemove', (e) => {
    if (current && tip && tip.classList.contains('on')) place(e.clientX, e.clientY);
  });

  root.addEventListener('mouseout', (e) => {
    if (current && !e.relatedTarget?.closest?.('[data-tip]')) hide();
  });

  // Keyboard users get the same text when a control takes focus.
  root.addEventListener('focusin', (e) => {
    const host = e.target.closest('[data-tip]');
    if (!host) return;
    const box = host.getBoundingClientRect();
    current = host;
    show(host.dataset.tip, box.left, box.bottom - GAP);
  });

  root.addEventListener('focusout', hide);
  window.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', hide);
}

// Convenience for code that builds elements: setTip(node, text).
export function setTip(node, text) {
  node.dataset.tip = text;
  return node;
}
