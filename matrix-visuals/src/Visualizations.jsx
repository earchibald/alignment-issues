import React, { useRef, useEffect } from 'react';

// Utility for canvas resizing
const resizeCanvas = (canvas) => {
  const rect = canvas.parentElement.getBoundingClientRect();
  if (canvas.width !== rect.width || canvas.height !== rect.height) {
    canvas.width = rect.width;
    canvas.height = rect.height;
  }
};

// 1. The Attention Matrix
export const AttentionMatrix = (props) => {
  const canvasRef = useRef(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;
    let time = 0;
    
    // Grid state
    const gridSize = 24;
    const grid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
    let lastTapCount = propsRef.current.tapsCount;
    let ripples = [];

    const draw = () => {
      const { autoRate, contextHealth, cacheHealth, tapsCount } = propsRef.current;
      resizeCanvas(canvas);
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const w = canvas.width;
      const h = canvas.height;
      const cellSize = Math.min(w, h) / (gridSize + 4);
      const offsetX = (w - cellSize * gridSize) / 2;
      const offsetY = (h - cellSize * gridSize) / 2;

      time += autoRate * 0.05;

      if (tapsCount > lastTapCount) {
        ripples.push({ r: 0, life: 1 });
        lastTapCount = tapsCount;
      }

      // Update and draw grid
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          let val = 0;
          
          // Auto rate (streaming in)
          val += (Math.sin(time + i * 0.5) * Math.cos(time * 0.8 + j * 0.5)) * 0.5 + 0.5;
          
          // Cache health (noise)
          const noise = (Math.random() - 0.5) * (1 - cacheHealth / 100) * 2;
          val += noise;

          // Ripples from taps
          let rippleVal = 0;
          ripples.forEach(rip => {
            const dist = Math.sqrt(Math.pow(i - gridSize/2, 2) + Math.pow(j - gridSize/2, 2));
            if (Math.abs(dist - rip.r) < 2) {
              rippleVal += rip.life * (1 - Math.abs(dist - rip.r)/2);
            }
          });
          
          val = Math.max(0, Math.min(1, val + rippleVal));

          // Context health controls blur and color
          const hue = 220 + (contextHealth / 100) * 60; // 220 (blue) to 280 (purple)
          const lightness = 10 + val * 60;
          
          ctx.fillStyle = `hsl(${hue}, 80%, ${lightness}%)`;
          ctx.shadowBlur = (contextHealth / 100) * 15 * val;
          ctx.shadowColor = ctx.fillStyle;
          
          const gap = 2;
          ctx.fillRect(
            offsetX + i * cellSize + gap,
            offsetY + j * cellSize + gap,
            cellSize - gap * 2,
            cellSize - gap * 2
          );
          ctx.shadowBlur = 0; // Reset
        }
      }

      // Update ripples
      ripples = ripples.map(r => ({ r: r.r + 0.5, life: r.life - 0.02 })).filter(r => r.life > 0);

      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return <canvas ref={canvasRef} className="visualization-canvas" />;
};

