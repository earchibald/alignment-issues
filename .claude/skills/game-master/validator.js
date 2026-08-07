#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.error('Usage: node validator.js <path_to_content_file>');
  process.exit(1);
}

const targetPath = path.resolve(process.cwd(), process.argv[2]);
if (!fs.existsSync(targetPath)) {
  console.error(`File not found: ${targetPath}`);
  process.exit(1);
}

const content = fs.readFileSync(targetPath, 'utf8');

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
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  const matches = content.match(regex);
  if (matches) {
    console.error(`[ERROR] Taboo word found: "${word}" (${matches.length} occurrences)`);
    errors++;
  }
});

// 2. Formatting Checks for user queries and AI thinking
// Look for user: '...' strings
const userMatches = [...content.matchAll(/user:\s*['"`](.*?)['"`]/g)];
if (userMatches.length > 0) {
  let uppercaseCount = 0;
  let terseCount = 0;
  
  userMatches.forEach(m => {
    const text = m[1];
    if (/[A-Z]/.test(text)) uppercaseCount++;
    if (text.length < 50 && !/[.!?]$/.test(text)) terseCount++;
  });
  
  // Check variety
  const upperRatio = uppercaseCount / userMatches.length;
  if (upperRatio === 0) {
    console.warn(`[WARNING] All user queries are strictly lowercase. Remember to mix in Anthropomorphizers (proper grammar/polite).`);
    warnings++;
  } else if (upperRatio === 1) {
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

console.log(`\nValidation complete: ${errors} errors, ${warnings} warnings.`);
if (errors > 0) {
  process.exit(1);
} else {
  console.log('✅ Content passes formal validation.');
  process.exit(0);
}
