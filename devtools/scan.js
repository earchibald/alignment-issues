// String scanner for the text editor tool.
//
// The game's copy lives in ordinary JS source, mixed with structure and
// comments. To edit it safely we need to know exactly where every string
// literal is — its byte range — and what it means — a structural path like
// QUERIES[12].reply or THINKING_EVENTS.flush[3].
//
// This is a scanner, not a parser. It tokenises enough to be correct about
// where strings, comments and structure begin and end, and it tracks a stack of
// object/array frames to build paths. It never evaluates the file. Edits are
// then applied to byte ranges, so everything the scanner does not understand —
// comments, formatting, trailing commas, the file's whole shape — survives an
// edit untouched.
//
// Node-only module. The browser gets its output as JSON.

const ID_START = /[A-Za-z_$]/;
const ID_PART = /[A-Za-z0-9_$]/;

// Property names whose values are structural rather than copy: changing one is
// a code change, not a text change. The editor hides these by default.
const IDENT_KEYS = new Set(['id', 'kind', 'cls', 'ext', 'testid', 'key']);

function decode(raw) {
  const quote = raw[0];
  const body = raw.slice(1, -1);
  let out = '';
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== '\\') { out += body[i]; continue; }
    const c = body[++i];
    if (c === 'n') out += '\n';
    else if (c === 't') out += '\t';
    else if (c === 'r') out += '\r';
    else if (c === '\n') { /* line continuation */ }
    else if (c === 'u') {
      if (body[i + 1] === '{') {
        const end = body.indexOf('}', i);
        out += String.fromCodePoint(parseInt(body.slice(i + 2, end), 16));
        i = end;
      } else {
        out += String.fromCharCode(parseInt(body.slice(i + 1, i + 5), 16));
        i += 4;
      }
    } else out += c;
  }
  void quote;
  return out;
}

/**
 * Encode a value as a source literal, preferring the file's existing quote
 * style and switching only when that would mean escaping the quote character.
 * Newlines become \n rather than a real line break: these are single-line
 * literals in a data file, and reflowing them would churn the diff.
 */
export function encode(value, preferred = "'") {
  const alts = [preferred, preferred === "'" ? '"' : "'"];
  const quote = alts.find((q) => !value.includes(q)) || preferred;
  const body = value
    .replace(/\\/g, '\\\\')
    .split(quote).join(`\\${quote}`)
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `${quote}${body}${quote}`;
}

function lineOf(src, offset) {
  let line = 1;
  for (let i = 0; i < offset; i++) if (src[i] === '\n') line++;
  return line;
}

// Indentation of the line the offset sits on.
function indentAt(src, offset) {
  let start = src.lastIndexOf('\n', offset - 1) + 1;
  let end = start;
  while (end < src.length && (src[end] === ' ' || src[end] === '\t')) end++;
  return src.slice(start, end);
}

/**
 * Scan JS source for string literals.
 *
 * Returns:
 *   strings    every literal, with range, decoded value and structural path
 *   containers arrays that can be appended to (string arrays and record arrays)
 *   records    objects that are direct elements of an array, for duplication
 */
