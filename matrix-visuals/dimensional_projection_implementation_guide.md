# Dimensional Projection Integration Guide

This document outlines how the primary coding agent should port the `DimensionalProjection` UI component from the `matrix-visuals` sandbox into the main application repository as the primary "Token Generation" button.

## 1. Extraction
The source code is currently located at:
`matrix-visuals/src/Visualizations.jsx` (specifically the `DimensionalProjection` function).

1. Copy the `DimensionalProjection` function from `Visualizations.jsx` into the main application's UI components directory (e.g., `components/TokenGeneratorButton.jsx`).
2. The component requires no external dependencies beyond React (`useRef`, `useEffect`).
3. Ensure the CSS for the parent container uses relative positioning if necessary, though the Canvas itself is responsive to its wrapper.

## 2. Required State Bindings
To make the button functional and reactive to the application's engine, you must bind the following core props to the live application state:

| Prop | Type | Description |
| :--- | :--- | :--- |
| `tapsCount` | Number | **Critical.** Must increment by `1` every time the user clicks/taps the button. This drives the outgoing expanding ring and hazy wave particle emitters. |
| `autoRate` | Number | Represents the current background/automated token generation speed. Drives the spawn rate and velocity of the incoming "watts" (tokens). |
| `contextHealth` | Number (0-100) | Drives the O(N^2) quadratic boundary constriction penalty. As this approaches `0`, the hazy waves emitted by taps will violently collide against a suffocating boundary. |
| `cacheHealth` | Number (0-100) | Controls the base Hue of the orb and ring (Green at 100%, shifting to Red at 0%), as well as the intensity of the physical "wobble" effect of the orb. |

## 3. UI and Aesthetic Configuration Props
The component exposes a large suite of aesthetic props. You can hardcode these as defaults in the component signature or pass them down via a theme provider.

### Shape and Container
- `buttonColor`: Base background color of the button (Hex). The canvas uses a composite alpha clear, preserving internal motion blur trails without muddying this color.
- `bezelColor`: Color of the external stroke framing the button.
- `bezelThickness`: Border thickness in pixels.
- `visualScale`: A canvas matrix scale multiplier (e.g., `1.0` to `3.0`). Scales all internal geometry, particles, and physics dynamically without changing the physical DOM size of the button shape.

### Emitters and Overflows
- `tokenFlowDistance`: Distance (in pixels) *outside* the button edge where incoming automated tokens materialize before flying straight towards the center orb.
- `waveOverflowDistance`: Allows the hazy tap waves to bleed outside the physical bounds of the button (acting as a secondary clipping mask) to create a holographic 3D overflow aesthetic.
- `minPushDistance`: The absolute minimum radius (floor) that the hazy waves can expand to when `contextHealth` is `0` and the boundary penalty is at its maximum.

### Sparkles and Glints
- `circleSparkle` / `ringSparkle`: Spawn rate multipliers for the persistent magical glints.
- `circleSparkleSize` / `ringSparkleSize`: Base pixel sizes for the sparkles.
- `sparkleDuration`: Decay timer for the sparkle emitter energy after a tap.

## 4. Implementation Example

```jsx
import React, { useState } from 'react';
import DimensionalProjection from './DimensionalProjection';

const MainDashboard = () => {
  const [taps, setTaps] = useState(0);
  
  // These would be hooked up to your actual engine state
  const { 
    currentAutoRate, 
    liveContextHealth, 
    liveCacheHealth 
  } = useLLMEngine();

  const handleManualGeneration = () => {
    setTaps(prev => prev + 1);
    // Trigger actual LLM generation logic here
  };

  return (
    <div 
      className="token-button-wrapper" 
      onClick={handleManualGeneration}
      style={{ cursor: 'pointer', width: '380px', height: '120px' }}
    >
      <DimensionalProjection 
        tapsCount={taps}
        autoRate={currentAutoRate}
        contextHealth={liveContextHealth}
        cacheHealth={liveCacheHealth}
        
        // Aesthetic Configuration
        buttonColor="#1e293b"
        bezelColor="#334155"
        bezelThickness={2}
        visualScale={1.2}
        tokenFlowDistance={20}
        waveOverflowDistance={10}
        minPushDistance={15}
        
        // Colors
        waveColor="#a855f7"
        tokenColor="#38bdf8"
      />
    </div>
  );
};
```

## 5. Architectural Notes for the Coding Agent
1. **Event Propagation:** Because the `DimensionalProjection` component renders a `<canvas>` element that fills its parent, it does *not* contain an explicit `<button>` HTML tag or `onClick` handler internally. You must wrap the component in a clickable `<div>` or `<button>` as shown in the example above, and pass the resulting state changes down as props.
2. **Prop Mutability:** The component uses a `useRef(props)` pattern to inject React state cleanly into the vanilla `requestAnimationFrame` loop without forcing React to unmount/remount the Canvas every frame. This ensures buttery smooth 60FPS physics while maintaining perfect reactivity to state changes. Do not alter this pattern during extraction.
3. **Resizing:** The Canvas automatically attaches a `ResizeObserver` to its parent container. If the dashboard layout changes, the Canvas will flawlessly adapt its coordinate system, but the `btnW` and `btnH` variables inside the draw loop currently dictate the explicit boundary of the button shape. Ensure those match the CSS dimensions of the wrapper.
