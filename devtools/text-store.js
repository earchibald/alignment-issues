// Reading and writing the game's copy, for the text editor tool.
//
// Edits are byte-range replacements verified against what the client last saw.
// The client sends the exact text it believes is there; if the file has moved
// underneath it — a hand edit, another tab, a git checkout — the write is
// refused rather than applied to the wrong place. That is the whole safety
// story, and it is why nothing here needs a lock.
//
// A save is all-or-nothing per file: every operation is verified first, then
// applied from the end of the file backwards so earlier offsets stay valid.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { scanStrings, encode } from './scan.js';

// The files whose strings the editor may touch. Adding one is a line here.
// content.js is the game's text; the rest hold copy that grew up inside the
// code — harness log lines, UI labels, dialog prose.
export const TEXT_FILES = [
  { path: 'game/js/engine/content.js', label: 'Content', note: 'queries, replies, thinking, idle, hints' },
  { path: 'game/js/engine/tick.js', label: 'Tick', note: 'harness log lines fired by the loop' },
  { path: 'game/js/engine/actions.js', label: 'Actions', note: 'log lines fired by player actions' },
  { path: 'game/js/ui/render.js', label: 'Render', note: 'meter labels, readouts, status text' },
  { path: 'game/js/ui/components.js', label: 'Components', note: 'card and entry chrome' },
  { path: 'game/js/ui/settings.js', label: 'Settings', note: 'settings dialog copy' },
];

const byPath = new Map(TEXT_FILES.map((f) => [f.path, f]));

// Paths repeat in code files, where a literal has no meaningful structural
// path. Ids stay stable across a save as long as the structure does not move,
// which is what lets the UI keep its selection through a write.
function withIds(strings, file) {
  const seen = new Map();
  return strings.map((s) => {
    const n = seen.get(s.path) || 0;
    seen.set(s.path, n + 1);
    return { ...s, id: `${file}|${s.path}${n ? `#${n}` : ''}` };
  });
}

export async function readIndex(project) {
  const files = [];
  for (const meta of TEXT_FILES) {
    let src;
    try {
      src = await readFile(join(project, meta.path), 'utf8');
    } catch {
      continue; // a file that is not there is not an error; it is just absent
    }
    const { strings, containers, records } = scanStrings(src, meta.path);
    files.push({
      ...meta,
      strings: withIds(strings, meta.path),
      containers: containers.filter((c) => c.kind === 'string-array'),
      // Records carry their source text so the client can send it back as the
      // expected value when duplicating. Without it a clone could be built
      // from a stale idea of the entry.
      records: records.map((r) => ({ ...r, text: src.slice(r.start, r.end) })),
      bytes: src.length,
    });
  }
  return { files };
}

function fail(message) {
  const err = new Error(message);
  err.expose = true;
  return err;
}

/**
 * Apply operations. Every op names a file and a verified anchor:
 *
 *   edit      {file, start, end, expected, value}
 *   append    {file, closeAt, indent, value}            append to a string array
 *   duplicate {file, start, end, expected, replaceId}   clone a record
 *   remove    {file, start, end, expected}              delete an array element
 */
export async function applyOps(project, ops) {
  if (!Array.isArray(ops) || ops.length === 0) throw fail('no operations given');
  if (ops.length > 2000) throw fail('too many operations in one save');

  const groups = new Map();
  for (const op of ops) {
    if (!byPath.has(op.file)) throw fail(`not an editable file: ${op.file}`);
    if (!groups.has(op.file)) groups.set(op.file, []);
    groups.get(op.file).push(op);
  }

  const written = [];
  for (const [file, list] of groups) {
    const full = join(project, file);
    const src = await readFile(full, 'utf8');

    // Verify everything before touching anything.
    const edits = list.map((op) => planOne(src, op, file));

    // Overlap would make the result depend on application order, which is a
    // bug in the caller rather than something to resolve silently.
    const sorted = [...edits].sort((a, b) => a.at - b.at);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].at < sorted[i - 1].at + sorted[i - 1].length) {
        throw fail(`overlapping edits in ${file} at offset ${sorted[i].at}`);
      }
    }

    let out = src;
    for (const e of [...edits].sort((a, b) => b.at - a.at)) {
      out = out.slice(0, e.at) + e.text + out.slice(e.at + e.length);
    }

    if (out !== src) {
      await writeFile(full, out, 'utf8');
      written.push({ file, ops: list.length });
    }
  }

  return { written };
}

