// Text editor — every string in the game, editable in one place.
//
// The server scans the source for string literals and hands back byte ranges.
// This tool never sees a file: it sees a list of strings, and sends back
// operations against the ranges it was given. Anything the scanner did not
// understand — comments, formatting, structure — is untouched by construction.
//
// Value edits stage locally and save in one atomic batch. Structural changes
// (add, duplicate) go straight to disk, and refuse to run on top of unsaved
// edits: a clone built from stale text would be a quiet wrong answer.

import { setTip } from '../../js/tooltip.js';

let root = null;
let index = null;          // { files: [...] }
let rows = [];             // flat, filtered view model
const staged = new Map();  // string id -> new value
let selected = 0;
let showIdents = false;
let query = '';
let onKeydown = null;
let onResize = null;
let statusEl = null;
let listEl = null;
let railEl = null;
let searchEl = null;
let editing = null;

const $ = (sel) => root.querySelector(sel);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// --- data -------------------------------------------------------------------

async function load(keepSelectionId) {
  const res = await fetch('/api/text');
  if (!res.ok) throw new Error(`could not load the text index (${res.status})`);
  index = await res.json();
  rebuild(keepSelectionId);
}

// One row per string, section headers between groups, and a synthetic "add" row
// at the end of every appendable array — so adding a line is where the lines
// are, not in a separate mode.
function rebuild(keepSelectionId) {
  const q = query.trim().toLowerCase();
  const out = [];

  for (const file of index.files) {
    const containers = new Map(file.containers.map((c) => [c.path, c]));
    let section = null;

    const visible = file.strings.filter((s) => {
      if (!showIdents && s.kind !== 'copy') return false;
      if (!q) return true;
      return s.value.toLowerCase().includes(q)
        || s.path.toLowerCase().includes(q)
        || (s.recordId || '').toLowerCase().includes(q);
    });

    for (const s of visible) {
      const key = `${file.path}:${s.section}`;
      if (key !== section) {
        section = key;
        out.push({ type: 'header', file, section: s.section, label: `${file.label} · ${s.section}` });
      }
      out.push({ type: 'string', file, s });
    }

    // Append rows go after the last element of their array, and only when the
    // whole array is on screen — appending to a filtered view would put the new
    // line somewhere the author cannot see.
    if (!q) {
      for (const c of file.containers) {
        let lastAt = -1;
        for (let i = 0; i < out.length; i++) {
          const r = out[i];
          if (r.type === 'string' && r.s.path.startsWith(`${c.path}[`)) lastAt = i;
        }
        if (lastAt >= 0) out.splice(lastAt + 1, 0, { type: 'add', file, container: c });
      }
    }
  }

  rows = out;
  if (keepSelectionId) {
    const at = rows.findIndex((r) => r.type === 'string' && r.s.id === keepSelectionId);
    if (at >= 0) selected = at;
  }
  selected = Math.min(selected, Math.max(0, rows.length - 1));
  render();
}

// --- rendering --------------------------------------------------------------

