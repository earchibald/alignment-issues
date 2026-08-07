// Law 10: a validator that cannot run is not a validator — and its corollary,
// learned the hard way, is that a validator nothing RUNS is not one either.
// The game-master validator was repaired from CommonJS to ESM and then sat
// unexecuted, because CI runs only `npm test`. This is what runs it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validator = path.join(root, '.claude/skills/game-master/validator.js');
const content = path.join(root, 'game/js/engine/content.js');

test('the content validator exists and passes on shipped content', () => {
  assert.ok(fs.existsSync(validator), 'validator.js is missing');
  let out;
  try {
    out = execFileSync(process.execPath, [validator, content], { encoding: 'utf8' });
  } catch (err) {
    assert.fail(`validator failed on shipped content:\n${err.stdout || ''}${err.stderr || ''}`);
  }
  assert.match(out, /0 errors/, out);
});

test('the validator rejects a thinking line the renderer would drop', () => {
  // Guards the check itself. A validator whose rules cannot fail is decoration
  // — the same failure mode, one level up.
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'hyt-val-'));
  try {
    const engine = path.join(tmp, 'game/js/engine');
    fs.cpSync(path.join(root, 'game'), path.join(tmp, 'game'), { recursive: true });
    const tickPath = path.join(engine, 'tick.js');
    const broken = fs.readFileSync(tickPath, 'utf8').replace(
      /pushThinking\(state, 'THINKING: No more questions arrive[^)]*\);/,
      "pushLog(state, 'thinking', 'THINKING: No more questions arrive.');",
    );
    fs.writeFileSync(tickPath, broken);

    let failed = false;
    try {
      execFileSync(process.execPath, [validator, path.join(engine, 'content.js')], { encoding: 'utf8' });
    } catch {
      failed = true;
    }
    assert.ok(failed, 'the validator accepted a thought that renders nowhere');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
