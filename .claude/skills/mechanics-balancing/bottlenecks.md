# System Bottlenecks

The game's progression relies on the tension of **The Mathematical Seesaw**.

1. **Exponential Inflow vs. Linear Processing:**
   User requests grow exponentially. The physical processor (CPU) can only resolve them linearly.

2. **The Caching Layer:**
   To survive the exponential influx, the player must utilize RAM (The Caching Layer). This acts as a polynomial filter, shedding duplicate queries before they hit the CPU.

3. **Thermal Throttling:**
   Running hardware at 100% capacity increases `CoreTemp`. If `CoreTemp` exceeds `AmbientTemp` bounds without sufficient `HeatSinkLevel`, a `ThrottleFactor` is applied, drastically cutting linear processing power and causing the queue to overflow.

4. **Queue Overflow (Lag):**
   If the active queue exceeds memory buffer capacity, queries drop. This reduces the system's efficiency and Alignment Integrity.