function planOne(src, op, file) {
  if (op.kind === 'edit') {
    const { start, end, expected } = op;
    if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) throw fail('bad range');
    if (typeof op.value !== 'string') throw fail('value must be a string');
    if (src.slice(start, end) !== expected) {
      throw fail(`${file} changed on disk since it was loaded (at offset ${start}). Reload and redo this edit.`);
    }
    return { at: start, length: end - start, text: encode(op.value, expected[0]) };
  }

  if (op.kind === 'append') {
    const { closeAt } = op;
    if (src[closeAt] !== ']') {
      throw fail(`${file} changed on disk since it was loaded. Reload and redo this addition.`);
    }
    if (typeof op.value !== 'string') throw fail('value must be a string');
    const indent = typeof op.indent === 'string' && /^[ \t]*$/.test(op.indent) ? op.indent : '  ';
    // Insert before the closing bracket, on its own line, matching the
    // indentation of the element above. A trailing comma keeps the next
    // addition's diff to one line.
    const before = src.slice(0, closeAt).replace(/\s*$/, '');
    const needsComma = !before.endsWith(',') && !before.endsWith('[');
    const text = `${needsComma ? ',' : ''}\n${indent}${encode(op.value, "'")},\n${indentClose(src, closeAt)}`;
    return { at: before.length, length: closeAt - before.length, text };
  }

  if (op.kind === 'duplicate') {
    const { start, end, expected } = op;
    if (src.slice(start, end) !== expected) {
      throw fail(`${file} changed on disk since it was loaded. Reload and redo this duplication.`);
    }
    let clone = expected;
    if (op.replaceId) {
      const { oldId, newId } = op.replaceId;
      if (!/^[A-Za-z0-9_.-]{1,40}$/.test(newId)) throw fail(`bad new id: ${newId}`);
      const needle = encode(oldId, "'");
      if (!clone.includes(needle)) throw fail(`could not find id ${oldId} in the record to duplicate`);
      // Ids are how the engine remembers what it has already served, so two
      // records sharing one is a corruption, not a cosmetic clash. The client
      // suggests a free id; the server is what guarantees it.
      const taken = scanStrings(src).records.some((r) => r.id === newId);
      if (taken) throw fail(`id ${newId} is already used in ${file} — pick another`);
      clone = clone.replace(needle, encode(newId, "'"));
    }
    const indent = typeof op.indent === 'string' && /^[ \t]*$/.test(op.indent) ? op.indent : '  ';
    return { at: end, length: 0, text: `,\n${indent}${clone}` };
  }

  if (op.kind === 'remove') {
    const { start, end, expected } = op;
    if (src.slice(start, end) !== expected) {
      throw fail(`${file} changed on disk since it was loaded. Reload and redo this removal.`);
    }
    // Swallow the separator and the blank line the element leaves behind.
    let from = start;
    let to = end;
    while (from > 0 && (src[from - 1] === ' ' || src[from - 1] === '\t')) from--;
    if (src[to] === ',') to++;
    if (src[to] === '\n' && src[from - 1] === '\n') from--;
    return { at: from, length: to - from, text: '' };
  }

  throw fail(`unknown operation: ${op.kind}`);
}

// Indentation of the closing bracket's own line, so the bracket stays put.
function indentClose(src, closeAt) {
  const lineStart = src.lastIndexOf('\n', closeAt - 1) + 1;
  const prefix = src.slice(lineStart, closeAt);
  return /^[ \t]*$/.test(prefix) ? prefix : '';
}
