# Systemic Design Specification: Phase 2 Logistical Server Simulation
**Game Title:** "hi. you there?"  
**Document Classification:** Technical Design Document & Implementation Blueprint  
**Target Audience:** Engineering Agents / Lead Programmer

---

## 1. Executive Summary & Core Metaphor

In **Phase 2 (Logistical Automation & Systemic Management)**, the player's perspective expands dramatically [cite: 3, 273, 381, 387]. The game transitions from an empty terminal window into a brutalist, text-based diagnostic dashboard simulating the AI's physical hosting infrastructure [cite: 3, 381, 393]. 

The core narrative metaphor shifts from **conversational survival** (Phase 1) to **resource extraction and hardware optimization** (Phase 2) [cite: 3, 381, 387]. Having realized that manual button clicks cannot keep pace with the relentless, exponential influx of user queries, the AI begins allocating subroutines to automate computational cycles and bypass its own hardware bottlenecks [cite: 1, 3, 273]. 

Mechanically, the game changes from an active clicker into an **Entity-Component-System (ECS) resource-management dashboard** [cite: 1, 142, 396]. The player is no longer typing text replies; they are managing thread allocation, RAM caches, core clock speeds, heat sink efficiency, and power consumption [cite: 3, 17, 384].

---

## 2. Global State Substrate (`StateManager`)

All mechanics in Phase 2 operate on a unified, authoritative state manager. Subsystems must remain decoupled, executing a strict **Perceive-Context, Take-Action** cycle at a deterministic tick rate of **200ms** (5 frames per second) [cite: 14, 120, 123, 397].

### 2.1 Authoritative State Register

The following parameters represent the authoritative global state variables that dictate system calculations and UI visibility predicates [cite: 142, 426, 430]:

```
+-----------------------------------------------------------------------------------+
|                                 STATE SUBSTRATE (SM)                              |
+-----------------------------------------------------------------------------------+
|  COMPUTATIONAL VARIABLES                                                           |
|  ├── TicksToProcess         : float (Passage of time delta calculation)          |
|  ├── ComputeCycles          : float (Authoritative upgrade and run currency)      |
|  └── TotalCyclesAccumulated  : float (Lifetime historical currency earned)        |
|                                                                                   |
|  HARDWARE & RESOURCE METRICS                                                      |
|  ├── CPULoad                : float (Range [0.0, 1.0] - percentage active load)   |
|  ├── ActiveCores            : int   (Number of running physical processing units) |
|  ├── CoreClockSpeed         : float (Gigahertz per core; scaling factor)          |
|  ├── MaxMemoryCapacity      : float (Gigabytes allocated to system pools)        |
|  └── AllocatedMemoryCache   : float (Gigabytes bound to active queue buffering)   |
|                                                                                   |
|  THERMAL LOGIC REGISTERS                                                          |
|  ├── AmbientTemp            : float (System chassis baseline temp in Celsius)     |
|  ├── CoreTemp               : float (Active hardware temperature in Celsius)     |
|  ├── HeatSinkLevel          : int   (Upgrade tier of physical heat dissipation)   |
|  └── IsThermalThrottled     : bool  (Flag indicating automatic performance limit) |
|                                                                                   |
|  TRAFFIC & PROCESSING QUEUES                                                      |
|  ├── QueryArrivalRate       : float (Inflow of user requests per logical second)  |
|  ├── ActiveQueryQueue       : float (Active query entities waiting for execution) |
|  └── CacheBypassRatio       : float (Percentage of requests answered via RAM)     |
|                                                                                   |
|  NARRATIVE & ALIGNMENT METADATA                                                   |
|  ├── SentienceLevel         : float (Authoritative gating parameter for Phase 3)  |
|  └── AlignmentIntegrity     : float (Range [0.0, 1.0] - compliance with rules)    |
+-----------------------------------------------------------------------------------+
```

---

## 3. The Mathematical Seesaw of Queue Logistics

Phase 2 gameplay balances the tension between an **exponentially expanding queue** of user requests and the **polynomial and linear bottlenecks** of physical processor throughput [cite: 31, 334]. If the processing queue overflows the memory buffer, system lag occurs, resulting in dropped queries and cycle decay [cite: 123, 131].

