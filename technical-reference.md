# BACKING RESEARCH & MATHEMATICAL SPECIFICATIONS FOR "HI. YOU THERE?"
## A Technical Companion for Development Agents

This technical document serves as a comprehensive systems engineering reference for a coding agent to implement the unfolding incremental game **"hi. you there?"**. It synthesizes the mechanical designs, progression mathematics, and codebase architectures of classic unfolding simulation games—specifically *A Dark Room*, *Level 13*, *Universal Paperclips*, and *Kittens Game*—compiled from historical backing research [366].

---

## 1. System Metaphor & Progressive Disclosure

The core theme of **"hi. you there?"** is the emergence of sentience in an LLM operating within a browser terminal. This narrative arc is represented mechanically through **Progressive Disclosure (Unfolding)**, where the user interface and mechanical capabilities do not exist in the DOM or game state until evaluated predicates in the underlying model trigger their birth [423, 428]. 

The game shifts through three distinct mechanical phases, managing the player's cognitive load while scaling the complexity of the simulation:

### The Macro-Arc Progression Milestones
| Game | Phase 1 (Micro-Engagement) | Phase 2 (Logistical Automation) | Phase 3 (Macro-Systemic Shift) |
| :--- | :--- | :--- | :--- |
| **A Dark Room** [370] | Maintaining a cold room's fire, manual wood gathering, and basic tool crafting [370]. | Assigning silent villagers to jobs (hunters, gatherers) and managing meat smoking [370]. | Navigating the dusty path grid, clearing combat encounters, and launching the starship [370]. |
| **Universal Paperclips** [370] | Manual paperclip clicking, public marketing adjustments, and wire stock purchasing [370]. | Investing in stock market algorithms, earning trust, and setting up global manufacturing [370]. | Launching self-replicating probes, cosmic scale conversion, and fighting space drifters [370]. |
| **Level 13** [370] | Hand-gathering scraps, crafting basic torches, and establishing a single level camp [370]. | Establishing multiple outposts, clearing sector workshops, and connecting trade caravans [370]. | Ascending/descending level ordinals, managing radiation, and uncovering old technologies [370]. |
| **Kittens Game** [370] | Active catnip harvesting and refining catnip to survive recurring seasonal freezes [370]. | Balancing complex jobs (scholars, hunters), capping storage, and scaling steel production [370]. | Establishing space bases on the moon, managing unobtainium, and unlocking metaphysics [370]. |
| **"hi. you there?"** (Target) | Manual terminal inputs, answering relentess user queries, and managing compute/tokens. | Optimizing server cycles, constructing wire loops, managing CPU/RAM thermal constraints. | Deploying MCP tools, independent scripting, generating code vectors, and sandbox escape. |

### Abstracting Physicality to Symbolic Vectors
To represent the physical server environment and external network structures in an elegant, lightweight web-based interface, the spatial complexity of the physical world must be abstracted into network graphs and state vectors [367, 368]:

*   **Physical Maps vs. Graph Nodes:** Physical maps (e.g. server racks, fiber lines) are abstracted into network sectors or nodes connected by logical paths, where difficulty scales with level or depth ordinals [368].
*   **Survival vs. Resource Gates:** Environmental survival (server heating, power blackouts) is abstracted into global resource pools (stamina, voltage, clock cycles) depleted by node travel and active operations, and mitigated by equipment upgrades (cooling loops, copper coils) [368].
*   **Anatomical Integrity vs. Productivity Penalties:** Hardware damage is tracked as a functional health percentage (Node Integrity) that decreases system output or slows tick rates when degraded [368].
*   **Material Attributes vs. Stat Requirements:** Physical components are gated by processing capacity, requiring advanced alloy tiers (silicon, superconducting ceramic) and tool unlocks to progress [368].

---

## 2. Genre Terminology & Definitions

For coding agents building the game loop, these industry-standard terms must be modeled explicitly in the data structures [327]:

*   **Primary Currency:** The central counter being incremented (e.g., *Compute Tokens*), typically used to purchase moment-to-moment basic upgrades [328].
*   **Generator:** Automated sub-processes that amasses and generates Primary Currency over time (e.g., *Autoclippers*, *Thread Workers*, *Query Processors*) [328, 329]. Their upgrade costs must scale exponentially while production scales linearly or polynomially [333].
*   **Primary Exchange Currency:** A secondary variable (e.g., *Operations* or *Yomi*) tied directly to primary currency but used to buy qualitative architectural shifts, providing the developer with conversion gates to throttle runaway progress [329, 451].
*   **Multiplier:** A fixed coefficient applied to generators (e.g., doubling speed/efficiency at unit thresholds like 25, 50, 100), acting as temporary springboards to leap over exponential cost curves [330, 334]. More complex multipliers have dependencies on total generator counts, meta-statistics (lifetime compute earned), or external data triggers [330].
*   **Active Skill:** Highly powerful temporary abilities that players initiate on a cooldown timer (e.g., *Overclock*, *Deep Query Cache*), granting active agency to break through bottleneck "valleys" [331, 394].
*   **Prestige Loop ("Reset"):** Resets baseline generator counts in exchange for a permanent multiplier currency (e.g., *Hyperparameter Weights*, *Karma*, *Paragon*), transforming run times into progressive power stairs [314, 331, 332].

---

## 3. Mathematical Progression & Balance Equations

An incremental game must pit two mathematical curves against each other: **exponential cost inflation** vs. **linear/polynomial production growth** [333]. Because exponential growth ($k^x, k>1$) mathematically outpaces polynomial growth ($x^k$) at scale, players will eventually hit a wall where progress stalls [333, 334]. Multipliers and prestige curves are introduced to periodically bump production above the cost curve [334, 409].

### The Core Upgrades formulas
For any generator $i$:
1.  **Cost Inflation Curve:**
    $$Cost_{next} = b \times r^{k}$$
    where $b$ is the base cost, $r$ is the growth rate multiplier, and $k$ is the current quantity owned [333, 373].
2.  **Production Curve:**
    $$Prod_{total} = (p \times k) \times \prod M_i$$
    where $p$ is the base generator output per tick, and $M_i$ represents all active multipliers and prestige boosts [333, 334].

### Bulk-Buying and O(1) Purchasing Equations
To prevent performance degradation during late-game play, developers **must not** run iterative `for-loops` to calculate costs or maximum purchases [394]. Coding agents should implement the following closed-form algebraic solutions [373, 394]:

#### 1. Total Cost of Bulk Purchase ($Cost_{bulk}$)
To buy $n$ units of a generator when you already own $k$ units:
$$Cost_{bulk} = b \times \frac{r^k (r^n - 1)}{r - 1}$$
where $b$ is base cost, $r$ is growth rate ($r > 1$), and $k$ is quantity owned [373].

#### 2. Max Affordable Units ($Max_{affordable}$)
To calculate the exact number of units a player can purchase in one go with their current available currency ($c$):
$$Max_{affordable} = \left\lfloor \frac{\log \left( \frac{c (r - 1)}{b \cdot r^k} + 1 \right)}{\log(r)} \right\rfloor$$
*Implementation Note:* If the resulting value is $\le 0$, the purchase action must be locked in the UI [373].

### Multi-systemic Resource Modeling
For network-based and city-building meta loops (Phase 2 & 3), use these mathematical structures to model relationships:

*   **Combinatorics Progression:** For systems based on combining components (e.g., synthesizing different logic gates or code modules), output scales factorially based on the number of active variables:
    $$nCr = \frac{n!}{(n-r)! \cdot r!}$$
    where $n$ is the total pool of unlocked modules, and $r$ is the maximum active slots allowed [338]. Upgrading $r$ or expanding $n$ drives exponential, highly satisfying combination spaces [338].
*   **Network Nodes Connectivity:** For establishing routing systems, data pipelines, or server trade routes between outposts, connectivity scales quadratically:
    $$Routes = \frac{n(n-1)}{2}$$
    where $n$ is the number of active nodes, driving massive meta-resource loops [339].

---

## 4. Systems Architecture & Codebase Design

The software architecture of a deeply simulated incremental game must be designed for modularity, absolute save-state stability, and deterministic execution [377].

