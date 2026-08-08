const fs = require('fs');
const path = require('path');
const https = require('https');

const USERNAME = process.env.GITHUB_USERNAME || 'ChinmayGawad';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

// Ensure output directories exist
const distDir = path.join(__dirname, '..', 'dist');
const assetsDir = path.join(__dirname, '..', 'assets');
[distDir, assetsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Fetch GitHub contributions via GraphQL API
async function fetchContributions(username, token) {
  if (!token) {
    console.log(`No GITHUB_TOKEN provided. Using fallback matrix data for @${username}.`);
    return generateFallbackData();
  }

  const query = JSON.stringify({
    query: `
      query($username: String!) {
        user(login: $username) {
          contributionsCollection {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  color
                  contributionCount
                  date
                  weekday
                }
              }
            }
          }
        }
      }
    `,
    variables: { username }
  });

  const options = {
    hostname: 'api.github.com',
    path: '/graphql',
    method: 'POST',
    headers: {
      'Authorization': `bearer ${token}`,
      'User-Agent': 'Node-GitHub-Laser-Eraser-Generator',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(query)
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data && json.data.user && json.data.user.contributionsCollection) {
            const calendar = json.data.user.contributionsCollection.contributionCalendar;
            console.log(`Successfully fetched ${calendar.totalContributions} total contributions for @${username}.`);
            resolve({
              totalContributions: calendar.totalContributions,
              weeks: calendar.weeks
            });
          } else {
            console.warn("GraphQL API response missing expected structure. Using fallback data.", json);
            resolve(generateFallbackData());
          }
        } catch (err) {
          console.error("Failed to parse GraphQL response:", err);
          resolve(generateFallbackData());
        }
      });
    });

    req.on('error', (err) => {
      console.error("GraphQL request error:", err);
      resolve(generateFallbackData());
    });

    req.write(query);
    req.end();
  });
}

// Fallback contribution data generator
function generateFallbackData() {
  const weeks = [];
  const today = new Date();
  let totalCount = 0;

  for (let w = 51; w >= 0; w--) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const dayOffset = (w * 7) + (6 - d);
      const date = new Date(today);
      date.setDate(today.getDate() - dayOffset);

      const seed = Math.sin(w * 7 + d * 13 + 42) * 10000;
      const rand = seed - Math.floor(seed);
      let count = 0;
      if (rand > 0.45) count = 1;
      if (rand > 0.65) count = 3;
      if (rand > 0.82) count = 6;
      if (rand > 0.94) count = 10;

      totalCount += count;
      days.push({
        contributionCount: count,
        date: date.toISOString().split('T')[0],
        weekday: d
      });
    }
    weeks.push({ contributionDays: days });
  }

  return {
    totalContributions: totalCount || 1482,
    weeks: weeks.reverse()
  };
}

// Convert count to level 0..4
function getLevel(count) {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  return 4;
}

