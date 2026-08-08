// A DOM small enough to test the element builders against.
//
// This project has zero dependencies and runs on bare `node --test`, so
// there is no jsdom to reach for. The UI layer only ever uses
// createElement/textContent/append/dataset/classList — no innerHTML, no
// layout, no events beyond registration — which is a narrow enough surface
// to stand up honestly in a hundred lines.
//
// It supports exactly what the builders use. Anything beyond that should
// fail loudly rather than silently return undefined, so a test can never
// pass against a shim that quietly did nothing.

class ClassList {
  constructor(node) { this.node = node; }
  get set() {
    return new Set(this.node.className ? this.node.className.split(/\s+/).filter(Boolean) : []);
  }
  add(...names) {
    const s = this.set;
    for (const n of names) s.add(n);
    this.node.className = [...s].join(' ');
  }
  remove(...names) {
    const s = this.set;
    for (const n of names) s.delete(n);
    this.node.className = [...s].join(' ');
  }
  contains(name) { return this.set.has(name); }
  toggle(name, force) {
    const has = this.contains(name);
    const want = force === undefined ? !has : !!force;
    if (want) this.add(name); else this.remove(name);
    return want;
  }
}

class FakeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.className = '';
    this.dataset = {};
    this.style = {};
    this.disabled = false;
    this.hidden = false;
    this.listeners = {};
    this._text = '';
    this.classList = new ClassList(this);
  }

  append(...nodes) {
    for (const n of nodes) {
      this.children.push(typeof n === 'string' ? new FakeText(n) : n);
    }
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }

  setAttribute(name, value) { this.dataset[`attr:${name}`] = String(value); }

  get textContent() {
    if (this.children.length === 0) return this._text;
    return this.children.map((c) => c.textContent).join('');
  }

  set textContent(v) {
    this._text = String(v);
    this.children = [];
  }

  // Supports the two selector shapes the tests and the renderer use:
  // a tag name, and [data-testid="..."].
  matches(sel) {
    const testid = sel.match(/^\[data-testid="([^"]+)"\]$/);
    if (testid) return this.dataset.testid === testid[1];
    if (/^[a-zA-Z]+$/.test(sel)) return this.tagName === sel.toUpperCase();
    throw new Error(`test DOM: unsupported selector "${sel}"`);
  }

  querySelectorAll(sel) {
    const out = [];
    const walk = (node) => {
      for (const c of node.children) {
        if (c instanceof FakeNode) {
          if (c.matches(sel)) out.push(c);
          walk(c);
        }
      }
    };
    walk(this);
    return out;
  }

  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

class FakeText {
  constructor(text) { this._text = String(text); }
  get textContent() { return this._text; }
}

let saved = null;

export function installDom() {
  saved = globalThis.document;
  globalThis.document = {
    createElement: (tag) => new FakeNode(tag),
    createTextNode: (t) => new FakeText(t),
    getElementById: () => null,
  };
}

export function uninstallDom() {
  if (saved === undefined) delete globalThis.document;
  else globalThis.document = saved;
  saved = null;
}
