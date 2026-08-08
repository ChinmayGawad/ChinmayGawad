const fs = require('fs');
const path = require('path');

// 5x7 Pixel Font Definitions (Uppercase A-Z, 0-9, space, dash)
const PIXEL_FONT = {
  'A': ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  'B': ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  'C': ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  'D': ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  'E': ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  'F': ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  'G': ["01111", "10000", "10000", "10111", "10001", "10001", "01110"],
  'H': ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  'I': ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  'J': ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  'K': ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  'L': ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  'M': ["10001", "11011", "10101", "10001", "10001", "10001", "10001"],
  'N': ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  'O': ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  'P': ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  'Q': ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  'R': ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  'S': ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  'T': ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  'U': ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  'V': ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  'W': ["10001", "10001", "10001", "10001", "10101", "11011", "10001"],
  'X': ["10001", "01010", "00100", "00100", "00100", "01010", "10001"],
  'Y': ["10001", "01010", "00100", "00100", "00100", "00100", "00100"],
  'Z': ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  ' ': ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  '-': ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  '0': ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  '1': ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  '2': ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  '3': ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  '4': ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  '5': ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  '6': ["01110", "10000", "11110", "10001", "10001", "10001", "01110"],
  '7': ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  '8': ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  '9': ["01110", "10001", "10001", "10001", "01111", "00001", "01110"]
};

// Map text to grid matrix (53 columns x 7 rows)
function generatePixelMap(text, totalCols = 53) {
  const grid = Array.from({ length: 7 }, () => Array(totalCols).fill(0));
  const chars = text.toUpperCase().split('');

  // Calculate total width needed
  let charWidths = chars.map(ch => (PIXEL_FONT[ch] ? 5 : 0));
  let totalTextWidth = charWidths.reduce((sum, w) => sum + w, 0) + (chars.length - 1); // 1 space between chars

  // Center starting column
  let startCol = Math.max(1, Math.floor((totalCols - totalTextWidth) / 2));

  let currentCol = startCol;
  for (let ch of chars) {
    const glyph = PIXEL_FONT[ch] || PIXEL_FONT[' '];
    if (currentCol + 5 > totalCols) break;

    for (let r = 0; r < 7; r++) {
      const rowBits = glyph[r];
      for (let c = 0; c < 5; c++) {
        if (rowBits[c] === '1') {
          grid[r][currentCol + c] = 1;
        }
      }
    }
    currentCol += 6; // 5 width + 1 spacing
  }

  return grid;
}

// Pseudo-random level generator for background noise
function getBackgroundLevel(col, row) {
  const seed = (col * 17 + row * 31) % 100;
  if (seed < 45) return 0;
  if (seed < 75) return 1;
  if (seed < 90) return 2;
  if (seed < 97) return 3;
  return 4;
}