// Generate SVG identical in design, mini jet sprite, organic wave sweep, and card layout to preview.html
function generateSVG(data, theme = 'dark') {
  const isDark = theme === 'dark';

  const colors = isDark ? {
    cardBg: '#161b22',
    border: '#30363d',
    titleText: '#c9d1d9',
    badgeWashText: '#39d353',
    badgeWashBg: 'rgba(57, 211, 83, 0.15)',
    badgeWashBorder: 'rgba(57, 211, 83, 0.3)',
    badgeRebuildText: '#58a6ff',
    badgeRebuildBg: 'rgba(88, 166, 255, 0.15)',
    badgeRebuildBorder: 'rgba(88, 166, 255, 0.3)',
    gridEmpty: '#161b22',
    gridEmptyBorder: '#21262d',
    levels: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
    footerText: '#8b949e',
    jetColor: '#ffffff',
    jetGlow: '#39d353'
  } : {
    cardBg: '#ffffff',
    border: '#d0d7de',
    titleText: '#1f2328',
    badgeWashText: '#216e39',
    badgeWashBg: 'rgba(33, 110, 57, 0.15)',
    badgeWashBorder: 'rgba(33, 110, 57, 0.3)',
    badgeRebuildText: '#0969da',
    badgeRebuildBg: 'rgba(9, 105, 218, 0.15)',
    badgeRebuildBorder: 'rgba(9, 105, 218, 0.3)',
    gridEmpty: '#ebedf0',
    gridEmptyBorder: '#d0d7de',
    levels: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    footerText: '#656d76',
    jetColor: '#1f2328',
    jetGlow: '#216e39'
  };

  const svgWidth = 900;
  const svgHeight = 240;
  const COLS = 52;
  const ROWS = 7;
  const CELL_SIZE = 12;
  const CELL_GAP = 4;
  const RADIUS = 2;

  const tileStep = CELL_SIZE + CELL_GAP; // 16px
  const gridWidth = COLS * tileStep + CELL_GAP; // 836px
  const gridHeight = ROWS * tileStep + CELL_GAP; // 116px

  const gridStartX = Math.round((svgWidth - gridWidth) / 2); // 32px
  const gridStartY = 72;

  const weeks = (data.weeks || []).slice(-COLS);

  let emptyTilesHTML = '';
  let activeTilesPhase1HTML = '';
  let activeTilesPhase2HTML = '';
  let totalActiveCount = 0;
  const totalDays = COLS * ROWS;

  weeks.forEach((week, c) => {
    const cellX = gridStartX + c * tileStep;
    (week.contributionDays || []).forEach((day) => {
      const r = day.weekday;
      if (r >= ROWS) return;
      const cellY = gridStartY + r * tileStep;
      const lvl = getLevel(day.contributionCount);

      if (lvl > 0) totalActiveCount++;

      // Base empty grid tile
      emptyTilesHTML += `      <rect x="${cellX}" y="${cellY}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="${RADIUS}" fill="${colors.gridEmpty}" stroke="${colors.gridEmptyBorder}" stroke-width="1" />\n`;
    });
  });

  // Per-row clip paths for Washing (Phase 1) and Rebuilding (Phase 2)
  let clipPathsHTML = '';
  let keyframesHTML = '';

  const sweepDistance = gridWidth + 90;

  for (let r = 0; r < ROWS; r++) {
    const sineOffset = Math.sin(r * 0.9) * 14;
    const rowY = gridStartY + r * tileStep - 2;
    const rowH = tileStep + 4;

    // Phase 1 (Washing): Clip rect left edge moves right -> erases tiles behind it
    const p1StartX = gridStartX - 40 + sineOffset;
    clipPathsHTML += `    <clipPath id="wash-clip-row-${r}-${theme}">\n`;
    clipPathsHTML += `      <rect class="wash-rect-row-${r}" x="${p1StartX}" y="${rowY}" width="${gridWidth + 200}" height="${rowH}" />\n`;
    clipPathsHTML += `    </clipPath>\n`;

    // Phase 2 (Rebuilding): Clip rect right edge moves right -> reveals tiles behind it
    const p2StartX = gridStartX - 60 + sineOffset;
    clipPathsHTML += `    <clipPath id="rebuild-clip-row-${r}-${theme}">\n`;
    clipPathsHTML += `      <rect class="rebuild-rect-row-${r}" x="${p2StartX}" y="${rowY}" width="0" height="${rowH}" />\n`;
    clipPathsHTML += `    </clipPath>\n`;

    keyframesHTML += `
      @keyframes wash-anim-row-${r} {
        0% { transform: translateX(0px); }
        44% { transform: translateX(${sweepDistance}px); }
        48%, 100% { transform: translateX(${sweepDistance}px); }
      }
      .wash-rect-row-${r} {
        animation: wash-anim-row-${r} 8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }

      @keyframes rebuild-anim-row-${r} {
        0%, 48% { width: 0px; }
        92% { width: ${gridWidth + 120}px; }
        98%, 100% { width: ${gridWidth + 120}px; }
      }
      .rebuild-rect-row-${r} {
        animation: rebuild-anim-row-${r} 8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }

      @keyframes glow-line-anim-${r} {
        0% { transform: translateX(${p1StartX}px); opacity: 1; }
        44% { transform: translateX(${p1StartX + sweepDistance}px); opacity: 1; }
        45%, 49% { transform: translateX(${p1StartX + sweepDistance}px); opacity: 0; }
        50% { transform: translateX(${p1StartX}px); opacity: 1; }
        94% { transform: translateX(${p1StartX + sweepDistance}px); opacity: 1; }
        95%, 100% { transform: translateX(${p1StartX + sweepDistance}px); opacity: 0; }
      }
      .frontline-glow-row-${r} {
        animation: glow-line-anim-${r} 8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }
    `;
  }

  // Active tiles HTML for Phase 1 (Clipped by wash clipPath)
  for (let r = 0; r < ROWS; r++) {
    activeTilesPhase1HTML += `    <g clip-path="url(#wash-clip-row-${r}-${theme})">\n`;
    weeks.forEach((week, c) => {
      const cellX = gridStartX + c * tileStep;
      (week.contributionDays || []).forEach((day) => {
        if (day.weekday === r) {
          const lvl = getLevel(day.contributionCount);
          if (lvl > 0) {
            const color = colors.levels[lvl];
            const cellY = gridStartY + r * tileStep;
            activeTilesPhase1HTML += `      <rect x="${cellX}" y="${cellY}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="${RADIUS}" fill="${color}" />\n`;
          }
        }
      });
    });
    activeTilesPhase1HTML += `    </g>\n`;
  }

  // Active tiles HTML for Phase 2 (Clipped by rebuild clipPath)
  for (let r = 0; r < ROWS; r++) {
    activeTilesPhase2HTML += `    <g clip-path="url(#rebuild-clip-row-${r}-${theme})">\n`;
    weeks.forEach((week, c) => {
      const cellX = gridStartX + c * tileStep;
      (week.contributionDays || []).forEach((day) => {
        if (day.weekday === r) {
          const lvl = getLevel(day.contributionCount);
          if (lvl > 0) {
            const color = colors.levels[lvl];
            const cellY = gridStartY + r * tileStep;
            activeTilesPhase2HTML += `      <rect x="${cellX}" y="${cellY}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="${RADIUS}" fill="${color}" />\n`;
          }
        }
      });
    });
    activeTilesPhase2HTML += `    </g>\n`;
  }

  // Frontline white/green glow bars for frontline tiles
  let frontlineGlowHTML = '';
  for (let r = 0; r < ROWS; r++) {
    const rowY = gridStartY + r * tileStep;
    frontlineGlowHTML += `    <rect class="frontline-glow-row-${r}" x="0" y="${rowY}" width="4" height="${CELL_SIZE}" rx="2" fill="#ffffff" opacity="0.85" />\n`;
  }

  // Jet Y keyframes (sine-wave oscillation matching drawJet in preview.html)
  const jetMinX = gridStartX - 35;
  const jetMaxX = gridStartX + gridWidth + 35;

  const headerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%">
  <defs>
    <style>
      * {
        box-sizing: border-box;
      }

      .card-bg {
        fill: ${colors.cardBg};
        stroke: ${colors.border};
        stroke-width: 1;
        rx: 12px;
      }

      .title-text {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 15px;
        font-weight: 600;
        fill: ${colors.titleText};
      }

      .footer-text {
        font-family: monospace, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        fill: ${colors.footerText};
      }

      /* Status Badge Toggle Animations matching preview.html */
      @keyframes badge-wash-anim {
        0%, 45% { opacity: 1; }
        48%, 95% { opacity: 0; }
        98%, 100% { opacity: 1; }
      }

      @keyframes badge-rebuild-anim {
        0%, 45% { opacity: 0; }
        48%, 95% { opacity: 1; }
        98%, 100% { opacity: 0; }
      }

      .badge-wash {
        animation: badge-wash-anim 8s ease-in-out infinite;
      }

      .badge-rebuild {
        animation: badge-rebuild-anim 8s ease-in-out infinite;
      }

      /* Phase Visibility Animations */
      @keyframes phase-wash-visibility {
        0%, 46% { opacity: 1; }
        48%, 96% { opacity: 0; }
        98%, 100% { opacity: 1; }
      }

      @keyframes phase-rebuild-visibility {
        0%, 46% { opacity: 0; }
        48%, 96% { opacity: 1; }
        98%, 100% { opacity: 0; }
      }

      .phase-wash-layer { animation: phase-wash-visibility 8s ease-in-out infinite; }
      .phase-rebuild-layer { animation: phase-rebuild-visibility 8s ease-in-out infinite; }

      /* Jet Spaceship Movements */
      @keyframes jet-x-anim {
        0% { transform: translateX(${jetMinX}px); opacity: 1; }
        44% { transform: translateX(${jetMaxX}px); opacity: 1; }
        45%, 49% { transform: translateX(${jetMaxX}px); opacity: 0; }
        50% { transform: translateX(${jetMinX}px); opacity: 1; }
        94% { transform: translateX(${jetMaxX}px); opacity: 1; }
        95%, 100% { transform: translateX(${jetMaxX}px); opacity: 0; }
      }

      @keyframes jet-y-anim {
        0% { transform: translateY(${gridStartY + 58}px); }
        10% { transform: translateY(${gridStartY + 18}px); }
        20% { transform: translateY(${gridStartY + 98}px); }
        30% { transform: translateY(${gridStartY + 28}px); }
        40% { transform: translateY(${gridStartY + 88}px); }
        50% { transform: translateY(${gridStartY + 58}px); }
        60% { transform: translateY(${gridStartY + 18}px); }
        70% { transform: translateY(${gridStartY + 98}px); }
        80% { transform: translateY(${gridStartY + 28}px); }
        90% { transform: translateY(${gridStartY + 88}px); }
        100% { transform: translateY(${gridStartY + 58}px); }
      }

      .jet-wrapper {
        animation: jet-x-anim 8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }

      .jet-subwrapper {
        animation: jet-y-anim 8s ease-in-out infinite;
      }

      /* Particle Sparkle Animations matching spawnParticles in preview.html */
      @keyframes particle-pop-1 {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0; }
        10% { transform: translate(-10px, -8px) scale(1.5); opacity: 0.95; }
        25% { transform: translate(-20px, -16px) scale(0.4); opacity: 0; }
      }

      @keyframes particle-pop-2 {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0; }
        12% { transform: translate(-8px, 10px) scale(1.4); opacity: 0.95; }
        28% { transform: translate(-18px, 18px) scale(0.3); opacity: 0; }
      }

      @keyframes particle-pop-3 {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0; }
        15% { transform: translate(-12px, 0px) scale(1.6); opacity: 1; }
        30% { transform: translate(-24px, 0px) scale(0.2); opacity: 0; }
      }

      .particle-1 { animation: particle-pop-1 1.2s ease-out infinite; }
      .particle-2 { animation: particle-pop-2 1.5s ease-out infinite; }
      .particle-3 { animation: particle-pop-3 1.1s ease-out infinite; }

      ${keyframesHTML}
    </style>

    ${clipPathsHTML}
  </defs>

  <!-- Outer Card Background matching preview.html card -->
  <rect class="card-bg" x="1" y="1" width="${svgWidth - 2}" height="${svgHeight - 2}" />

  <!-- Header Section matching preview.html header -->
  <g transform="translate(28, 44)">
    <text class="title-text" x="0" y="0">Contribution Activity</text>

    <!-- Status Badge: WASHING GRID -->
    <g class="badge-wash" transform="translate(165, -13)">
      <rect x="0" y="0" width="110" height="20" rx="10" fill="${colors.badgeWashBg}" stroke="${colors.badgeWashBorder}" stroke-width="1" />
      <text x="55" y="13" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500" letter-spacing="0.5" fill="${colors.badgeWashText}" text-anchor="middle">WASHING GRID</text>
    </g>

    <!-- Status Badge: REBUILDING GRID -->
    <g class="badge-rebuild" transform="translate(165, -13)">
      <rect x="0" y="0" width="124" height="20" rx="10" fill="${colors.badgeRebuildBg}" stroke="${colors.badgeRebuildBorder}" stroke-width="1" />
      <text x="62" y="13" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500" letter-spacing="0.5" fill="${colors.badgeRebuildText}" text-anchor="middle">REBUILDING GRID</text>
    </g>
  </g>

  <!-- BASE LAYER: Empty Contribution Grid (52 cols x 7 rows) -->
  <g id="base-empty-grid">