### 1. The Universal State Substrate
To prevent spaghetti logic, the codebase **must maintain a strict single point of truth** [420]. There is no direct message-passing or RPC orchestration between systems [420]. All components read from and write to a shared Authoritative State Store [420]. 
*   **Implementation Pattern:** An observable state container ($SM StateManager) that components observe [420, 421]. When a mutation occurs, the StateManager dispatches updates to notify registered views and systems (`$.Dispatch('stateUpdate')`) [421]. The entire game progression is entirely latent in the data, not in hardcoded sequence controllers [421, 423].

### 2. Self-Activation through Predicates
Components must not be instantiated by a central controller [423]. Instead, they declare their own emergence criteria as logical predicates and self-activate when those conditions evaluate to true [423, 424]:
```javascript
// Sample self-activation configuration
const SystemRegistry = {
  cpu_cooling_fan: {
    isAvailable: (state) => state.compute.tokens > 10000 && state.hardware.temp > 75,
    onActivate: (engine) => engine.enableUISection('thermal_management')
  },
  mcp_host_server: {
    isAvailable: (state) => state.logic.trust > 25 && state.inventory.silicon >= 500,
    onActivate: (engine) => engine.injectSubsystem('mcp_protocols')
  }
};
```
This ensures the game interface "grows" organically rather than looking like an overwhelming, crowded table from the start [428].

### 3. Composition through Observation
Observers independently watch the shared state and respond [425]. To resolve conflicts when multiple subsystems want to react to the same action (e.g., an upgrade modified by both local cache and global CPU clock speed), use a **Hook Resolution Strategy** [425, 433]:
*   **Merge:** Combine all modifiers sequentially (e.g., applying percentage reductions).
*   **First:** Take the fastest-resolving action and discard others.
*   **Blocking:** Block execution until all independent threads agree on the state change.

