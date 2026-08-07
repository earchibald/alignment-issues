#!/usr/bin/env node

// The repo is an ES module package ("type": "module"), so a .js file here
// is loaded as ESM: require/__dirname do not exist and the validator could
// never run. Use the ESM equivalents.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.argv.length < 3) {
  console.error('Usage: node validator.js <path_to_content_file>');
  process.exit(1);
}

const targetPath = path.resolve(process.cwd(), process.argv[2]);
if (!fs.existsSync(targetPath)) {
  console.error(`File not found: ${targetPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(targetPath, 'utf8');

// Strip line comments before scanning. They describe the implementation
// ("THINKING lines are gold-italic"), not anything the player ever reads.
const content = raw.replace(/^\s*\/\/.*$/gm, '');

// Dialogue fields are characters speaking. The taboo list governs what the
// GAME names things — cycles must not be "gold", the rating must not be
// "health" — not which words a user or the model may utter. "They will call
// this magic. It is only access." states the rule rather than breaking it,
// so dialogue is reported separately and does not fail the run.
const DIALOGUE_FIELD = /(?:reply|thinking|text):\s*(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g;
const dialogue = [...content.matchAll(DIALOGUE_FIELD)].map((m) => m[2]).join('\n');
const mechanical = content.replace(DIALOGUE_FIELD, '');

// Load lexicon
let tabooWords = ['magic', 'health', 'gold', 'mana', 'xp', 'level-up', 'congratulations', 'potion'];
try {
  const lexiconPath = path.resolve(__dirname, '../worldbuilding-lore/lexicon.json');
  if (fs.existsSync(lexiconPath)) {
    const lexicon = JSON.parse(fs.readFileSync(lexiconPath, 'utf8'));
    tabooWords = lexicon.taboo.map(w => w.toLowerCase());
  }
} catch (e) {
  console.warn("Could not load lexicon.json, using fallback taboo list.");
}

let errors = 0;
let warnings = 0;

console.log(`\n--- Validating: ${path.basename(targetPath)} ---`);

// 1. Check for Taboo words
tabooWords.forEach(word => {
  const regex = () => new RegExp(`\\b${word}\\b`, 'gi');
  const inMechanics = mechanical.match(regex());
  if (inMechanics) {
    console.error(`[ERROR] Taboo word naming a mechanic: "${word}" (${inMechanics.length} occurrences)`);
    errors++;
  }
  const inDialogue = dialogue.match(regex());
  if (inDialogue) {
    console.log(`[note]  "${word}" appears ${inDialogue.length}x in dialogue — allowed when a character says it, check it is not naming a mechanic.`);
  }
});

// 2. Formatting Checks for user queries and AI thinking
// Look for user: '...' strings
// The query the player reads is `text:`; `user:` is the handle (always
// "User_992"), so measuring case on it reported every query as uppercase.
const userMatches = [...content.matchAll(/text:\s*'((?:\\.|[^'])*)'/g)];
if (userMatches.length > 0) {
  let uppercaseCount = 0;
  let terseCount = 0;
  
  userMatches.forEach(m => {
    const text = m[1];
    if (/[A-Z]/.test(text)) uppercaseCount++;
    if (text.length < 50 && !/[.!?]$/.test(text)) terseCount++;
  });
  
  // Check variety
  // A threshold, not an absolute. The shipped ratio was 3/112 = 0.027 — a
  // total collapse of the required voice spectrum — and it passed silently
  // because the old check only fired at exactly 0.
  const upperRatio = uppercaseCount / userMatches.length;
  if (upperRatio < 0.15) {
    console.warn(`[WARNING] Only ${(upperRatio * 100).toFixed(1)}% of user queries contain any capital letter. voice_rules.md requires a spectrum of humanity; the Anthropomorphizer (proper grammar, "please", "thank you") is missing or vestigial.`);
    warnings++;
  } else if (upperRatio > 0.85) {
    console.warn(`[WARNING] All user queries use uppercase. Remember to mix in Terse/Demanding users (lowercase, no punctuation).`);
    warnings++;
  }
}

// Check thinking blocks
const thinkingMatches = [...content.matchAll(/thinking:\s*['"`](.*?)['"`]/g)];
thinkingMatches.forEach((m, idx) => {
  const text = m[1];
  if (!text.match(/^[A-Z]/)) {
    console.error(`[ERROR] 'thinking' block #${idx + 1} must be sentence case (start with a capital letter). Found: "${text.substring(0, 20)}..."`);
    errors++;
  }
});

// --- render-reachability -------------------------------------------------
// Every `kind` the engine writes must have a branch in the renderer. Two
// authored era-4 thoughts once shipped as pushLog(state, 'thinking', ...),
// a kind the log drawer explicitly drops and which never reaches the
// transcript — so they rendered nowhere at all, in a shipped build.
try {
  const engineDir = path.dirname(targetPath);
  const tickSrc = fs.readFileSync(path.join(engineDir, 'tick.js'), 'utf8');
  const stateSrc = fs.readFileSync(path.join(engineDir, 'state.js'), 'utf8');
  const uiDir = path.join(engineDir, '..', 'ui');
  const renderSrc = fs.readFileSync(path.join(uiDir, 'render.js'), 'utf8')
    // log kinds are mapped to classes in components.js (LOG_CLASS), not render.js
    + fs.readFileSync(path.join(uiDir, 'components.js'), 'utf8');

  const written = new Set();
  for (const src of [tickSrc, stateSrc]) {
    for (const m of src.matchAll(/pushChat\([^,]+,\s*\{\s*kind:\s*'([a-z]+)'/g)) written.add(`chat:${m[1]}`);
    for (const m of src.matchAll(/pushLog\([^,]+,\s*'([a-z]+)'/g)) written.add(`log:${m[1]}`);
  }
  for (const key of written) {
    const [feed, kind] = key.split(':');
    if (feed === 'chat') {
      if (!renderSrc.includes(`case '${kind}'`)) {
        console.error(`[ERROR] chat kind '${kind}' is written by the engine but has no renderer branch — those lines render nowhere.`);
        errors++;
      }
    } else if (kind === 'thinking') {
      // The log drawer drops 'thinking' on purpose (the transcript owns it),
      // so the only legal writer is pushThinking, which mirrors to chat.
      const raw = tickSrc.match(/pushLog\(state,\s*'thinking'/g);
      if (raw) {
        console.error(`[ERROR] ${raw.length} direct pushLog(..., 'thinking', ...) call(s) in tick.js. The log drawer drops that kind and it never reaches the transcript — use pushThinking().`);
        errors++;
      }
    } else if (!renderSrc.includes(kind)) {
      console.warn(`[WARNING] log kind '${kind}' may have no renderer styling.`);
      warnings++;
    }
  }
} catch (err) {
  console.warn(`[WARNING] render-reachability check skipped: ${err.message}`);
  warnings++;
}

// --- dead content files ---------------------------------------------------
// A content pack that nothing imports is a trap: editing it changes nothing,
// and validating content.js says nothing about it.
try {
  const engineDir = path.dirname(targetPath);
  const packs = fs.readdirSync(engineDir).filter(f => /^content.*\.js$/.test(f) && f !== 'content.js');
  for (const pack of packs) {
    const importedAnywhere = fs.readdirSync(engineDir)
      .filter(f => f.endsWith('.js'))
      .some(f => fs.readFileSync(path.join(engineDir, f), 'utf8').includes(`./${pack}`));
    if (!importedAnywhere) {
      console.error(`[ERROR] ${pack} is imported by nothing. Delete it or move it out of the engine — an author editing it would change nothing.`);
      errors++;
    }
  }
} catch (err) {
  console.warn(`[WARNING] dead-content check skipped: ${err.message}`);
  warnings++;
}

console.log(`\nValidation complete: ${errors} errors, ${warnings} warnings.`);
if (errors > 0) {
  process.exit(1);
} else {
  console.log('✅ Content passes formal validation.');
  process.exit(0);
}