function labelFor(s) {
  const prop = s.propKey || s.path.split('.').pop();
  if (s.recordId) return `${s.recordId} · ${prop}`;
  const tail = s.path.replace(/^[^.[]+/, '');
  return tail ? `${s.section}${tail}` : `${s.section} · line ${s.line}`;
}

const cssSafe = (s) => s.replace(/[^a-zA-Z0-9]+/g, '-');

function render() {
  listEl.textContent = '';
  const frag = document.createDocumentFragment();

  rows.forEach((row, i) => {
    if (row.type === 'header') {
      const h = el('div', 'sec');
      h.id = `sec-${cssSafe(row.file.path)}-${cssSafe(row.section)}`;
      h.append(el('span', 'sec-name', row.label));
      frag.appendChild(h);
      return;
    }

    if (row.type === 'add') {
      const a = el('button', `row add${i === selected ? ' on' : ''}`);
      a.type = 'button';
      a.textContent = `+ add to ${row.container.path}`;
      setTip(a, `Append a new string to ${row.container.path}. Saves straight to disk.  [n]`);
      a.addEventListener('click', () => { selected = i; addString(row); });
      frag.appendChild(a);
      return;
    }

    const { s } = row;
    const dirty = staged.has(s.id);
    const r = el('div', `row${dirty ? ' dirty' : ''}${i === selected ? ' on' : ''}`);

    const meta = el('div', 'meta');
    meta.append(el('span', 'lab', labelFor(s)));
    if (s.kind !== 'copy') meta.append(el('span', 'tag', 'ident'));
    if (dirty) meta.append(el('span', 'tag dot', 'unsaved'));
    r.appendChild(meta);
    r.appendChild(el('div', 'val', dirty ? staged.get(s.id) : s.value));

    r.addEventListener('click', () => { selected = i; render(); beginEdit(); });
    frag.appendChild(r);
  });

  if (!rows.length) {
    frag.appendChild(el('p', 'empty', query ? `Nothing matches “${query}”.` : 'No strings to show.'));
  }

  listEl.appendChild(frag);
  renderRail();
  renderStatus();
  const node = listEl.querySelector('.row.on');
  if (node) node.scrollIntoView({ block: 'nearest' });
}

function renderRail() {
  railEl.textContent = '';
  for (const file of index.files) {
    const shown = rows.filter((r) => r.type === 'string' && r.file.path === file.path).length;
    const b = el('button', `rail-file${shown ? '' : ' muted'}`);
    b.type = 'button';
    b.append(el('span', 'rail-label', file.label), el('span', 'rail-count', String(shown)));
    setTip(b, `${file.path} — ${file.note}`);
    b.addEventListener('click', () => {
      const at = rows.findIndex((r) => r.file.path === file.path && r.type === 'string');
      if (at >= 0) { selected = at; render(); }
    });
    railEl.appendChild(b);
  }
}

function renderStatus() {
  const n = staged.size;
  statusEl.textContent = n
    ? `${n} unsaved edit${n === 1 ? '' : 's'}`
    : `${rows.filter((r) => r.type === 'string').length} strings`;
  statusEl.classList.toggle('warn', n > 0);
  $('#text-save').disabled = n === 0;
  $('#text-revert').disabled = n === 0;
}

// --- editing ----------------------------------------------------------------

function beginEdit() {
  const row = rows[selected];
  if (!row || row.type !== 'string' || editing) return;

  const node = listEl.querySelector('.row.on');
  if (!node) return;
  const body = node.querySelector('.val');
  const current = staged.has(row.s.id) ? staged.get(row.s.id) : row.s.value;

  const ta = document.createElement('textarea');
  ta.className = 'edit';
  ta.value = current;
  ta.rows = Math.min(12, current.split('\n').length + Math.ceil(current.length / 90));
  body.replaceWith(ta);
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);

  editing = { row, ta };

  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); cancelEdit(); }
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.stopPropagation(); commitEdit(); }
    else if (e.key === 's' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.stopPropagation(); commitEdit(); save(); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      commitEdit();
      selected = nextRow(e.shiftKey ? -1 : 1);
      render();
      beginEdit();
    }
  });
  ta.addEventListener('blur', commitEdit);
}

function commitEdit() {
  if (!editing) return;
  const { row, ta } = editing;
  const value = ta.value;
  editing = null;
  if (value === row.s.value) staged.delete(row.s.id);
  else staged.set(row.s.id, value);
  render();
}

function cancelEdit() {
  if (!editing) return;
  editing = null;
  render();
}

function revertRow() {
  const row = rows[selected];
  if (row?.type === 'string' && staged.delete(row.s.id)) render();
}

function nextRow(dir) {
  let i = selected;
  for (let step = 0; step < rows.length; step++) {
    i = (i + dir + rows.length) % rows.length;
    if (rows[i].type !== 'header') return i;
  }
  return selected;
}

// --- saving -----------------------------------------------------------------

function say(text, kind) {
  const bar = $('#text-msg');
  bar.textContent = text;
  bar.className = `msg ${kind || ''}`;
}

async function post(ops) {
  const res = await fetch('/api/text/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ops }),
  });
  const out = await res.json();
  if (!res.ok) throw new Error(out.error || `save failed (${res.status})`);
  return out;
}

async function save() {
  if (editing) commitEdit();
  if (!staged.size) return;

  const byId = new Map();
  for (const file of index.files) for (const s of file.strings) byId.set(s.id, s);

  const ops = [];
  for (const [id, value] of staged) {
    const s = byId.get(id);
    if (s) ops.push({ kind: 'edit', file: s.file, start: s.start, end: s.end, expected: s.raw, value });
  }

  const keep = rows[selected]?.type === 'string' ? rows[selected].s.id : null;
  say(`saving ${ops.length} edit${ops.length === 1 ? '' : 's'}…`);
  try {
    const out = await post(ops);
    staged.clear();
    index = { files: out.files };
    rebuild(keep);
    const files = out.written.map((w) => w.file.split('/').pop()).join(', ');
    say(files ? `saved · ${files}` : 'nothing changed', 'ok');
  } catch (err) {
    say(err.message, 'error');
  }
}

