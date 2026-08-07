// Single source of truth for the released version. `just release X.Y.Z`
// rewrites VERSION here, tags the commit, and deploys.
//
// BUILD is a placeholder that the deploy workflow replaces with the short
// commit SHA and date of the build actually being published. Locally it
// stays "dev", so the settings panel always tells you whether you are
// looking at a real release or your working tree.
export const VERSION = '0.9.1';
export const BUILD = 'dev';

// Versioning scheme (0.x while Phase 1 is still moving):
//   0.x.0  a round of gameplay/design work (new mechanics, content, UI)
//   0.x.y  fixes and polish on that round
//   1.0.0  reserved for Phase 1 feature-complete, including sound
//   2.0.0  reserved for Phase 2 (the logistical server)