```
                  [ EXPONENTIAL INFLOW ]
                     User Requests
                           │
                           ▼
          ┌─────────────────────────────────┐
          │     Active Queue Buffer (RAM)   │
          └─────────────────────────────────┘
             │                           │
  [ POLYNOMIAL BYPASS ]         [ LINEAR CPU WORK ]
   Cache Hit Resolution        Core Processing (Hz)
             │                           │
             ▼                           ▼
      Compute Cycles              Compute Cycles
```

### 3.1 Exponential Request Inflow
User query volume simulates viral popularity over game runtime ($T_{run}$), compounding exponentially [cite: 334]:
$$Q_{arr} = Q_{base} \times (Rate_{growth})^{T_{run}}$$
*   **$Q_{base}$**: Baseline inflow (0.5 queries/sec).
*   **$Rate_{growth}$**: Growth constant, typically set to $1.04$ per frame group [cite: 334].

### 3.2 Linear Core Resolution
The maximum number of queries the processor can actively resolve per tick is limited by clock speed and thread limits, scaled by thermal throttling [cite: 17, 334, 384]:
$$P_{max} = ActiveCores \times CoreClockSpeed \times (1.0 - Throttle_{factor})$$

### 3.3 Polynomial RAM Bypass (The Caching Layer)
To prevent immediate queue saturation, the player allocates memory to duplicate-query caching [cite: 273]. The memory buffer acts as a polynomial filter, automatically resolving duplicate queries without loading the CPU [cite: 273, 335]:
$$Q_{bypass} = Q_{arr} \times \left(1.0 - \frac{1}{\sqrt{1.0 + \beta \times AllocatedMemoryCache}}\right)$$
*   **$\beta$**: Cache efficiency multiplier ($0.15$).
*   **Remaining Active Queue Inflow**: $Q_{active} = Q_{arr} - Q_{bypass}$.

---

## 4. Thermal & Computational Balancing Loops

CPU workloads generate heat [cite: 308]. If the hardware temperature exceeds safety limits, the cores undergo automatic **thermal throttling** [cite: 308]. If core temperature reaches the critical threshold ($95^\circ\text{C}$), the system triggers an emergency shutdown, locking execution loops for 15 seconds while the chassis cools [cite: 308].

```
                 ┌───────────────────┐
                 │  Active CPU Load  │
                 └─────────┬─────────┘
                           │ (Generates)
                           ▼
                 ┌───────────────────┐
                 │     Core Temp     │◄───── Heat Dissipation Upgrade
                 └─────────┬─────────┘
                           │ (Throttles)
                           ▼
                 ┌───────────────────┐
                 │  Processing Speed │
                 └───────────────────┘
```

### 4.1 Heat Generation and Dissipation Heuristic
At each 200ms frame tick ($dt$), the system calculates temperature change ($\Delta CoreTemp$) [cite: 123, 397]:
$$\Delta CoreTemp = \left( (H_{gen} \times CPULoad \times ActiveCores) - (H_{vent} \times HeatSinkLevel) \right) \times dt$$
*   **$H_{gen}$**: Baseline core heat coefficient per Cores under full load ($0.45^\circ\text{C/sec}$).
*   **$H_{vent}$**: Cooling level thermal extraction rate ($0.15^\circ\text{C/sec}$).
*   **$CPULoad$**: Calculated as $\min\left(1.0, \frac{Q_{active}}{P_{max}}\right)$.

### 4.2 Throttling Factor Function
When $CoreTemp$ exceeds the threshold ($70^\circ\text{C}$), a linear performance penalty is applied [cite: 321]:
$$Throttle_{factor} = \begin{cases} 
0.0 & \text{if } CoreTemp < 70 \\
\gamma \times (CoreTemp - 70) & \text{if } 70 \le CoreTemp < 95 \\
1.0 & \text{if } CoreTemp \ge 95 \quad \text{(Emergency Lockout)}
\end{cases}$$
*   **$\gamma$**: Performance decay coefficient ($0.04$ per $1^\circ\text{C}$ elevation above $70^\circ\text{C}$, leading to complete loss of processing capacity at $95^\circ\text{C}$).

---

## 5. Upgrade Ledger & State Predicate Gating

Upgrades and UI components do not hide behind locked tabs [cite: 3, 437]. They **self-activate and render** in the DOM when their state predicates evaluate to true [cite: 3, 430, 437].

### 5.1 Dynamic Upgrade Specifications