export function scanStrings(src, file = '') {
  const strings = [];
  const containers = [];
  const records = [];
  const stack = [];

  let i = 0;
  let topName = null;      // current top-level `const NAME =`
  let prevWord = null;     // previous identifier, to catch `const NAME`
  let expectName = false;

  const n = src.length;

  const pathOf = () => {
    let p = topName || '(file)';
    for (const f of stack) {
      if (f.type === '{') p += `.${f.key ?? '?'}`;
      else p += `[${f.index}]`;
    }
    return p;
  };

  // The nearest enclosing record's `id`, once we have seen it — used for labels
  // like "q04 · reply" instead of "QUERIES[3].reply".
  const nearestId = () => {
    for (let k = stack.length - 1; k >= 0; k--) if (stack[k].idValue) return stack[k].idValue;
    return null;
  };

  const noteElementStart = () => {
    const f = stack[stack.length - 1];
    if (f && f.elemStart === null) f.elemStart = i;
  };

  while (i < n) {
    const c = src[i];

    // whitespace
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }

    // comments
    if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      i = nl === -1 ? n : nl;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }

    // strings
    if (c === "'" || c === '"' || c === '`') {
      noteElementStart();
      const start = i;
      i++;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === c) { i++; break; }
        // A template literal may span lines and interpolate; skip ${...} whole.
        if (c === '`' && src[i] === '$' && src[i + 1] === '{') {
          let depth = 1;
          i += 2;
          while (i < n && depth > 0) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') depth--;
            i++;
          }
          continue;
        }
        i++;
      }
      const raw = src.slice(start, i);

      // A string followed by ':' is a property key, not a value.
      let j = i;
      while (j < n && /\s/.test(src[j])) j++;
      const isKey = src[j] === ':';
      const frame = stack[stack.length - 1];

      if (isKey && frame && frame.type === '{') {
        frame.key = decode(raw);
        strings.push(makeEntry({ raw, start, end: i, role: 'key', path: `${pathOf()}` }));
      } else {
        const path = pathOf();
        const propKey = frame && frame.type === '{' ? frame.key : null;
        const value = decode(raw);
        // Remember an `id` on the enclosing object so descendants can be
        // labelled by it rather than by array index.
        if (propKey === 'id' && frame) frame.idValue = value;
        if (frame && frame.type === '[') frame.stringElems++;
        strings.push(makeEntry({
          raw, start, end: i, role: 'value', path, propKey, value,
        }));
      }
      prevWord = null;
      continue;
    }

    // structure
    if (c === '{' || c === '[') {
      noteElementStart();
      const parent = stack[stack.length - 1];
      stack.push({
        type: c,
        key: null,
        index: 0,
        idValue: null,
        openAt: i,
        elemStart: null,
        stringElems: 0,
        otherElems: 0,
        lastElemStart: null,
        path: pathOf(),
        parentIsArray: !!parent && parent.type === '[',
        selfStart: parent && parent.type === '[' ? parent.elemStart : null,
      });
      i++;
      prevWord = null;
      continue;
    }

    if (c === '}' || c === ']') {
      const f = stack.pop();
      if (f) {
        // Close the final element.
        if (f.type === '[' && f.elemStart !== null) f.lastElemStart = f.elemStart;
        if (f.type === '[') {
          const kind = f.otherElems === 0 && f.stringElems > 0 ? 'string-array'
            : f.stringElems === 0 && f.otherElems > 0 ? 'record-array' : 'mixed-array';
          containers.push({
            file,
            path: f.path,
            kind,
            count: f.type === '[' ? f.index + (f.elemStart !== null ? 1 : 0) : 0,
            closeAt: i,
            indent: f.lastElemStart !== null ? indentAt(src, f.lastElemStart) : '  ',
          });
        }
        // An object that is a direct element of an array is a duplicable record.
        if (f.type === '{' && f.parentIsArray && f.selfStart !== null) {
          records.push({
            file,
            path: f.path,
            start: f.selfStart,
            end: i + 1,
            id: f.idValue,
            indent: indentAt(src, f.selfStart),
          });
        }
        // Tell the parent this element was not a bare string.
        const parent = stack[stack.length - 1];
        if (parent && parent.type === '[') parent.otherElems++;
      }
      i++;
      prevWord = null;
      continue;
    }

    if (c === ',') {
      const f = stack[stack.length - 1];
      if (f) {
        if (f.type === '[') {
          f.lastElemStart = f.elemStart;
          f.index++;
          f.elemStart = null;
        } else {
          f.key = null;
        }
      }
      i++;
      prevWord = null;
      continue;
    }

    if (c === ';') {
      if (stack.length === 0) topName = null;
      i++;
      prevWord = null;
      continue;
    }

    // identifiers and keywords
    if (ID_START.test(c)) {
      noteElementStart();
      const start = i;
      while (i < n && ID_PART.test(src[i])) i++;
      const word = src.slice(start, i);

      if (expectName) {
        topName = word;
        expectName = false;
      } else if (word === 'const' || word === 'let' || word === 'var' || word === 'function') {
        // Top-level declarations name the section. In a data file that is the
        // exported constant; in a UI file it is the function the copy sits in.
        if (stack.length === 0 || (word === 'function' && stack.length <= 1)) expectName = true;
      }

      // `key:` in an object literal
      let j = i;
      while (j < n && /\s/.test(src[j])) j++;
      const f = stack[stack.length - 1];
      if (src[j] === ':' && f && f.type === '{') f.key = word;

      prevWord = word;
      continue;
    }

    // Numeric keys: IDLE_BY_ERA is keyed by era number, and a path of
    // `IDLE_BY_ERA.?[3]` tells the author nothing about which era they are
    // editing.
    if (c >= '0' && c <= '9') {
      noteElementStart();
      const start = i;
      while (i < n && /[0-9.]/.test(src[i])) i++;
      let j = i;
      while (j < n && /\s/.test(src[j])) j++;
      const f = stack[stack.length - 1];
      if (src[j] === ':' && f && f.type === '{') f.key = src.slice(start, i);
      prevWord = null;
      continue;
    }

    noteElementStart();
    i++;
    prevWord = null;
  }

  function makeEntry({ raw, start, end, role, path, propKey = null, value = null }) {
    const v = value ?? decode(raw);
    return {
      file,
      path,
      role,
      propKey,
      value: v,
      raw,
      start,
      end,
      quote: raw[0],
      line: 0, // filled in below, in one pass
      section: topName || '(file)',
      recordId: nearestId(),
      kind: classify(role, propKey, v),
    };
  }

  // Line numbers in one pass, rather than a scan per string.
  let line = 1;
  let at = 0;
  for (const s of strings) {
    while (at < s.start) { if (src[at] === '\n') line++; at++; }
    s.line = line;
  }

  return { strings, containers, records };
}

// Copy is what a player reads. Everything else — class names, testids, ids,
// event keys — is structure that happens to be spelled with quotes. The editor
// shows copy by default and hides the rest behind a toggle, because in a UI
// file the structure outnumbers the prose several times over.
function classify(role, propKey, value) {
  if (role === 'key') return 'ident';
  if (propKey && IDENT_KEYS.has(propKey)) return 'ident';
  if (!/\s/.test(value)) return 'ident';          // class names, selectors, ids
  if (/^[a-z][a-z0-9-]*$/.test(value)) return 'ident';
  if (value.trim().length < 6) return 'ident';
  return 'copy';
}

export { decode, lineOf };
