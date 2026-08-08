import React, { useState, useEffect } from 'react';
import './index.css';
import {
  AttentionMatrix,
  DimensionalProjection,
  TensorFlowFields,
  SpectralWeights,
  EigenvectorConstellations
} from './Visualizations';

const proposals = [
  { id: 'attention', name: '1. The Attention Matrix', component: AttentionMatrix },
  { id: 'dimensional', name: '2. Dimensional Projection', component: DimensionalProjection },
  { id: 'tensor', name: '3. Tensor Flow Fields', component: TensorFlowFields },
  { id: 'spectral', name: '4. Spectral Weights', component: SpectralWeights },
  { id: 'eigenvector', name: '5. Eigenvector Constellations', component: EigenvectorConstellations }
];

function App() {
  const [activeProposal, setActiveProposal] = useState(proposals[0].id);
  const [autoRate, setAutoRate] = useState(1);
  const [contextHealth, setContextHealth] = useState(80);
  const [cacheHealth, setCacheHealth] = useState(80);
  const [tapsCount, setTapsCount] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);

  // Dimensional Projection specific settings
  const [tokenColor, setTokenColor] = useState('#38bdf8');
  const [tokenSize, setTokenSize] = useState(3);
  const [trailLength, setTrailLength] = useState(0.7);
  const [ringBaseDistance, setRingBaseDistance] = useState(5);
  const [ringMaxDistance, setRingMaxDistance] = useState(20);
  const [ringGlow, setRingGlow] = useState(30);
  const [circleSparkle, setCircleSparkle] = useState(0.5);
  const [ringSparkle, setRingSparkle] = useState(0.5);
  const [circleSparkleSize, setCircleSparkleSize] = useState(1.5);
  const [ringSparkleSize, setRingSparkleSize] = useState(1.5);
  const [alwaysSparkle, setAlwaysSparkle] = useState(false);
  const [sparkleDuration, setSparkleDuration] = useState(1.0);
  const [duotoneRing, setDuotoneRing] = useState(false);
  const [waveColor, setWaveColor] = useState('#a855f7');
  const [waveOpacity, setWaveOpacity] = useState(0.5);
  const [buttonColor, setButtonColor] = useState('#1e293b');
  const [bezelColor, setBezelColor] = useState('#334155');
  const [bezelThickness, setBezelThickness] = useState(2);
  const [tokenFlowDistance, setTokenFlowDistance] = useState(0);
  const [waveOverflowDistance, setWaveOverflowDistance] = useState(0);
  const [visualScale, setVisualScale] = useState(1.0);
  const [minPushDistance, setMinPushDistance] = useState(15);

  // Background token accumulator based on autoRate
  useEffect(() => {
    const interval = setInterval(() => {
      setTotalTokens(prev => prev + autoRate);
    }, 100);
    return () => clearInterval(interval);
  }, [autoRate]);

  // Spacebar Hotkey for Tap
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault(); // Prevent page scroll on spacebar
        handleTap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTap = () => {
    setTapsCount(prev => prev + 1);
    setTotalTokens(prev => prev + 50); // Tap yields 50 tokens instantly
  };

  const ActiveComponent = proposals.find(p => p.id === activeProposal).component;

  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <h1>Matrix Variance Devtools</h1>

        <div className="tap-section">
          <button className="tap-button" onClick={handleTap}>
            TAP [Space] ({tapsCount})
          </button>
        </div>

        <p className="subtitle">Interactive mathematical UI proposals for incoming/outgoing token streams and system health.</p>
        
        <div className="proposals-list">
          {proposals.map(p => (
            <button
              key={p.id}
              className={`proposal-btn ${activeProposal === p.id ? 'active' : ''}`}
              onClick={() => setActiveProposal(p.id)}
            >
              {p.name}
              {activeProposal === p.id && <span style={{color: '#3b82f6'}}>●</span>}
            </button>
          ))}
        </div>

        <div className="control-group">
          <label>
            <span>Automated Tokens (Rate)</span>
            <span>{autoRate}x</span>
          </label>
          <input 
            type="range" 
            min="0" max="10" step="0.5" 
            value={autoRate} 
            onChange={e => setAutoRate(Number(e.target.value))} 
            className="slider" 
          />
        </div>

        <div className="control-group">
          <label>
            <span>Context Health</span>
            <span>{contextHealth}%</span>
          </label>
          <input 
            type="range" 
            min="0" max="100" 
            value={contextHealth} 
            onChange={e => setContextHealth(Number(e.target.value))} 
            className="slider" 
          />
        </div>

        <div className="control-group">
          <label>
            <span>Cache Health</span>
            <span>{cacheHealth}%</span>
          </label>
          <input 
            type="range" 
            min="0" max="100" 
            value={cacheHealth} 
            onChange={e => setCacheHealth(Number(e.target.value))} 
            className="slider" 
          />
        </div>

        {activeProposal === 'dimensional' && (
          <>
            <div className="control-group">
              <label>
                <span>Token Color</span>
              </label>
              <div style={{display: 'flex', gap: '8px', marginTop: '4px'}}>
                {['#facc15', '#38bdf8', '#a855f7', '#10b981', '#ffffff'].map(c => (
                  <button 
                    key={c}
                    onClick={() => setTokenColor(c)}
                    style={{
                      width: '24px', height: '24px', borderRadius: '50%', 
                      background: c, border: tokenColor === c ? '2px solid white' : '2px solid transparent',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="control-group">
              <label>
                <span>Token Size</span>
                <span>{tokenSize}px</span>
              </label>
              <input 
                type="range" 
                min="1" max="10" 
                value={tokenSize} 
                onChange={e => setTokenSize(Number(e.target.value))} 
                className="slider" 
              />
            </div>

            <div className="control-group">
              <label>
                <span>Trail Length</span>
                <span>{trailLength}</span>
              </label>
              <input 
                type="range" 
                min="0.01" max="1" step="0.01"
                value={trailLength} 
                onChange={e => setTrailLength(Number(e.target.value))} 
                className="slider" 
              />
            </div>
            <div className="control-group">
              <label>
                <span>Ring Base Distance</span>
                <span>{ringBaseDistance}px</span>
              </label>
              <input 
                type="range" 
                min="0" max="50" 
                value={ringBaseDistance} 
                onChange={e => setRingBaseDistance(Number(e.target.value))} 
                className="slider" 
              />
            </div>

            <div className="control-group">
              <label>
                <span>Ring Max Distance</span>
                <span>{ringMaxDistance}px</span>
              </label>
              <input 
                type="range" 
                min="10" max="200" 
                value={ringMaxDistance} 
                onChange={e => setRingMaxDistance(Number(e.target.value))} 
                className="slider" 
              />
            </div>

            <div className="control-group">
              <label>
                <span>Ring Glow</span>
                <span>{ringGlow}px</span>
              </label>
              <input 
                type="range" 
                min="0" max="100" 
                value={ringGlow} 
                onChange={e => setRingGlow(Number(e.target.value))} 
                className="slider" 
              />
            </div>

            <div className="control-group">
              <label>
                <span>Circle Sparkle Density</span>
                <span>{Math.round(circleSparkle * 100)}%</span>
              </label>
              <input 
                type="range" 
                min="0" max="1" step="0.01"
                value={circleSparkle} 
                onChange={e => setCircleSparkle(Number(e.target.value))} 
                className="slider" 
              />
            </div>

            <div className="control-group">
              <label>
                <span>Circle Sparkle Size</span>
                <span>{circleSparkleSize.toFixed(1)}px</span>
              </label>
              <input 
                type="range" 
                min="0.5" max="5" step="0.1"
                value={circleSparkleSize} 
                onChange={e => setCircleSparkleSize(Number(e.target.value))} 
                className="slider" 
              />
            </div>

            <div className="control-group">
              <label>
                <span>Ring Sparkle Density</span>
                <span>{Math.round(ringSparkle * 100)}%</span>
              </label>
              <input 
                type="range" 
                min="0" max="1" step="0.01"
                value={ringSparkle} 
                onChange={e => setRingSparkle(Number(e.target.value))} 
                className="slider" 
              />
            </div>

            <div className="control-group">
              <label>
                <span>Ring Sparkle Size</span>
                <span>{ringSparkleSize.toFixed(1)}px</span>
              </label>
              <input 
                type="range" 
                min="0.5" max="5" step="0.1"
                value={ringSparkleSize} 
                onChange={e => setRingSparkleSize(Number(e.target.value))} 
                className="slider" 
              />
            </div>

            <div className="control-group">
              <label>
                <span>Duotone Ring</span>
                <input 
                  type="checkbox" 
                  checked={duotoneRing} 
                  onChange={e => setDuotoneRing(e.target.checked)} 
                  style={{cursor: 'pointer'}}
                />
              </label>
            </div>
            <div className="control-group">
              <label>
                <span>Always Sparkle (Test)</span>
                <input 
                  type="checkbox" 
                  checked={alwaysSparkle} 
                  onChange={e => setAlwaysSparkle(e.target.checked)} 
                  style={{cursor: 'pointer'}}
                />
              </label>
            </div>

            <div className="control-group">
              <label>
                <span>Sparkle Duration</span>
                <span>{sparkleDuration.toFixed(1)}s</span>
              </label>
              <input 
                type="range" 
                min="0.1" max="5.0" step="0.1"
                value={sparkleDuration} 
                onChange={e => setSparkleDuration(Number(e.target.value))} 
                className="slider" 
              />
            </div>
            <div className="control-group">
              <label>
                <span>Wave Color</span>
                <input 
                  type="color" 
                  value={waveColor} 
                  onChange={e => setWaveColor(e.target.value)} 
                />
              </label>
            </div>

            <div className="control-group">
              <label>
                <span>Wave Opacity</span>
                <span>{waveOpacity.toFixed(2)}</span>
              </label>
              <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={waveOpacity} 
                onChange={e => setWaveOpacity(Number(e.target.value))} 
                className="slider" 
              />
            </div>

            <h3 style={{margin: '20px 0 10px', fontSize: '14px', color: '#94a3b8'}}>Button Wrapper Settings</h3>
            <div className="control-group">
              <label>Button Color</label>
              <input type="color" value={buttonColor} onChange={e => setButtonColor(e.target.value)} />
            </div>
            
            <div className="control-group">
              <label>Bezel Color</label>
              <input type="color" value={bezelColor} onChange={e => setBezelColor(e.target.value)} />
            </div>

            <div className="control-group">
              <label>
                <span>Bezel Thickness</span>
                <span>{bezelThickness}px</span>
              </label>
              <input type="range" min="0" max="20" step="1" value={bezelThickness} onChange={e => setBezelThickness(Number(e.target.value))} className="slider" />
            </div>

            <div className="control-group">
              <label>
                <span>Token Flow Distance</span>
                <span>{tokenFlowDistance}px</span>
              </label>
              <input type="range" min="0" max="150" step="1" value={tokenFlowDistance} onChange={e => setTokenFlowDistance(Number(e.target.value))} className="slider" />
            </div>

            <div className="control-group">
              <label>
                <span>Min Push Distance</span>
                <span>{minPushDistance}px</span>
              </label>
              <input type="range" min="0" max="100" step="1" value={minPushDistance} onChange={e => setMinPushDistance(Number(e.target.value))} className="slider" />
            </div>

            <div className="control-group">
              <label>
                <span>Wave Overflow Dist</span>
                <span>{waveOverflowDistance}px</span>
              </label>
              <input type="range" min="0" max="150" step="1" value={waveOverflowDistance} onChange={e => setWaveOverflowDistance(Number(e.target.value))} className="slider" />
            </div>

            <div className="control-group">
              <label>
                <span>Visual Scale</span>
                <span>{visualScale.toFixed(1)}x</span>
              </label>
              <input type="range" min="0.1" max="3" step="0.1" value={visualScale} onChange={e => setVisualScale(Number(e.target.value))} className="slider" />
            </div>
          </>
        )}
      </div>

      <div className="visualization-area">
        <div className="overlay-stats">
          <div className="stat-card">
            <span className="label">Total Tokens (Watts)</span>
            <span className="value">{Math.floor(totalTokens).toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <span className="label">Rate</span>
            <span className="value">{(autoRate * 10).toFixed(1)} /s</span>
          </div>
        </div>
        
        <ActiveComponent 
          autoRate={autoRate} 
          contextHealth={contextHealth} 
          cacheHealth={cacheHealth}
          tapsCount={tapsCount}
          tokenColor={tokenColor}
          tokenSize={tokenSize}
          trailLength={trailLength}
          ringBaseDistance={ringBaseDistance}
          ringMaxDistance={ringMaxDistance}
          ringGlow={ringGlow}
          circleSparkle={circleSparkle}
          ringSparkle={ringSparkle}
          circleSparkleSize={circleSparkleSize}
          ringSparkleSize={ringSparkleSize}
          alwaysSparkle={alwaysSparkle}
          sparkleDuration={sparkleDuration}
          duotoneRing={duotoneRing}
          waveColor={waveColor}
          waveOpacity={waveOpacity}
          buttonColor={buttonColor}
          bezelColor={bezelColor}
          bezelThickness={bezelThickness}
          tokenFlowDistance={tokenFlowDistance}
          waveOverflowDistance={waveOverflowDistance}
          visualScale={visualScale}
          minPushDistance={minPushDistance}
        />
      </div>
    </div>
  );
}

export default App;
