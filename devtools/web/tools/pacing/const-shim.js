// Stands in for engine/constants.js inside the simulation frame.
//
// The import map in runner.html points /engine/constants.js here, so every
// engine module that imports './constants.js' gets THIS CONST — the real
// defaults with the tool's knobs laid over them. The engine itself is
// untouched and unaware; it is the same code the game ships.
//
// The real file is read through the /engine-raw mount, which the import map
// does not rewrite, so there is no loop.

import { CONST as REAL } from '/gamejs-raw/engine/constants.js';

export const CONST = Object.freeze({ ...REAL, ...(globalThis.__PACING_OVERRIDES__ || {}) });
