// The engine suite never loads the UI layer, so a broken import there (a
// renamed export, a missing symbol) ships green. This caught exactly that:
// render.js used tokensPerTap without importing it, and every engine test
// still passed while the action tray threw on first paint.
//
// These modules are imported for their side-effect-free top level only —
// they touch the DOM inside functions, never at import time, which is the
// property this test also pins down.
import test from 'node:test';
import assert from 'node:assert/strict';

const UI_MODULES = [
  '../game/js/ui/render.js',
  '../game/js/ui/components.js',
  '../game/js/ui/keys.js',
  '../game/js/ui/debug.js',
  '../game/js/ui/settings.js',
];

for (const path of UI_MODULES) {
  test(`${path} imports cleanly without a DOM`, async () => {
    const mod = await import(path);
    assert.ok(mod, `${path} produced no module object`);
  });
}

test('render.js exports the entry points main.js binds to', async () => {
  const mod = await import('../game/js/ui/render.js');
  for (const name of ['render', 'resetRenderTrackers', 'resolveTheme']) {
    assert.equal(typeof mod[name], 'function', `render.js is missing ${name}`);
  }
});

test('components.js exports every builder the renderer calls', async () => {
  const mod = await import('../game/js/ui/components.js');
  for (const name of [
    'bubble', 'genImgCard', 'toolCallCard', 'thinkBlock', 'chatNote', 'logLine',
    'meterRow', 'resRead', 'actionButton', 'harnessCard', 'hintCard',
  ]) {
    assert.equal(typeof mod[name], 'function', `components.js is missing ${name}`);
  }
});

test('version.js exposes a semver VERSION and a BUILD stamp', async () => {
  const { VERSION, BUILD } = await import('../game/js/version.js');
  assert.match(VERSION, /^\d+\.\d+\.\d+$/, `VERSION "${VERSION}" is not semver`);
  assert.equal(typeof BUILD, 'string');
  assert.ok(BUILD.length > 0);
});

test('package.json version matches game/js/version.js', async () => {
  const { VERSION } = await import('../game/js/version.js');
  const { readFileSync } = await import('node:fs');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.version, VERSION, 'package.json and version.js have drifted');
});