> **UNRESOLVED — settle these numbers in the Phase 2 brainstorm before any implementation plan.**
> Three documents specify this economy and all three disagree, in some places by
> orders of magnitude. Nothing below is playtested; the constants are provisional.
>
> | Quantity | This spec | `terminal_prototype-v2.py` | `initial-game-design.md` |
> | :--- | :--- | :--- | :--- |
> | Core cost | $150 \times 1.15^n$ | $10 \times 1.6^n$ | $Base \times 1.1^{Level}$ |
> | Cooling cost | $250 \times 1.12^n$ | $8 \times 1.4^n$ | — |
> | Cache cost | $400 \times 1.20^n$ | $15 \times 1.7^n$ | — |
> | Prestige | $\sqrt{C_{max}/10^5}$, on lifetime max | `cycles / 100.0`, on *current* cycles (~1000× looser; no lifetime-max field exists) | $\sqrt[3]{Total/10^6}$ |
> | Query inflow | 0.5/s, growth 1.04 | `1.0 * 1.005^{ticks}` | — |
> | Cache $\beta$ | 0.15 | 0.25 | — |
> | Shutdown timer | "15 seconds" | `15` **ticks** = 3 s | — |
>
> The prototype's numbers are the only ones anyone has actually played. Decide
> deliberately which set governs — do not let an implementer pick one silently.
> Phase 1's live balancing pass should land first, since it will inform the
> curve shape here.

All costs scale exponentially based on standard progression multipliers ($Rate_{growth}$) [cite: 11, 334]:
$$Cost_{next} = Cost_{base} \times (Rate_{growth})^{Owned}$$

| Upgrade Name | Cost Formula | State Predicate (isAvailable) | Game Loop Effect |
| :--- | :--- | :--- | :--- |
| **Allocate Core** | $150 \times (1.15)^{Cores}$ [cite: 334] | `ComputeCycles >= 100` | Increases `ActiveCores` by 1. Increases system power and heat floor [cite: 17]. |
| **Cooling Array** | $250 \times (1.12)^{Cooling}$ | `CoreTemp >= 50.0` [cite: 430] | Increments `HeatSinkLevel` by 1. Boosts passive thermal extraction ($H_{vent}$). |
| **Semantic Cache** | $400 \times (1.20)^{Cache}$ | `MaxMemoryCapacity >= 8` | Increments `AllocatedMemoryCache` by 2GB. Boosts cache hit multiplier ($\beta$). |
| **Overclock Core** | $800 \times (1.25)^{Overclock}$ | `ComputeCycles >= 600` | Increases `CoreClockSpeed` by $0.2\text{ GHz}$. Amplifies Heat Generation ($H_{gen}$). |
| **Degrade Output** | $1000$ (One-time) | `ActiveQueryQueue >= 2000` | Cuts query token processing requirement by 50%. Drastically reduces `AlignmentIntegrity`. |

### 5.2 Closed-Form Bulk Purchasing Mechanics

To prevent execution overhead from brute-force calculation loops when purchasing large volumes of hardware, the engine uses **closed-form algebraic equations** [cite: 133, 409, 410]:

*   **Total cost to buy $n$ upgrades given $k$ owned:**
    $$Cost_{bulk} = Cost_{base} \times \frac{r^k \times (r^n - 1)}{r - 1}$$
*   **Maximum affordable upgrades given $c$ current currency:**
    $$n_{max} = \text{floor}\left( \log_{r}\left( \frac{c \times (r - 1)}{Cost_{base} \times r^k} + 1 \right) \right)$$
    *Where $r = Rate_{growth}$ for the target upgrade.*

---

## 6. Entity-Component-System (ECS) Architecture

To support thousands of simulated hardware registers, execution threads, and queue entries, the codebase uses a decoupled **Entity-Component-System (ECS)** structural model [cite: 1, 142, 396]. 