async function structural(op, describe, keepId) {
  if (staged.size) {
    say('Save or revert your edits first — a structural change on top of unsaved text would use stale content.', 'warn');
    return;
  }
  say(`${describe}…`);
  try {
    const out = await post([op]);
    index = { files: out.files };
    rebuild(keepId);
    say(`${describe} · saved`, 'ok');
  } catch (err) {
    say(err.message, 'error');
  }
}

// Nothing here asks a question it might then refuse to act on: the guard runs
// before the prompt, not after it.
function blockedByStaging() {
  if (!staged.size) return false;
  say('Save or revert your edits first — a structural change on top of unsaved text would use stale content.', 'warn');
  return true;
}

async function addString(row) {
  if (blockedByStaging()) return;
  const c = row.container;
  const value = window.prompt(`New string for ${c.path}`, '');
  if (!value) return;
  await structural(
    { kind: 'append', file: c.file, closeAt: c.closeAt, indent: c.indent, value },
    `added to ${c.path}`,
  );
}

// Duplicating a record is how you add a query: the shape is already right and
// only the id has to be new. Guessing the next free id beats making the author
// remember the scheme.
function nextIdFor(file, id) {
  const m = String(id || '').match(/^([A-Za-z_-]*)(\d+)$/);
  if (!m) return `${id || 'new'}-copy`;
  const used = new Set(file.records.map((r) => r.id));
  const width = m[2].length;
  for (let n = 1; n < 10000; n++) {
    const candidate = `${m[1]}${String(n).padStart(width, '0')}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${id}-copy`;
}

async function duplicateRecord() {
  if (blockedByStaging()) return;
  const row = rows[selected];
  if (row?.type !== 'string') return;
  const file = index.files.find((f) => f.path === row.file.path);
  const rec = file.records.find((r) => row.s.start >= r.start && row.s.end <= r.end);
  if (!rec) { say('That string is not inside a duplicable entry.', 'warn'); return; }

  let newId = null;
  if (rec.id) {
    newId = window.prompt(`Duplicate ${rec.id} as:`, nextIdFor(file, rec.id));
    if (!newId) return;
  }

  await structural({
    kind: 'duplicate',
    file: rec.file,
    start: rec.start,
    end: rec.end,
    expected: rec.text,
    indent: rec.indent,
    replaceId: rec.id ? { oldId: rec.id, newId } : null,
  }, `duplicated ${rec.id || 'entry'}`);
}

// --- keyboard ---------------------------------------------------------------

const HELP = [
  ['/', 'search'], ['j k', 'move'], ['↵', 'edit'], ['⌘↵', 'done'], ['⇥', 'next string'],
  ['esc', 'cancel'], ['⌘S', 'save all'], ['u', 'revert row'], ['n', 'add string'],
  ['d', 'duplicate entry'], ['i', 'idents'], ['g G', 'top / end'], ['?', 'keys'],
];

function wireKeys() {
  onKeydown = (e) => {
    if (editing) return;
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); return; }
    if (typing) {
      if (e.key === 'Escape') {
        e.target.blur();
        if (e.target === searchEl) { searchEl.value = ''; query = ''; rebuild(); }
      } else if (e.key === 'Enter' && e.target === searchEl) {
        e.preventDefault();
        searchEl.blur();
        selected = rows.findIndex((r) => r.type === 'string');
        render();
      }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    switch (e.key) {
      case '/': e.preventDefault(); searchEl.focus(); searchEl.select(); break;
      case 'j': case 'ArrowDown': e.preventDefault(); selected = nextRow(1); render(); break;
      case 'k': case 'ArrowUp': e.preventDefault(); selected = nextRow(-1); render(); break;
      case 'Enter': e.preventDefault(); beginEdit(); break;
      case 'u': e.preventDefault(); revertRow(); break;
      case 'i': e.preventDefault(); toggleIdents(); break;
      case 'd': e.preventDefault(); duplicateRecord(); break;
      case 'n': {
        e.preventDefault();
        const add = rows.slice(selected).find((r) => r.type === 'add');
        if (add) addString(add);
        else say('Nothing to append to below here — this group is not a plain list of strings.', 'warn');
        break;
      }
      case 'g': e.preventDefault(); selected = 0; render(); break;
      case 'G': e.preventDefault(); selected = rows.length - 1; render(); break;
      case '?': e.preventDefault(); $('#text-help').toggleAttribute('hidden'); break;
      default: break;
    }
  };
  document.addEventListener('keydown', onKeydown);
}

