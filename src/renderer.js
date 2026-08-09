/**
 * Builds the exact HTML page preserving preview.html 1-to-1 with real grid data injected
 */
function getHTMLTemplate(gridData, totalContributions = 0) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Organic GitHub Contribution Wash Effect</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: #0b0e14;
      color: #c9d1d9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }

    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 28px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
      max-width: 900px;
      width: 100%;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 15px;
      font-weight: 600;
    }

    .status-badge {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 12px;
      background: rgba(57, 211, 83, 0.15);
      color: #39d353;
      border: 1px solid rgba(57, 211, 83, 0.3);
      font-weight: 500;
      letter-spacing: 0.5px;
      transition: all 0.3s ease;
    }

    .canvas-container {
      position: relative;
      display: flex;
      justify-content: center;
      padding: 10px 0;
    }

    canvas {
      display: block;
    }

    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
      font-size: 12px;
      color: #8b949e;
      font-family: monospace;
    }

    .legend {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .legend-box {
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }
  </style>
</head>
<body>

<div class="card" id="cardContainer">
  <div class="header">
    <div class="title">
      <span>Contribution Activity</span>
      <span class="status-badge" id="modeBadge">WASHING GRID</span>
    </div>
  </div>

  <div class="canvas-container">
    <canvas id="gridCanvas"></canvas>
  </div>

  <div class="footer">
    <span id="counterText">0 / 364 days washed</span>
    <div class="legend">
      <span>Less</span>
      <div class="legend-box" id="leg1" style="background: #161b22; border: 1px solid #21262d;"></div>
      <div class="legend-box" id="leg2" style="background: #0e4429;"></div>
      <div class="legend-box" id="leg3" style="background: #006d32;"></div>
      <div class="legend-box" id="leg4" style="background: #26a641;"></div>
      <div class="legend-box" id="leg5" style="background: #39d353;"></div>
      <span>More</span>
    </div>
  </div>
</div>

<script>
  const canvas = document.getElementById('gridCanvas');
  const ctx = canvas.getContext('2d');
  const modeBadge = document.getElementById('modeBadge');
  const counterText = document.getElementById('counterText');

  // Matrix Configuration
  const COLS = 52;
  const ROWS = 7;
  const CELL_SIZE = 12;
  const CELL_GAP = 4;
  const RADIUS = 2;

  // Theme Palettes: Matrix Green for Washing & Electric Cyber Blue for Rebuilding
  const GREEN_PALETTE = [
    [22, 27, 34],    // Level 0: #161b22
    [14, 68, 41],    // Level 1: #0e4429
    [0, 109, 50],    // Level 2: #006d32
    [38, 166, 65],   // Level 3: #26a641
    [57, 211, 83]    // Level 4: #39d353
  ];

  const CYBER_BLUE_PALETTE = [
    [22, 27, 34],    // Level 0: #161b22
    [0, 90, 190],    // Level 1: #005abe (Vivid Deep Electric Blue)
    [0, 140, 255],   // Level 2: #008cff (Bright Neon Cyber Blue)
    [0, 200, 255],   // Level 3: #00c8ff (Electric Cyan Blue)
    [0, 255, 255]    // Level 4: #00ffff (Glowing Laser Cyber Blue)
  ];

  function getInterpolatedColor(levelVal, palette = GREEN_PALETTE) {
    const clamped = Math.max(0, Math.min(4, levelVal));
    const lowerIdx = Math.floor(clamped);
    const upperIdx = Math.min(4, Math.ceil(clamped));
    const factor = clamped - lowerIdx;

    const c1 = palette[lowerIdx];
    const c2 = palette[upperIdx];

    const r = Math.round(c1[0] + (c2[0] - c1[0]) * factor);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * factor);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * factor);

    return \`rgb(\${r}, \${g}, \${b})\`;
  }

  // Setup Canvas Dimensions
  const width = COLS * (CELL_SIZE + CELL_GAP) + CELL_GAP;
  const height = ROWS * (CELL_SIZE + CELL_GAP) + CELL_GAP;
  canvas.width = width;
  canvas.height = height;

  // Injected Real Grid Data
  const INJECTED_DATA = ${JSON.stringify(gridData)};

  // Build Grid State from Real Data
  const grid = [];
  let totalActive = 0;

  for (let c = 0; c < COLS; c++) {
    const col = [];
    for (let r = 0; r < ROWS; r++) {
      const cellData = (INJECTED_DATA[c] && INJECTED_DATA[c][r]) ? INJECTED_DATA[c][r] : { level: 0 };
      const level = Math.min(4, Math.max(0, cellData.level || 0));

      if (level > 0) totalActive++;

      col.push({
        level: level,
        currentLevel: level
      });
    }
    grid.push(col);
  }

  // Particle System
  const particles = [];

  function spawnWashParticles(x, y, colorStr) {
    const count = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + CELL_SIZE / 2,
        y: y + CELL_SIZE / 2,
        vx: (Math.random() - 0.5) * 2.0,
        vy: (Math.random() - 0.7) * 1.8,
        size: Math.random() * 2.2 + 1.0,
        alpha: 0.9,
        color: colorStr
      });
    }
  }

  function spawnJetTrail(x, y, accentColor) {
    if (Math.random() < 0.6) {
      particles.push({
        x: x - 6,
        y: y + (Math.random() - 0.5) * 4,
        vx: -(Math.random() * 2.2 + 1.2),
        vy: (Math.random() - 0.5) * 1.0,
        size: Math.random() * 2.2 + 1.0,
        alpha: 0.85,
        color: accentColor
      });
    }
  }

  function updateAndDrawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.05;

      if (p.alpha <= 0) {
        particles.splice(i, 1);
      } else {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // Animation State
  let sweepX = -60;
  let isErasing = true;

  // Draw Mini Jet Spaceship
  function drawJet(x, y, accentColor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 10;
    
    // Mini Spaceship / Cursor Shape
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();

    // Jet Engine Glow
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(-4, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    spawnJetTrail(x, y, accentColor);
  }

  // Deterministic Step Function for Headless Playwright Frame Capture
  // Transaction 1 (progressRatio 0.0 to 0.5): Washing Grid (Matrix Green washes to dark)
  // Transaction 2 (progressRatio 0.5 to 1.0): Rebuilding Grid (Rebuilds in Electric Cyber Blue #00ffff)
  window.renderStep = function(progressRatio) {
    ctx.clearRect(0, 0, width, height);

    if (progressRatio !== undefined) {
      if (progressRatio === 0) {
        particles.length = 0; // Clear particles at loop boundary
      }
      isErasing = progressRatio < 0.5;
      const localNorm = isErasing ? (progressRatio * 2.0) : ((progressRatio - 0.5) * 2.0);
      sweepX = -60 + localNorm * (width + 140);
    } else {
      sweepX += 1.2;
      if (sweepX > width + 80) {
        sweepX = -60;
        isErasing = !isErasing;
      }
    }

    const accentColor = isErasing ? '#39d353' : '#0099ff';
    const cellPalette = isErasing ? GREEN_PALETTE : CYBER_BLUE_PALETTE;

    modeBadge.innerText = isErasing ? "WASHING GRID" : "REBUILDING GRID";
    modeBadge.style.color = isErasing ? '#39d353' : '#0099ff';
    modeBadge.style.borderColor = isErasing ? "rgba(57, 211, 83, 0.4)" : "rgba(0, 153, 255, 0.4)";
    modeBadge.style.background = isErasing ? "rgba(57, 211, 83, 0.15)" : "rgba(0, 153, 255, 0.15)";

    // Update legend boxes dynamically to match active transaction
    const leg2 = document.getElementById('leg2');
    const leg3 = document.getElementById('leg3');
    const leg4 = document.getElementById('leg4');
    const leg5 = document.getElementById('leg5');
    if (leg2 && leg3 && leg4 && leg5) {
      if (isErasing) {
        leg2.style.background = '#0e4429';
        leg3.style.background = '#006d32';
        leg4.style.background = '#26a641';
        leg5.style.background = '#39d353';
      } else {
        leg2.style.background = '#005abe';
        leg3.style.background = '#008cff';
        leg4.style.background = '#00c8ff';
        leg5.style.background = '#00ffff';
      }
    }

    let currentWashed = 0;
    const time = progressRatio !== undefined ? progressRatio * 15.0 : Date.now() * 0.005;

    for (let c = 0; c < COLS; c++) {
      const cellX = c * (CELL_SIZE + CELL_GAP) + CELL_GAP;

      for (let r = 0; r < ROWS; r++) {
        const cellY = r * (CELL_SIZE + CELL_GAP) + CELL_GAP;
        const cell = grid[c][r];

        // Leading edge of the wave is locked to the arrow nose tip
        const rowOffset = Math.sin(r * 0.85 + time) * 12;
        const effectiveSweep = sweepX + 10 + rowOffset;

        let targetVal = cell.level;

        if (isErasing) {
          if (cellX > effectiveSweep) {
            // Arrow tip has NOT touched this cell yet -> 100% intact!
            targetVal = cell.level;
          } else if (cellX >= effectiveSweep - 20) {
            // Arrow tip JUST TOUCHED this cell -> dissolving behind arrow tip!
            const distFromTip = effectiveSweep - cellX;
            targetVal = cell.level * (1 - distFromTip / 20);
          } else {
            // Fully washed away behind wave
            targetVal = 0;
          }
        } else { // Rebuilding in Electric Cyber Blue (#00ffff)
          if (cellX > effectiveSweep) {
            // Arrow tip has NOT touched this cell yet -> 100% empty!
            targetVal = 0;
          } else if (cellX >= effectiveSweep - 20) {
            // Arrow tip JUST TOUCHED this cell -> rebuilding behind arrow tip!
            const distFromTip = effectiveSweep - cellX;
            targetVal = cell.level * (distFromTip / 20);
          } else {
            // Fully rebuilt behind wave
            targetVal = cell.level;
          }
        }

        cell.currentLevel = targetVal;

        // Count washed cells for counter badge
        if (cell.currentLevel < cell.level * 0.5 && cell.level > 0) {
          currentWashed++;
        }

        // Particle Spawning on Wave Front at Exact Point of Contact
        const distToWave = Math.abs(cellX - effectiveSweep);
        if (distToWave < 12 && cell.level > 0 && Math.random() < 0.28) {
          const colorStr = getInterpolatedColor(cell.level, cellPalette);
          spawnWashParticles(cellX, cellY, colorStr);
        }

        // Draw Cell with Interpolated Color in active cellPalette
        ctx.fillStyle = getInterpolatedColor(cell.currentLevel, cellPalette);
        ctx.beginPath();
        ctx.roundRect(cellX, cellY, CELL_SIZE, CELL_SIZE, RADIUS);
        ctx.fill();

        // Front-line Neon Wave Glow Overlay right at Point of Contact
        if (distToWave < 14 && cell.level > 0) {
          const glowAlpha = 0.8 * (1 - distToWave / 14);
          ctx.save();
          ctx.globalAlpha = glowAlpha;
          ctx.shadowColor = accentColor;
          ctx.shadowBlur = 10;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.roundRect(cellX, cellY, CELL_SIZE, CELL_SIZE, RADIUS);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // Update & draw particles
    updateAndDrawParticles();

    // Draw Jet Spaceship Sprite with Nose Tip locked to wave contact line
    if (sweepX >= -30 && sweepX <= width + 40) {
      const jetY = (height / 2) + Math.sin(time * 2.2) * (height / 3.4);
      const jetRow = Math.min(ROWS - 1, Math.max(0, Math.round((jetY - CELL_GAP) / (CELL_SIZE + CELL_GAP))));
      const jetRowOffset = Math.sin(jetRow * 0.85 + time) * 12;
      const jetX = sweepX + jetRowOffset;
      drawJet(jetX, jetY, accentColor);
    }

    counterText.innerText = \`\${currentWashed} / \${COLS * ROWS} days washed\`;
  };

  function animateLoop() {
    if (!window.manualStepMode) {
      window.renderStep();
      requestAnimationFrame(animateLoop);
    }
  }

  animateLoop();
</script>

</body>
</html>`;
}

module.exports = {
  getHTMLTemplate
};