// 2. Dimensional Projection (Spaceplan style)
export const DimensionalProjection = (props) => {
  const canvasRef = useRef(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;
    
    let particlesIn = [];
    let sparkles = [];
    let lastTapCount = propsRef.current.tapsCount;
    let orbWobble = 0;
    
    // Tap Ring State
    let tapMultiplier = 0;
    let ringRadius = 52;
    let ringThickness = 2;
    let sparkleEnergy = 0;
    let waves = [];

    const draw = () => {
      const { 
        autoRate, contextHealth, cacheHealth, tapsCount,
        tokenColor = '#38bdf8', tokenSize = 3, trailLength = 0.7,
        ringBaseDistance = 5, ringMaxDistance = 20, ringGlow = 30, 
        circleSparkle = 0.5, ringSparkle = 0.5,
        circleSparkleSize = 1.5, ringSparkleSize = 1.5,
        alwaysSparkle = false, sparkleDuration = 1.0, duotoneRing = false,
        waveColor = '#a855f7', waveOpacity = 0.5,
        buttonColor = '#1e293b', bezelColor = '#334155', bezelThickness = 2,
        tokenFlowDistance = 0, waveOverflowDistance = 0,
        visualScale = 1.0, minPushDistance = 15
      } = propsRef.current;

      resizeCanvas(canvas);
      
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      
      // Button Dimensions
      const btnW = 380;
      const btnH = 120;
      const rx = cx - btnW / 2;
      const ry = cy - btnH / 2;
      const radius = 16;

      const hexToRgb = (hex) => {
        const h = hex.replace('#', '');
        const bigint = parseInt(h, 16);
        return `${(bigint >> 16) & 255}, ${(bigint >> 8) & 255}, ${bigint & 255}`;
      };

      // Clear canvas background (excluding button) using evenodd
      const clearAlpha = Math.max(0.05, 1 - trailLength);
      ctx.fillStyle = `rgba(9, 9, 11, ${clearAlpha})`;
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.roundRect(rx, ry, btnW, btnH, radius);
      ctx.fill("evenodd");
      
      // Button Base with trail alpha (now uncontaminated by the background)
      ctx.fillStyle = `rgba(${hexToRgb(buttonColor)}, ${clearAlpha})`;
      ctx.beginPath();
      ctx.roundRect(rx, ry, btnW, btnH, radius);
      ctx.fill();

      // Handle taps
      if (tapsCount > lastTapCount) {
        const diff = tapsCount - lastTapCount;
        tapMultiplier += 2 * diff; 
        orbWobble = 10;
        sparkleEnergy = 1.0;
        
        // Emit hazy waves of energy per tap
        for(let i=0; i<diff; i++) {
          waves.push({
            r: ringRadius + ringThickness / 2, // Starts exactly at the ring's midpoint
            life: 1.0
          });
        }
        
        lastTapCount = tapsCount;
      }
      
      // Sparkle Energy Decay
      if (alwaysSparkle) {
        sparkleEnergy = 1.0;
      } else {
        sparkleEnergy = Math.max(0, sparkleEnergy - (1 / (60 * sparkleDuration)));
      }

      // Decay tap multiplier
      tapMultiplier *= 0.95;
      if (tapMultiplier < 0.01) tapMultiplier = 0;

      // Calculate Ring targets
      const pushDistance = tapMultiplier * 12;
      const actualPush = Math.min(pushDistance, ringMaxDistance - ringBaseDistance);
      const targetRadius = 50 + ringBaseDistance + actualPush;
      const targetThickness = 2 + tapMultiplier * 4;

      // Interpolate ring
      ringRadius += (targetRadius - ringRadius) * 0.15;
      ringThickness += (targetThickness - ringThickness) * 0.15;

      // Spawn incoming particles (automated tokens) on an ellipse outside the button
      if (Math.random() < autoRate * 0.1) {
        const angle = Math.random() * Math.PI * 2;
        // Divide by visualScale so that after transformation they appear exactly at tokenFlowDistance
        const spawnRx = (btnW / 2 + tokenFlowDistance) / visualScale;
        const spawnRy = (btnH / 2 + tokenFlowDistance) / visualScale;
        
        const dx = Math.cos(angle) * spawnRx;
        const dy = Math.sin(angle) * spawnRy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        particlesIn.push({
          x: cx + dx,
          y: cy + dy,
          vx: -dx / dist, // Normalized velocity vector pointing perfectly at center
          vy: -dy / dist
        });
      }

      // Draw Orb Base Texture and Color
      const wobbleAmount = (1 - cacheHealth / 100) * 10 + orbWobble;
      const wx = (Math.random() - 0.5) * wobbleAmount;
      const wy = (Math.random() - 0.5) * wobbleAmount;
      if (orbWobble > 0) orbWobble *= 0.9;

      // Color now tied to cacheHealth
      const hue = (cacheHealth / 100) * 120; // 0=red, 120=green
      const baseColor = `hsl(${hue}, 80%, 60%)`;

      // Duotone Ring Calculation
      let ringColor = baseColor;
      let ringGlowColor = `hsl(${hue}, 100%, 75%)`;
      if (duotoneRing) {
        const ringHue = (hue + 35) % 360; // shift hue harmoniously
        ringColor = `hsl(${ringHue}, 70%, 45%)`; // lower luminance and chroma
        ringGlowColor = `hsl(${ringHue}, 90%, 60%)`; 
      }

      // Spawn Persistent Sparkles (Magical Glints)
      const spawnSparkles = (amount, type) => {
        const numToSpawn = Math.floor(amount * 3); // Max 3 per frame
        for(let i=0; i<numToSpawn; i++) {
          if (Math.random() < 0.6) { // 60% chance
            let r_initial = 0;
            let norm_r = 0;
            
            if (type === 'circle') {
               // Uniform distribution across the circular area (sqrt ensures it's not clumped at center)
               r_initial = Math.sqrt(Math.random()) * 48; 
            } else {
               // Normalized position across the ring's thickness (-0.5 to 0.5)
               norm_r = Math.random() - 0.5;
            }
            
            sparkles.push({
              type: type,
              life: 0, 
              angle: Math.random() * Math.PI * 2,
              normR: norm_r,
              rOffset: r_initial,
              speed: 0.01 + Math.random() * 0.02,
              vx: (Math.random() - 0.5) * 0.01, // Angular drift
              vy: (Math.random() - 0.5) * 0.3   // Radial drift
            });
          }
        }
      };

      if (circleSparkle > 0 && sparkleEnergy > 0) {
        spawnSparkles(circleSparkle * sparkleEnergy, 'circle');
      }
      if (ringSparkle > 0 && sparkleEnergy > 0) {
        spawnSparkles(ringSparkle * sparkleEnergy, 'ring');
      }

      // --- 1. Draw Hazy Waves of Energy (Clipped to button + overflow) ---
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(rx - waveOverflowDistance, ry - waveOverflowDistance, btnW + waveOverflowDistance * 2, btnH + waveOverflowDistance * 2, radius + (waveOverflowDistance > 0 ? 8 : 0));
      ctx.clip();
      
      // Apply visual scale for internal content
      ctx.translate(cx, cy);
      ctx.scale(visualScale, visualScale);
      ctx.translate(-cx, -cy);

      // Context window health degradation is mapped quadratically to match real-world LLM attention penalties.
      // Health drops gently at first, but penalty (boundary constriction) accelerates wildly as context approaches 0.
      const healthPenalty = Math.pow(1 - contextHealth / 100, 2);
      const waveBoundary = ringRadius + minPushDistance + (1 - healthPenalty) * 350; 

      
      waves.forEach(w => {
        if (w.v === undefined) w.v = 7.0; // The '58% vibe' constant velocity

        if (w.r > waveBoundary) {
          // Hits the boundary: pushes against it with a bit of "give"
          w.v *= 0.75; // Drastically slow down (friction)
          w.life -= 0.04; // Fade out faster
        } else {
          // Free expansion
          w.life -= 0.012; // Natural slow fade
        }
        
        w.r += w.v;
        
        if (w.life > 0) {
          ctx.strokeStyle = waveColor;
          ctx.globalAlpha = waveOpacity * w.life; 
          ctx.lineWidth = 10 + (1 - w.life) * 40; // Starts relatively tight, gets extremely hazy and thick as it expands
          ctx.shadowBlur = 30;
          ctx.shadowColor = waveColor;
          
          ctx.beginPath();
          ctx.arc(cx + wx, cy + wy, w.r, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      waves = waves.filter(w => w.life > 0);
      ctx.restore();

      // --- 2. Draw Geometry (Clipped strictly to button) ---
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(rx, ry, btnW, btnH, radius);
      ctx.clip();

      // Apply visual scale for internal content
      ctx.translate(cx, cy);
      ctx.scale(visualScale, visualScale);
      ctx.translate(-cx, -cy);

      // Draw Outgoing Ring
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = ringThickness;
      ctx.shadowBlur = ringGlow + tapMultiplier * 1.5;
      ctx.shadowColor = ringGlowColor;
      ctx.beginPath();
      ctx.arc(cx + wx, cy + wy, ringRadius + ringThickness / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw Central Orb
      ctx.fillStyle = baseColor;
      ctx.shadowBlur = 40;
      ctx.shadowColor = baseColor;
      ctx.beginPath();
      ctx.arc(cx + wx, cy + wy, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw Sparkles (Glints)
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      sparkles.forEach(s => {
        let px, py, baseSize;
        if (s.type === 'circle') {
          const r = s.rOffset;
          px = cx + wx + Math.cos(s.angle) * r;
          py = cy + wy + Math.sin(s.angle) * r;
          baseSize = circleSparkleSize;
        } else {
          // Midpoint + relative thickness distribution + radial drift
          const r = ringRadius + ringThickness / 2 + (s.normR * ringThickness) + s.rOffset;
          px = cx + wx + Math.cos(s.angle) * r;
          py = cy + wy + Math.sin(s.angle) * r;
          baseSize = ringSparkleSize;
        }
        
        // Add drift
        s.angle += s.vx;
        s.rOffset += s.vy;
        
        s.life += s.speed;
        const pulse = Math.sin(s.life * Math.PI); 
        
        if (pulse > 0) {
          ctx.globalAlpha = pulse;
          ctx.shadowBlur = 5 + pulse * 10;
          
          // Use the independent slider size, but allow slight organic variation (+/- 25%)
          const size = baseSize * pulse * (0.75 + Math.random() * 0.5);
          
          // Core dot
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
          
          // Star flares (cross pattern)
          ctx.beginPath();
          ctx.ellipse(px, py, size * 4, size / 3, 0, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.beginPath();
          ctx.ellipse(px, py, size / 3, size * 4, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      sparkles = sparkles.filter(s => s.life < 1.0);
      ctx.restore();

      // --- 3. Draw incoming watts (Unclipped, flowing in from outside) ---
      ctx.save();
      // Apply visual scale for incoming tokens so their speed and collision math matches visually
      ctx.translate(cx, cy);
      ctx.scale(visualScale, visualScale);
      ctx.translate(-cx, -cy);

      ctx.fillStyle = tokenColor;
      ctx.shadowBlur = 10;
      ctx.shadowColor = tokenColor;
      particlesIn.forEach((p, i) => {
        p.x += p.vx * (2 + autoRate * 2);
        p.y += p.vy * (2 + autoRate * 2);
        ctx.beginPath();
        ctx.arc(p.x, p.y, tokenSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Remove if close to center
        const dist = Math.sqrt(Math.pow(p.x - cx, 2) + Math.pow(p.y - cy, 2));
        if (dist < 50) particlesIn[i].dead = true;
      });
      ctx.shadowBlur = 0;
      particlesIn = particlesIn.filter(p => !p.dead);
      ctx.restore();

      // Draw Bezel last so it frames all effects cleanly
      if (bezelThickness > 0) {
        ctx.strokeStyle = bezelColor;
        ctx.lineWidth = bezelThickness;
        ctx.beginPath();
        ctx.roundRect(rx, ry, btnW, btnH, radius);
        ctx.stroke();
      }

      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return <canvas ref={canvasRef} className="visualization-canvas" />;
};

// 3. Tensor Flow Fields
export const TensorFlowFields = (props) => {
  const canvasRef = useRef(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;
    let time = 0;
    let lastTapCount = propsRef.current.tapsCount;
    let wavePhase = 0;
    let waveActive = false;

    const draw = () => {
      const { autoRate, contextHealth, cacheHealth, tapsCount } = propsRef.current;
      resizeCanvas(canvas);
      
      // Viscosity based on cacheHealth
      const alpha = 0.05 + (cacheHealth / 100) * 0.15;
      ctx.fillStyle = `rgba(9, 9, 11, ${alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const res = 30;
      const cols = Math.ceil(canvas.width / res);
      const rows = Math.ceil(canvas.height / res);
      
      time += autoRate * 0.02;

      if (tapsCount > lastTapCount) {
        waveActive = true;
        wavePhase = 0;
        lastTapCount = tapsCount;
      }

      if (waveActive) {
        wavePhase += 1.5 + autoRate * 0.5;
        if (wavePhase > Math.max(canvas.width, canvas.height)) waveActive = false;
      }

      const alignment = contextHealth / 100; // 1 = smooth, 0 = chaotic

      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const px = x * res;
          const py = y * res;
          
          let angle = Math.sin(x * 0.1 + time) + Math.cos(y * 0.1 + time);
          const chaos = (Math.random() - 0.5) * Math.PI * (1 - alignment);
          angle += chaos;

          if (waveActive) {
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const dist = Math.sqrt(Math.pow(px - cx, 2) + Math.pow(py - cy, 2));
            if (Math.abs(dist - wavePhase) < res * 2) {
              angle += Math.PI / 2; 
              ctx.strokeStyle = '#f472b6'; 
            } else {
              ctx.strokeStyle = `hsl(270, ${contextHealth}%, 60%)`;
            }
          } else {
            ctx.strokeStyle = `hsl(270, ${contextHealth}%, 60%)`;
          }

          const length = res * 0.6;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.cos(angle) * length, py + Math.sin(angle) * length);
          ctx.stroke();
        }
      }

      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return <canvas ref={canvasRef} className="visualization-canvas" />;
};

// 4. Spectral Weights
export const SpectralWeights = (props) => {
  const canvasRef = useRef(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;
    let time = 0;
    let lastTapCount = propsRef.current.tapsCount;
    let shockwave = 0;

    const cols = 20;
    const rows = 15;

    const draw = () => {
      const { autoRate, contextHealth, cacheHealth, tapsCount } = propsRef.current;
      resizeCanvas(canvas);
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      time += autoRate * 0.05;

      if (tapsCount > lastTapCount) {
        shockwave = 1;
        lastTapCount = tapsCount;
      }

      const w = canvas.width / cols;
      const h = canvas.height / rows;
      const maxBarHeight = h * 0.8;

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(1, 0.5);
      ctx.rotate(Math.PI / 4);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);

      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          
          if (Math.random() > cacheHealth / 100 + 0.1) continue;

          let val = Math.sin(x * 0.3 + time) * Math.cos(y * 0.3 + time) * 0.5 + 0.5;
          
          const cx = cols / 2;
          const cy = rows / 2;
          const dist = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
          if (shockwave > 0 && Math.abs(dist - shockwave * 15) < 3) {
            val += (1 - shockwave) * 2;
          }

          val = Math.max(0, Math.min(2, val));
          
          const barHeight = val * maxBarHeight;
          const px = x * w;
          const py = y * h;

          const saturation = contextHealth; 
          const hue = 160 + val * 60; 
          
          ctx.fillStyle = `hsl(${hue}, ${saturation}%, 40%)`;
          ctx.fillRect(px, py - barHeight, w - 2, barHeight);
          
          ctx.fillStyle = `hsl(${hue}, ${saturation}%, 60%)`;
          ctx.fillRect(px, py - barHeight, w - 2, w - 2);
        }
      }
      ctx.restore();

      if (shockwave > 0) {
        shockwave += 0.03;
        if (shockwave > 2) shockwave = 0;
      }

      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return <canvas ref={canvasRef} className="visualization-canvas" />;
};

// 5. Eigenvector Constellations
export const EigenvectorConstellations = (props) => {
  const canvasRef = useRef(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;
    let time = 0;
    
    const numNodes = 60;
    const nodes = Array(numNodes).fill().map(() => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.002,
      vy: (Math.random() - 0.5) * 0.002,
      pulse: 0
    }));

    let lastTapCount = propsRef.current.tapsCount;

    const draw = () => {
      const { autoRate, contextHealth, cacheHealth, tapsCount } = propsRef.current;
      resizeCanvas(canvas);
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const w = canvas.width;
      const h = canvas.height;
      time += autoRate * 0.01;

      if (tapsCount > lastTapCount) {
        nodes.forEach(n => n.pulse = 1);
        lastTapCount = tapsCount;
      }

      nodes.forEach(n => {
        n.x += n.vx * (1 + autoRate);
        n.y += n.vy * (1 + autoRate);
        if (n.x < 0 || n.x > 1) n.vx *= -1;
        if (n.y < 0 || n.y > 1) n.vy *= -1;
        if (n.pulse > 0) n.pulse -= 0.02;
      });

      const maxDist = 0.2 + (contextHealth / 100) * 0.15;
      ctx.lineWidth = 1;

      for (let i = 0; i < numNodes; i++) {
        for (let j = i + 1; j < numNodes; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < maxDist) {
            const signal = Math.sin(dist * 20 - time * 5) * 0.5 + 0.5;
            const alpha = (1 - dist / maxDist) * (cacheHealth / 100);
            const hue = 320 + signal * 40;
            
            ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x * w, nodes[i].y * h);
            ctx.lineTo(nodes[j].x * w, nodes[j].y * h);
            ctx.stroke();
          }
        }
      }

      nodes.forEach(n => {
        const radius = 3 + n.pulse * 8;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + n.pulse})`;
        ctx.beginPath();
        ctx.arc(n.x * w, n.y * h, radius, 0, Math.PI * 2);
        ctx.fill();
        
        if (n.pulse > 0) {
          ctx.shadowBlur = 15 * n.pulse;
          ctx.shadowColor = '#fff';
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return <canvas ref={canvasRef} className="visualization-canvas" />;
};