function buildSVG({ text = "CHINMAY", theme = "dark" }) {
  const cols = 53;
  const rows = 7;
  const cellSize = 11;
  const cellGap = 3;

  const padLeft = 45;
  const padTop = 45;
  const padRight = 35;
  const padBottom = 35;

  const gridWidth = cols * (cellSize + cellGap) - cellGap;
  const gridHeight = rows * (cellSize + cellGap) - cellGap;

  const width = padLeft + gridWidth + padRight;
  const height = padTop + gridHeight + padBottom;

  const pixelMap = generatePixelMap(text, cols);

  // Theme Palettes
  const isDark = theme === "dark";
  const bgFill = isDark ? "#0d1117" : "#ffffff";
  const borderStroke = isDark ? "#30363d" : "#d0d7de";
  const textMuted = isDark ? "#8b949e" : "#57606a";
  const textTitle = isDark ? "#00FF66" : "#0969da";

  // Contribution level base colors
  const baseColors = isDark ? [
    "#161b22", // Level 0
    "#0e4429", // Level 1
    "#006d32", // Level 2
    "#26a641", // Level 3
    "#39d353"  // Level 4
  ] : [
    "#ebedf0",
    "#9be9a8",
    "#40c463",
    "#30a14e",
    "#216e39"
  ];

  // High energy reveal colors
  const revealColor = isDark ? "#00ff66" : "#1f883d";
  const revealGlow = isDark ? "#00ffcc" : "#2ea043";
  const flashColor = isDark ? "#ffffff" : "#00ff66";

  // Sweep timing settings
  const animDuration = 6.5; // seconds per cycle
  const sweepPercent = 80; // 0% to 80% is jet movement across grid, 80%-100% reset phase

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Build cell SVG nodes and CSS rules
  let cellSVG = "";
  let keyframeRules = "";

  for (let c = 0; c < cols; c++) {
    const x = padLeft + c * (cellSize + cellGap);

    // Calculate normalized progress of beam hitting column c
    const colProgress = c / cols;
    const hitTimePct = (colProgress * sweepPercent).toFixed(2);
    const flashEndPct = (parseFloat(hitTimePct) + 3).toFixed(2);
    const resetTimePct = (sweepPercent + 5).toFixed(2);

    keyframeRules += `
      @keyframes colSweep_${c} {
        0%, ${hitTimePct}% {
          fill: var(--base-color);
          filter: none;
        }
        ${flashEndPct}% {
          fill: ${flashColor};
          filter: drop-shadow(0px 0px 6px ${revealGlow});
        }
        ${(parseFloat(flashEndPct) + 4).toFixed(2)}%, ${resetTimePct}% {
          fill: var(--target-color);
          filter: var(--target-filter);
        }
        95%, 100% {
          fill: var(--base-color);
          filter: none;
        }
      }
    `;

    for (let r = 0; r < rows; r++) {
      const y = padTop + r * (cellSize + cellGap);
      const isText = pixelMap[r][c] === 1;
      const baseLevel = getBackgroundLevel(c, r);
      const baseColor = baseColors[baseLevel];

      const targetColor = isText ? revealColor : baseColor;
      const targetFilter = isText ? `drop-shadow(0px 0px 3px ${revealColor})` : "none";

      const cellId = `cell_${c}_${r}`;

      cellSVG += `<rect id="${cellId}" class="cell col_${c}" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" style="--base-color: ${baseColor}; --target-color: ${targetColor}; --target-filter: ${targetFilter}; animation: colSweep_${c} ${animDuration}s infinite cubic-bezier(0.25, 1, 0.5, 1);" />\n`;
    }
  }

  // Month Labels
  let monthLabelsSVG = "";
  for (let i = 0; i < 12; i++) {
    const mCol = Math.floor(i * (cols / 12));
    const mX = padLeft + mCol * (cellSize + cellGap);
    monthLabelsSVG += `<text x="${mX}" y="${padTop - 12}" class="label-text">${months[i]}</text>\n`;
  }

  // Day Labels (Mon, Wed, Fri)
  let dayLabelsSVG = "";
  [1, 3, 5].forEach(r => {
    const dY = padTop + r * (cellSize + cellGap) + cellSize - 2;
    dayLabelsSVG += `<text x="${padLeft - 10}" y="${dY}" text-anchor="end" class="label-text">${days[r]}</text>\n`;
  });

  // Jet Sweep animation calculation
  const startX = padLeft - 25;
  const endX = padLeft + gridWidth + 25;

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" style="background: ${bgFill}; border-radius: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <defs>
    <!-- Glowing filter effects -->
    <filter id="jetGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <linearGradient id="beamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${revealColor}" stop-opacity="0" />
      <stop offset="70%" stop-color="${revealGlow}" stop-opacity="0.4" />
      <stop offset="100%" stop-color="${flashColor}" stop-opacity="0.9" />
    </linearGradient>
    
    <linearGradient id="jetTrail" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00FF66" stop-opacity="0" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.8" />
    </linearGradient>
  </defs>

  <style>
    .card-border {
      fill: none;
      stroke: ${borderStroke};
      stroke-width: 1px;
      rx: 10px;
    }
    .title-text {
      fill: ${textTitle};
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .subtitle-text {
      fill: ${textMuted};
      font-size: 11px;
      font-weight: 500;
    }
    .label-text {
      fill: ${textMuted};
      font-size: 10px;
      font-weight: 400;
    }
    .cell {
      transition: fill 0.2s ease;
    }
    
    /* Jet Beam Motion */
    @keyframes jetMotion {
      0% {
        transform: translateX(${startX}px);
        opacity: 0;
      }
      3% {
        opacity: 1;
      }
      ${sweepPercent}% {
        transform: translateX(${endX}px);
        opacity: 1;
      }
      ${sweepPercent + 2}% {
        opacity: 0;
      }
      100% {
        transform: translateX(${startX}px);
        opacity: 0;
      }
    }
    
    .jet-container {
      animation: jetMotion ${animDuration}s infinite linear;
    }
    
    /* Pulse laser tip */
    @keyframes laserPulse {
      0%, 100% { opacity: 0.8; }
      50% { opacity: 1; filter: drop-shadow(0 0 8px #ffffff); }
    }
    .laser-line {
      animation: laserPulse 0.5s infinite alternate;
    }
    ${keyframeRules}
  </style>

  <!-- Container Border -->
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" class="card-border" />

  <!-- Header Section -->
  <g transform="translate(${padLeft}, 25)">
    <text x="0" y="0" class="title-text">⚡ MATRIX CONTRIBUTION JET SWEEP</text>
    <text x="${gridWidth}" y="0" text-anchor="end" class="subtitle-text">SYSTEM.REVEAL: [ ${text} ]</text>
  </g>

  <!-- Labels -->
  <g>${monthLabelsSVG}</g>
  <g>${dayLabelsSVG}</g>

  <!-- Contribution Cells -->
  <g>${cellSVG}</g>

  <!-- Animated Jet Sweep Assembly -->
  <g class="jet-container" y="${padTop}">
    <!-- Vertical Scanner Laser Beam -->
    <line x1="0" y1="${padTop - 4}" x2="0" y2="${padTop + gridHeight + 4}" stroke="url(#beamGradient)" stroke-width="3" filter="url(#jetGlow)" class="laser-line" />
    
    <!-- Beam Wake Trail -->
    <polygon points="-40,${padTop} 0,${padTop - 2} 0,${padTop + gridHeight + 2} -40,${padTop + gridHeight}" fill="url(#beamGradient)" opacity="0.3" />

    <!-- Jet Fighter Silhouette Head -->
    <g transform="translate(0, ${padTop + gridHeight / 2}) scale(0.95)">
      <!-- Jet Body -->
      <path d="M 12 0 L -14 -12 L -6 -3 L -22 -4 L -22 4 L -6 3 L -14 12 Z" fill="${isDark ? '#00FF66' : '#0969da'}" filter="url(#jetGlow)" />
      <!-- Jet Cockpit / Energy Core -->
      <polygon points="4,0 -4,-3 -2,0 -4,3" fill="#ffffff" />
      <!-- Engine Thruster Flare -->
      <polygon points="-22,-3 -32,0 -22,3" fill="url(#jetTrail)" />
    </g>
    
    <!-- Top & Bottom Laser Nodes -->
    <circle cx="0" cy="${padTop - 4}" r="3" fill="#ffffff" filter="url(#jetGlow)" />
    <circle cx="0" cy="${padTop + gridHeight + 4}" r="3" fill="#ffffff" filter="url(#jetGlow)" />
  </g>
</svg>`;

  return svgContent;
}

// Main execution
function main() {
  const distDir = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Generate Dark & Light SVG variants
  const darkSVG = buildSVG({ text: "CHINMAY", theme: "dark" });
  const lightSVG = buildSVG({ text: "CHINMAY", theme: "light" });

  fs.writeFileSync(path.join(distDir, 'matrix-beam-dark.svg'), darkSVG, 'utf8');
  fs.writeFileSync(path.join(distDir, 'matrix-beam-light.svg'), lightSVG, 'utf8');

  console.log("Successfully generated matrix beam SVGs in dist/ directory!");
}

if (require.main === module) {
  main();
}

module.exports = { buildSVG, generatePixelMap };