${emptyTilesHTML}  </g>

  <!-- PHASE 1 LAYER: Active Contribution Tiles (WASHING PHASE) -->
  <g id="active-grid-phase-1" class="phase-wash-layer">
${activeTilesPhase1HTML}  </g>

  <!-- PHASE 2 LAYER: Active Contribution Tiles (REBUILDING PHASE) -->
  <g id="active-grid-phase-2" class="phase-rebuild-layer">
${activeTilesPhase2HTML}  </g>

  <!-- FRONTLINE WHITE GLOW INDICATOR OVERLAY -->
  <g id="frontline-glow-indicators">
${frontlineGlowHTML}  </g>

  <!-- MINI JET SPACESHIP CURSOR WITH ENGINE GLOW & PARTICLES -->
  <g class="jet-wrapper">
    <g class="jet-subwrapper">
      <!-- Particle Sparks -->
      <circle class="particle-1" cx="-6" cy="-3" r="2" fill="${colors.badgeWashText}" />
      <circle class="particle-2" cx="-6" cy="3" r="1.5" fill="${colors.badgeWashText}" />
      <circle class="particle-3" cx="-8" cy="0" r="2.5" fill="#ffffff" />

      <!-- Glowing Jet Engine Circles (Native SVG Layers without <filter>) -->
      <circle cx="-4" cy="0" r="7" fill="${colors.jetGlow}" opacity="0.3" />
      <circle cx="-4" cy="0" r="4.5" fill="${colors.jetGlow}" opacity="0.7" />
      <circle cx="-4" cy="0" r="2.5" fill="#ffffff" />

      <!-- Spaceship Jet Cursor Shape matching drawJet in preview.html -->
      <path d="M 10 0 L -6 -7 L -2 0 L -6 7 Z" fill="${colors.jetColor}" />
    </g>
  </g>

  <!-- FOOTER DIAGNOSTICS & LEGEND matching preview.html footer -->
  <g transform="translate(28, ${svgHeight - 24})">
    <!-- Counter Text: Washing State -->
    <text x="0" y="0" class="footer-text phase-wash-layer">${totalActiveCount} / ${totalDays} days washed</text>
    <!-- Counter Text: Rebuilding State -->
    <text x="0" y="0" class="footer-text phase-rebuild-layer">0 / ${totalDays} days erased</text>

    <!-- Contribution Level Legend -->
    <g transform="translate(${svgWidth - 250}, -10)">
      <text x="0" y="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="${colors.footerText}">Less</text>
      <rect x="35" y="1" width="10" height="10" rx="2" fill="${colors.levels[0]}" stroke="${colors.gridEmptyBorder}" stroke-width="1" />
      <rect x="50" y="1" width="10" height="10" rx="2" fill="${colors.levels[1]}" />
      <rect x="65" y="1" width="10" height="10" rx="2" fill="${colors.levels[2]}" />
      <rect x="80" y="1" width="10" height="10" rx="2" fill="${colors.levels[3]}" />
      <rect x="95" y="1" width="10" height="10" rx="2" fill="${colors.levels[4]}" />
      <text x="113" y="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="${colors.footerText}">More</text>
    </g>
  </g>
</svg>`;

  return headerHTML;
}

// Main execution function
async function main() {
  console.log(`Starting Matrix Laser Jet Eraser SVG Generation for @${USERNAME}...`);
  const data = await fetchContributions(USERNAME, GITHUB_TOKEN);

  const darkSVG = generateSVG(data, 'dark');
  const lightSVG = generateSVG(data, 'light');

  // Save to dist/
  fs.writeFileSync(path.join(distDir, 'eraser-dark.svg'), darkSVG, 'utf8');
  fs.writeFileSync(path.join(distDir, 'eraser-light.svg'), lightSVG, 'utf8');

  console.log("Successfully generated Laser Jet Eraser SVGs in dist/!");
}

main().catch((err) => {
  console.error("Fatal error during SVG generation:", err);
  process.exit(1);
});