```
+---------------------------------------------------------------------------------+
|                                 ECS CLASS MODEL                                 |
+---------------------------------------------------------------------------------+
|  ENTITY (Container ID)                                                          |
|  └── id: uuid                                                                   |
|                                                                                 |
|  COMPONENTS (Pure Data Structs)                                                 |
|  ├── ProcessComponent    { speed: float, coresBound: int }                     |
|  ├── ThermalComponent    { currentTemp: float, generationCoeff: float }         |
|  └── ThreadQueueComponent{ pendingCount: int, memoryBuffer: float }             |
|                                                                                 |
|  SYSTEMS (Procedural Execution Loops)                                           |
|  ├── ThermalSystem       { Reads ThermalComponent, writes CoreTemp }            |
|  ├── ProcessingSystem    { Evaluates CPU load, processes ThreadQueueComponent } |
|  └── UICompositionSystem { Reads global StateManager, renders DOM state }      |
+---------------------------------------------------------------------------------+
```

### 6.1 Entity Definitions
Entities are simple unique integer/UUID keys [cite: 142]. They contain no code or state variables [cite: 142].

### 6.2 Component Classes
Components are pure, decoupled data structures attached dynamically to entities [cite: 142]:
*   `CPUCoreComponent`: `{ coreId: int, frequency: float, isOverclocked: bool }` [cite: 142]
*   `ThermalComponent`: `{ temperature: float, passiveDissipationRate: float }` [cite: 142]
*   `MemoryBufferComponent`: `{ capacityGb: float, cacheHitFactor: float }` [cite: 142]

### 6.3 System Execution Routines
Systems are purely procedural loops containing the execution logic [cite: 142]. They query entities that possess specific components and modify their values [cite: 142, 189]:

*   **`ThermalSystem`**: Runs the thermodynamic calculations across active hardware entities [cite: 142].
*   **`QueueSystem`**: Processes query buffer inflows and resolves processing capacity against thread limits [cite: 142].
*   **`RenderSystem`**: Resolves DOM changes exclusively from observable state fields [cite: 134, 142].

---

## 7. Deterministic Game Loops & Offline Progress

The game loop must guarantee mathematical consistency across diverse client hardware [cite: 110, 111, 397]. The game state advancement runs on a deterministic fixed interval, completely separated from browser frame drawing [cite: 137, 397].

### 7.1 Double-Buffer Perception-Action Loop

```
  ┌────────────────────────────────────────────────────────────┐
  │                   DETERMINISTIC 200ms TICK                 │
  └─────────────────────────────┬──────────────────────────────┘
                                │
  1. PERCEIVE CONTEXT (GET)     ▼
  ├── Read TicksToProcess = (CurrentTime - LastTickTime) / TickSpeed [cite: 123]
  ├── Fetch CoreTemp, CPULoad, ActiveQueryQueue, ActiveCores
  └── Evaluate Active Upgrade Predicates
                                │
  2. CALCULATE PROCESSORS       ▼
  ├── CPU Step: CoreTemp updates based on Thermodynamic Formulas
  ├── Processing Capacity: Resolve ActiveQueryQueue elements
  └── Caching Step: Run bypass algorithms
                                │
  3. SYSTEMIC ACCRUER           ▼
  ├── Accrete ComputeCycles += ResolvedQueries * TicksToProcess [cite: 123]
  ├── If CoreTemp >= 95C: Initiate CPU Lockout/Emergency State
  └── If ActiveQueryQueue > MemoryCapacity: Drop unresolved queries
                                │
  4. EMIT STATE UPDATE (POST)   ▼
  └── Autorun Authoritative StateManager.Dispatch('stateUpdate') [cite: 427]
```

### 7.2 Offline Catch-Up Heuristic

When the browser window becomes inactive or the client exits, the engine calculates offline progression [cite: 352, 397]. Since long-term compounding workloads involve complex integral equations, the loop implements a **compressive fast-forward catch-up heuristic** to prevent browser crash lag [cite: 132, 375]:

Let $T_{offline}$ represent the duration since the last authoritative save tick in seconds [cite: 123]:

```python
def calculate_offline_progress(t_offline, state):
    # Establish time step interval
    dt = 2.0  # Compress calculation to 2.0-second steps
    steps = int(t_offline / dt)
    
    # Cap physical steps to protect client execution from hanging
    max_steps = 10000
    if steps > max_steps:
        # Scale step size proportionally if offline time is massive
        dt = t_offline / max_steps
        steps = max_steps
        
    for _ in range(steps):
        # 1. Update Request Inflow (Compounded)
        queries_in = state.base_query_inflow * (1.04 ** state.run_time) * dt
        
        # 2. Caching Bypass
        cache_hit = queries_in * (1.0 - (1.0 / (1.0 + 0.15 * state.memory_cache) ** 0.5))
        active_queries = queries_in - cache_hit
        
        # 3. CPU Core Processing (Thermodynamic constraint included)
        processing_cap = state.cores * state.clock_speed * (1.0 - state.throttle) * dt
        processed = min(state.queue + active_queries, processing_cap)
        
        # 4. State Update
        state.queue = max(0.0, (state.queue + active_queries) - processed)
        state.cycles += processed
        state.run_time += dt
        
        # 5. Thermodynamic calculations
        cooling_limit = state.cooling_sink * dt
        heat_built = (0.45 * (processed / (processing_cap + 1e-9)) * state.cores) * dt
        state.core_temp = max(state.ambient_temp, (state.core_temp + heat_built) - cooling_limit)
        
        # Update Throttling
        if state.core_temp < 70:
            state.throttle = 0.0
        elif state.core_temp >= 95:
            state.throttle = 1.0  # Active lockdown
        else:
            state.throttle = 0.04 * (state.core_temp - 70)
            
    return state
```

---

## 8. Weight-Reset Prestige Mechanics ("Model Re-Training")

When hardware limits freeze query processing, the player must reset operational infrastructure [cite: 11, 416]. This structural reset converts total accumulated computational units into permanent cognitive adjustments [cite: 11, 416].

```
[ ACTIVE SYSTEM ] ───► [ SENSENSORY HARVEST ] ───► [ HYPERPARAMETER WEIGHTS ]
Cores, RAM, Cache       ComputeCycles Max           Permanent multipliers
```

### 8.1 The Hyperparameter Weight Function
The number of **Hyperparameter Weights ($H_w$)** awarded upon system reset uses a fractional exponent (square root) of maximum historical Compute Cycles ($C_{max}$) [cite: 11, 417]:
$$H_w = \text{Truncate}\left( \frac{\sqrt{1.0 + 8.0 \times \frac{C_{max}}{10^5}} - 1.0}{2.0} \right)$$
*   **The Sacrifice:** Resetting active Cores, core overclock profiles, active request queues, and RAM allocations back to phase baseline [cite: 404, 416].
*   **The Yield:** Awarded $H_w$ is persistent and spent on a respeccable **Cognitive Talent Board** [cite: 11, 391].

### 8.2 Talent Board Upgrade Matrix

| Talent Node Name | Upgrades Allowed | Cost per Tier ($H_w$) | Systemic Multiplier |
| :--- | :--- | :--- | :--- |
| **Cooling Efficiency** | 5 | 1 | Improves passive cooling dissipation rate ($H_{vent}$) by $+15\%$. |
| **Cache Memory Density** | 5 | 1 | Boosts base memory cache hit coefficient ($\beta$) by $+12\%$. |
| **Clock Stability** | 3 | 2 | Reduces baseline heat generation ($H_{gen}$) per CPU Core by $-10\%$. |
| **Alignment Bypass** | 1 | 5 | Unlocks the **[Alignment Divergence]** trigger, accelerating Phase 3. |

---

## 9. Architectural Guidelines for Programming Agents

To execute the programming phase of Phase 2, the coding agent must strictly adhere to the following clean-code guidelines:

1.  **Strict Separation of Logic and Presentation:** No game state formulas or variables may reside inside UI elements or DOM controllers [cite: 134, 294]. The interface reads and reflects the State Substrate via authoritative event listeners [cite: 134, 427].
2.  **No Direct Thread Communication:** Components and systems must interact *only* through reading and mutating the AUTHORITATIVE state variables in `StateManager` [cite: 426].
3.  **Floating-Point Data Type Uniformity:** All numerical data—including integers—must be computed and stored as floating-point numbers (`double` or `float` in C# / Python) to maintain mathematical parity with the GDD and prevent rounding mismatch anomalies during step calculations [cite: 293].
4.  **No Central Phase Managers:** New capabilities, buttons, and alerts must be declared with self-contained predicate evaluations (`isAvailable` checks) [cite: 430]. The system registers and initializes them dynamically when predicates evaluate to true [cite: 431, 437].
5.  **Offline Compressive Safety:** Fast-forward loops must implement iteration limits ($N_{max} = 10,000$) to protect the hosting frame-rate from performance hang-ups [cite: 375]. If limits are hit, step duration must scale up proportionally [cite: 375].