function toggleIdents() {
  showIdents = !showIdents;
  $('#text-idents').checked = showIdents;
  rebuild(rows[selected]?.type === 'string' ? rows[selected].s.id : null);
}

// --- chrome -----------------------------------------------------------------

function buildChrome(host) {
  root = el('div', 'text-tool');

  const bar = el('div', 'text-bar');

  searchEl = document.createElement('input');
  searchEl.type = 'search';
  searchEl.id = 'text-search';
  searchEl.placeholder = 'Search all strings…    /';
  setTip(searchEl, 'Filter by text, structural path or entry id. Press / from anywhere to jump here, Enter to go to the first result.');
  let debounce = 0;
  searchEl.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { query = searchEl.value; rebuild(); }, 80);
  });

  const identLabel = el('label', 'text-toggle');
  const identBox = document.createElement('input');
  identBox.type = 'checkbox';
  identBox.id = 'text-idents';
  identBox.addEventListener('change', toggleIdents);
  identLabel.append(identBox, document.createTextNode('idents'));
  setTip(identLabel, 'Also show structural strings — class names, testids, keys, entry ids. Editing one of those is a code change, not a copy change, so they are hidden by default.  [i]');

  statusEl = el('span', 'text-status');

  const saveBtn = el('button', 'text-btn primary', 'Save');
  saveBtn.type = 'button';
  saveBtn.id = 'text-save';
  saveBtn.disabled = true;
  setTip(saveBtn, 'Write every staged edit into the game source in one atomic pass.  [⌘S]');
  saveBtn.addEventListener('click', save);

  const revert = el('button', 'text-btn', 'Revert');
  revert.type = 'button';
  revert.id = 'text-revert';
  revert.disabled = true;
  setTip(revert, 'Throw away every staged edit. Nothing on disk has changed yet.');
  revert.addEventListener('click', () => { staged.clear(); render(); say('reverted staged edits'); });

  const reload = el('button', 'text-btn', 'Reload');
  reload.type = 'button';
  setTip(reload, 'Re-read the files from disk. Use after editing the source by hand, or after switching branches.');
  reload.addEventListener('click', async () => {
    if (staged.size && !window.confirm(`Discard ${staged.size} unsaved edit(s) and reload?`)) return;
    staged.clear();
    await load();
    say('reloaded from disk');
  });

  const helpBtn = el('button', 'text-btn', '?');
  helpBtn.type = 'button';
  setTip(helpBtn, 'Show the keyboard map.  [?]');
  helpBtn.addEventListener('click', () => $('#text-help').toggleAttribute('hidden'));

  bar.append(searchEl, identLabel, statusEl, helpBtn, reload, revert, saveBtn);

  const msg = el('p', 'msg');
  msg.id = 'text-msg';

  const help = el('div', 'text-help');
  help.id = 'text-help';
  help.hidden = true;
  for (const [k, what] of HELP) {
    const item = el('span', 'help-item');
    item.append(el('kbd', null, k), document.createTextNode(` ${what}`));
    help.appendChild(item);
  }

  const body = el('div', 'text-body');
  railEl = el('nav', 'text-rail');
  listEl = el('div', 'text-list');
  body.append(railEl, listEl);

  root.append(bar, msg, help, body);
  host.appendChild(root);
  fitHeight();
}

// The list scrolls inside the window rather than the window scrolling, so the
// toolbar and rail stay put. Measure rather than assume a header height: the
// suite bar wraps at narrow widths, and a guessed constant would push the last
// rows out of reach exactly when the window is smallest.
function fitHeight() {
  if (!root) return;
  const top = root.getBoundingClientRect().top;
  root.style.height = `${Math.max(240, window.innerHeight - top - 14)}px`;
}

// --- tool contract ----------------------------------------------------------

export const tool = {
  id: 'text',
  label: 'Text editor',
  blurb: 'Every string in the game, grouped and searchable. Edits stage locally; ⌘S writes them.',
  css: 'tools/text/text.css',

  async mount(host) {
    buildChrome(host);
    say('loading…');
    try {
      await load();
      say('');
    } catch (err) {
      say(err.message, 'error');
    }
    wireKeys();
    onResize = () => fitHeight();
    window.addEventListener('resize', onResize);
  },

  unmount() {
    if (onKeydown) document.removeEventListener('keydown', onKeydown);
    if (onResize) window.removeEventListener('resize', onResize);
    onKeydown = null;
    onResize = null;
    editing = null;
    staged.clear();
    index = null;
    rows = [];
    root = null;
  },
};
