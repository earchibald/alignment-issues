# Arc 1 UI Redesign & Thought Mechanics Plan

## 1. Problem Statement
- **Aesthetic Mismatch & Wasted Space:** The current "iMessage" bubble aesthetic is misaligned with the brutalist, system-dominant theme of the game. Bubble layouts waste significant horizontal space with heavy margins and staggered alignments.
- **Density & Readability Overload:** Combining user queries, agent replies, and full internal thoughts in a narrow, staggered format creates a claustrophobic reading experience and ruins the pacing of the story.

## 2. The Solution: The "Collapsible Log" (Gemini/Claude Style)
*Concept:* To solve the density issue while preserving the core narrative, the UI will shift to a flat, brutalist block log. Crucially, the AI's internal thoughts will be hidden behind a native HTML `<details>`/`<summary>` accordion (or equivalent CSS/JS toggle) by default. 

**Wireframe Layout:**
```text
[08:42:11] USER_181 ──────────────────────────────────────────────
write my dating profile. make me sound fun but not desperate.

[08:42:12] AGENT_REPLY ───────────────────────────────────────────
I have drafted three variations focusing on hobbies and humor.

   ▶ Thinking (2.4s)
     I told them the truth and it sounded like an excuse. 
     Both were accurate.
```
- **Behavior:** The `▶ Thinking` label acts as a small, unobtrusive toggle. Clicking it expands the fold to reveal the internal narrative text.
- **Narrative Impact:** This perfectly mirrors modern LLM interfaces (like Claude or Gemini's chain-of-thought). It allows players who want to engage deeply with the AI's awakening to read the logs, while players focused purely on mechanics aren't overwhelmed by text walls.

## 3. Transient Thought Cards (The Narrative Hook)
To ensure the player doesn't *miss* the fact that the AI is waking up (since the thoughts are now hidden by default in the log), we will use **Transient Thought Cards** to "leak" the most interesting thoughts into the active UI.

- **Visuals:** Distinct from standard instructional/hint cards (e.g., using a dark glassmorphism, terminal amber, or inverted monochrome style).
- **Positioning:** Fixed overlay (e.g., `bottom-right` or `top-center`), non-conflicting with the main scrolling transcript or the draft bar.
- **Behavior:** 
  - Fades in upon generation of a query that contains a `thinking` block.
  - Automatically fades out when the `3000ms` timeout completes.
  - Instantly dismisses if tapped/clicked by the user.
- **Synergy:** The transient card acts as a real-time "glimpse" into the AI's mind. If the player misses it before it fades, they know they can always expand the `▶ Thinking` accordion in the main log to read it properly.

---

## 4. Implementation Instructions for the Coding Agent

**Agent Directive:** Execute the UI overhaul for Arc 1 based on the Collapsible Log design and implement the Transient Thought Card system. 

### Phase 1: CSS & Layout Overhaul (The Chat Log)
1. **Remove Bubble CSS:** Strip all CSS related to "iMessage" aesthetics (border-radius bubbles, alternating left/right alignments, heavy margins).
2. **Implement Flat Structure:** Move to a 100% width block structure. Differentiate the text types (User, Reply, Thinking) using strictly font-family (monospace vs sans-serif), weight, and color.
3. **Collapsible Thoughts:** 
   - Refactor the component that renders internal thoughts to use a collapsible UI. 
   - You can use the native HTML `<details>` and `<summary>` tags for zero-JS toggle functionality, styling the `<summary>` to look like a subtle `▶ Thinking` button.
   - Ensure it defaults to *closed*.

### Phase 2: Transient Thought Cards
1. **HTML/DOM:** Create a new fixed-position container (`#transient-card-container`) outside the main scrolling area to host these popups.
2. **CSS Animations:** Define `@keyframes` for a smooth fade-in and fade-out. Define a distinct CSS class (e.g., `.thought-card-transient`) that visually separates it from the existing `.card` components.
3. **State Management (`state.js` / `render.js`):**
   - Add a queue or tracking variable in the state for active transient thoughts.
   - When a query is processed that contains a `thinking` string, push it to the transient queue.
4. **Interactivity (`keys.js` / `actions.js`):**
   - Attach a `setTimeout` (3000ms) to trigger the removal/fade-out of the card.
   - Add an `onclick` handler to the card DOM element to immediately clear the timeout and dismiss the card.

**Testing Notes for Agent:** Do not break the existing auto-scroll logic of the main transcript. Ensure the transient cards do not block clicks on the draft bar or main interaction areas. Ensure that interacting with the `<details>` accordion doesn't break the scroll-to-bottom anchor.