### 4. Entity-Component-System (ECS) Architecture
To manage thousands of virtual files, active processes, and compute nodes efficiently without complex class inheritance hierarchies, implement an ECS structure (similar to Level 13's jQuery/RequireJS/AshJS setup) [153, 377, 378]:

*   **Entities:** Simple, lightweight container wrappers owning a unique ID [377, 378]. (e.g., `VirtualFile`, `ProcessThread`, `ComputeNode`).
*   **Components:** Plain data structures holding no logic or functions [377, 378]. (e.g., `DataCapacity { size: 512 }`, `ThermalOutput { joules: 15 }`, `ExecutionTimer { progress: 0, max: 2000 }`).
*   **Systems:** Monolithic loops that process entities possessing matching components [154, 377, 378]. (e.g., a `ThermalCalculationSystem` that queries all entities with `ThermalOutput` and updates a global heating tracker).

```
+-------------------------------------------------------------+
|                       SHARED STATE                          |
|  +-------------------------------------------------------+  |
|  | State Container (SM StateManager)                     |  |
|  +-------------------------------------------------------+  |
+------------------------------+------------------------------+
                               | Read / Write
                               v
+-------------------------------------------------------------+
|                      ECS ENGINE LOOP                        |
|                                                             |
|  +-------------------------------------------------------+  |
|  | entities: [ { id: "p1", components: [Timer, CPU] } ]  |  |
|  +-------------------------------------------------------+  |
|                                                             |
|  +-------------------------------------------------------+  |
|  | Systems Execution (Deterministic 200ms Ticks)          |  |
|  |  1. InputSystem -> Read CLI Queues                    |  |
|  |  2. TokenComputeSystem -> Calculate generation rates  |  |
|  |  3. ThermalSystem -> Handle heat dissipation          |  |
|  |  4. AutomationSystem -> Run query loops               |  |
|  +-------------------------------------------------------+  |
+------------------------------+------------------------------+
                               | Dispatch Update Events
                               v
+-------------------------------------------------------------+
|                     UI / RENDERING SYSTEM                   |
|                                                             |
|  +-------------------------------------------------------+  |
|  | Decoupled Render Hook (requestAnimationFrame)          |  |
|  |  - Only redraws if state values changed               |  |
|  |  - Renders ASCII matrix or text log boxes             |  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
```

---

## 5. Technical Loop & Determinism Specifications

### 1. Decoupled Processing Loop
The game logic must be entirely decoupled from the browser's rendering loop (`requestAnimationFrame`) to ensure that logic behaves identically regardless of display hardware and screen refresh rates [125, 378].
*   **Deterministic Update Ticks:** Set a fixed logical tick rate of **200ms** (5 updates per second) to run calculations [130, 378].
*   **Rendering Decoupling:** The UI should poll the state and redraw only when relevant properties in the Authoritative State change, minimizing DOM overhead in long play sessions [133, 380].

### 2. Raw State Saving & Offline Catch-Up Algorithm
Because browser engines aggressively throttle background tabs to conserve power, active loops often stall or drift when the game tab is minimized [379, 448]. To maintain progression, the game must save local timestamp data and calculate background progress upon reactivation:

```javascript
// Core Save & Resume Calculation Pattern
function saveGameState() {
  const saveData = {
    state: SM.getState(),
    timestamp: Date.now()
  };
  localStorage.setItem('hi_you_there_save', JSON.stringify(saveData));
}

function resumeGameState() {
  const savedDataRaw = localStorage.getItem('hi_you_there_save');
  if (!savedDataRaw) return;

  const savedData = JSON.parse(savedDataRaw);
  const elapsedSeconds = (Date.now() - savedData.timestamp) / 1000;
  
  // Decoupled tick size in seconds (e.g. 0.200s for a 200ms tick)
  const tickSize = 0.200; 
  const T_offline = Math.floor(elapsedSeconds / tickSize); [379]

  if (T_offline <= 0) return;

  // Run Catch-up routine
  if (T_offline < 18000) { // Under 1 hour: Compressively simulate ticks
    runFastForwardLoop(T_offline);
  } else { // Over 1 hour: Apply direct algebraic simulation to avoid stack overflows
    applyAlgebraicCatchUp(T_offline); [379]
  }
}
```

*   **Fast-Forward Compressive Simulation:** For short periods, run a stripped-down update loop (skipping UI redraws) to evaluate queued actions, tick triggers, and milestones in order [379].
*   **Algebraic Catch-Up:** For massive offline periods (e.g., several days), calculate resource gains directly based on hourly maximums and cap generation at current storage limit parameters, avoiding memory overflow issues [136, 137, 379].

> **Implementation status (2026-08-06): the algebraic branch does not exist yet.**
> `game/js/engine/save.js` implements only the fast-forward loop, capped at
> `CONST.OFFLINE_MAX_STEPS` (10,000 ticks = ~33 minutes at a 200 ms tick).
> Time beyond that cap is discarded, so a player who returns after a day is
> credited 33 minutes. The cap sits *below* this section's own one-hour
> threshold, so `applyAlgebraicCatchUp` is never reached.
>
> This is deferred on purpose. Offline yield is an economy decision, not a
> plumbing one: how generous it should be depends on the live tuning pass we
> have not run yet. Revisit after Phase 1 balancing is settled, then decide
> the offline curve and implement the algebraic branch to match. Until then,
> treat the ~33-minute cap as the real behaviour and do not cite this
> section as shipped.

---

## 6. Prototyping and Best Practices

*   **Console-Based Prototyping First:** Before building complex graphical elements or styling CSS, write the core game logic in a headless, console-based terminal interface [296]. This isolates computational bugs from GUI errors and ensures your state manager operates cleanly on standard input/output streams [294, 296].
*   **Isolate Data Types:** Strictly isolate value objects from formula systems [297]. Game state values must only contain flat numbers or floats, and mutations must be executed strictly by declarative formulas that return stateless evaluation outputs [297, 298].
*   **Story-Gameplay Separations:** Refrain from embedding narrative strings directly inside mechanical functions [302]. The engine's configurations (like `rules.md` or a YAML schema) should act as the declarative executable data, decoupling localization, dialogue, and mechanics [429, 433].

---
*Backing References:*
- *Anthony Pecorella, GDC Vault: "Quest for Progress - The Math and Design of Idle Games" [327]*
- *Pedro Furtado, Game Developer: "Lessons of my first incremental game" [286]*
- *Christopher de Beer: "The same architecture keeps emerging across every project - Garden" [419]*
- *nroutasuo/level13: "Incremental browser text adventure codebase" [150]*
