const fs = require('fs');

const USERNAME = process.env.GH_USERNAME || 'ChinmayGawad';
const COLS = 52;
const ROWS = 7;
const CELL_SIZE = 12;
const GAP = 4;
const RADIUS = 2;
const PADDING_X = 24;
const PADDING_Y = 50;

const COLORS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];

// Grid dimensions inside SVG
const gridWidth = COLS * (CELL_SIZE + GAP) - GAP;
const gridHeight = ROWS * (CELL_SIZE + GAP) - GAP;
const svgWidth = gridWidth + PADDING_X * 2;
const svgHeight = gridHeight + PADDING_Y + 32;

async function getRealContributions(username) {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (token) {
        try {
            const query = `
            query {
              user(login: "${username}") {
                contributionsCollection {
                  contributionCalendar {
                    totalContributions
                    weeks {
                      contributionDays {
                        date
                        contributionCount
                        contributionLevel
                      }
                    }
                  }
                }
              }
            }`;
            const response = await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers: {
                    'Authorization': `bearer ${token}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Node-Fetch'
                },
                body: JSON.stringify({ query })
            });
            const json = await response.json();
            const weeks = json?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
            if (weeks && weeks.length > 0) {
                const levelMap = {
                    'NONE': 0,
                    'FIRST_QUARTILE': 1,
                    'SECOND_QUARTILE': 2,
                    'THIRD_QUARTILE': 3,
                    'FOURTH_QUARTILE': 4
                };
                const slice = weeks.slice(-COLS); // 52 weeks ending today
                const days = [];
                for (let c = 0; c < slice.length; c++) {
                    const weekDays = slice[c].contributionDays;
                    for (let r = 0; r < weekDays.length; r++) {
                        const day = weekDays[r];
                        const level = levelMap[day.contributionLevel] ?? (day.contributionCount > 0 ? 1 : 0);
                        days.push({
                            col: c,
                            row: r,
                            level: level,
                            count: day.contributionCount,
                            date: day.date
                        });
                    }
                }
                console.log(`Fetched ${days.length} real contribution days via GraphQL API.`);
                return days;
            }
        } catch (e) {
            console.warn("GraphQL API fetch failed, falling back to public API:", e.message);
        }
    }

    try {
        const response = await fetch(`https://github-contributions-api.jogruber.de/v4/${username}`);
        const data = await response.json();
        if (data && data.contributions && data.contributions.length > 0) {
            const todayStr = new Date().toISOString().split('T')[0];
            const pastDays = data.contributions
                .filter(x => x.date <= todayStr)
                .sort((a, b) => a.date.localeCompare(b.date));
                
            const recent = pastDays.slice(-364);
            const days = [];
            for (let i = 0; i < recent.length; i++) {
                const c = Math.floor(i / 7);
                const r = i % 7;
                days.push({
                    col: c,
                    row: r,
                    level: Math.min(4, Math.max(0, recent[i].level || 0)),
                    count: recent[i].count || 0,
                    date: recent[i].date
                });
            }
            console.log(`Fetched ${days.length} real contribution days via public API ending today (${todayStr}).`);
            return days;
        }
    } catch (e) {
        console.error("Public API fetch failed:", e.message);
    }

    return null;
}

async function main() {
    const realData = await getRealContributions(USERNAME);

    let cells = [];
    if (realData && realData.length > 0) {
        cells = realData.map(d => ({
            x: PADDING_X + d.col * (CELL_SIZE + GAP),
            y: PADDING_Y + d.row * (CELL_SIZE + GAP),
            level: d.level,
            count: d.count,
            date: d.date,
            col: d.col,
            row: d.row
        }));
    } else {
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
                cells.push({
                    x: PADDING_X + c * (CELL_SIZE + GAP),
                    y: PADDING_Y + r * (CELL_SIZE + GAP),
                    level: (c % 5),
                    count: 1,
                    date: '',
                    col: c,
                    row: r
                });
            }
        }
    }

    const activeCells = cells.filter(c => c.level > 0);

    // Sort active cells strictly by contribution level ascending (Level 1 -> 2 -> 3 -> 4)
    activeCells.sort((a, b) => {
        if (a.level !== b.level) return a.level - b.level;
        if (a.count !== b.count) return a.count - b.count;
        return a.date.localeCompare(b.date);
    });

    const TOTAL_LOOP_TIME = 6.0;
    const WAVE_WINDOW = 2.4;

    const activeCount = activeCells.length;
    const cellDelayMap = new Map();

    activeCells.forEach((cell, idx) => {
        const norm = idx / Math.max(1, activeCount - 1);
        const disappearDelay = (norm * WAVE_WINDOW).toFixed(2);
        const reconstructDelay = (3.0 + norm * WAVE_WINDOW).toFixed(2);
        cellDelayMap.set(`${cell.col}_${cell.row}`, { disappear: disappearDelay, reconstruct: reconstructDelay });
    });

    const cssRules = `
    /* Disappearing and Reconstructing Animation for Contribution Tiles */
    @keyframes cellWashAndBuild {
        0%, 3% { opacity: 1; fill-opacity: 1; }
        /* Low-to-high Disappearing Phase */
        22%, 48% { opacity: 0.15; fill-opacity: 0.15; fill: #161b22; }
        /* Reconstructing Phase */
        68% { opacity: 1; fill-opacity: 1; }
        78%, 100% { opacity: 1; fill-opacity: 1; }
    }

    /* Outward Burst Particles on Disappearing */
    @keyframes pDisappear {
        0%, 2% { opacity: 0; r: 1px; }
        8% { opacity: 1; r: 3px; }
        24%, 100% { opacity: 0; r: 0.5px; }
    }

    /* Inward Energy Particles on Reconstructing */
    @keyframes pReconstruct {
        0%, 50% { opacity: 0; r: 0.5px; }
        62% { opacity: 1; r: 3.5px; }
        72%, 100% { opacity: 0; r: 0.5px; }
    }

    /* Jet Cursor Horizontal Sweep */
    @keyframes jetSweep {
        0% { transform: translate(${PADDING_X}px, ${PADDING_Y + gridHeight / 2}px); }
        45% { transform: translate(${PADDING_X + gridWidth}px, ${PADDING_Y + gridHeight / 2}px); }
        49% { opacity: 0; transform: translate(${PADDING_X + gridWidth}px, ${PADDING_Y + gridHeight / 2}px); }
        50% { opacity: 0; transform: translate(${PADDING_X}px, ${PADDING_Y + gridHeight / 2}px); }
        54% { opacity: 1; }
        95% { transform: translate(${PADDING_X + gridWidth}px, ${PADDING_Y + gridHeight / 2}px); }
        100% { transform: translate(${PADDING_X + gridWidth}px, ${PADDING_Y + gridHeight / 2}px); }
    }

    /* Jet Cursor Vertical Bobbing */
    @keyframes jetBob {
        0%, 100% { transform: translateY(-14px); }
        50% { transform: translateY(14px); }
    }

    @keyframes pulseBadge {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
    }

    .cell {
        animation: cellWashAndBuild ${TOTAL_LOOP_TIME}s ease-in-out infinite;
    }
    .p-out {
        animation: pDisappear ${TOTAL_LOOP_TIME}s ease-out infinite;
    }
    .p-in {
        animation: pReconstruct ${TOTAL_LOOP_TIME}s ease-out infinite;
    }
    .jet-cursor {
        animation: jetSweep ${TOTAL_LOOP_TIME}s ease-in-out infinite;
    }
    .jet-bob {
        animation: jetBob 1.8s ease-in-out infinite;
    }
    .badge-dot {
        animation: pulseBadge 2s ease-in-out infinite;
    }
`;

    let rectElements = '';
    let particleElements = '';

    cells.forEach((cell) => {
        const key = `${cell.col}_${cell.row}`;
        const baseColor = COLORS[cell.level];

        if (cell.level === 0) {
            rectElements += `<rect x="${cell.x}" y="${cell.y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="${RADIUS}" fill="#161b22" stroke="#21262d" stroke-width="0.5"><title>${cell.date}: 0 contributions</title></rect>\n    `;
        } else {
            const delays = cellDelayMap.get(key) || { disappear: '0.00', reconstruct: '3.00' };
            rectElements += `<rect class="cell" x="${cell.x}" y="${cell.y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="${RADIUS}" fill="${baseColor}" style="animation-delay: ${delays.disappear}s;"><title>${cell.date}: ${cell.count} contribution${cell.count === 1 ? '' : 's'} (Level ${cell.level})</title></rect>\n    `;

            const cx = cell.x + CELL_SIZE / 2;
            const cy = cell.y + CELL_SIZE / 2;

            particleElements += `<circle class="p-out" cx="${cx}" cy="${cy}" r="2" fill="${baseColor}" style="animation-delay: ${delays.disappear}s;"/>\n    `;
            particleElements += `<circle class="p-in" cx="${cx}" cy="${cy}" r="2.5" fill="#39d353" style="animation-delay: ${delays.disappear}s;"/>\n    `;
        }
    });

    const totalContribs = cells.reduce((sum, c) => sum + (c.count || 0), 0);

    const svgContent = `<svg width="100%" height="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d1117"/>
      <stop offset="100%" stop-color="#161b22"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <style>
      ${cssRules}
    </style>
  </defs>

  <!-- Container Box -->
  <rect width="${svgWidth}" height="${svgHeight}" rx="12" fill="url(#bgGrad)" stroke="#30363d" stroke-width="1"/>
  
  <!-- Header Bar -->
  <path d="M 0,12 A 12,12 0 0,1 12,0 L ${svgWidth - 12},0 A 12,12 0 0,1 ${svgWidth},12 L ${svgWidth},36 L 0,36 Z" fill="#161b22"/>
  <line x1="0" y1="36" x2="${svgWidth}" y2="36" stroke="#30363d" stroke-width="1"/>

  <!-- Window Dots -->
  <circle cx="20" cy="18" r="4.5" fill="#ff5f56"/>
  <circle cx="34" cy="18" r="4.5" fill="#ffbd2e"/>
  <circle cx="48" cy="18" r="4.5" fill="#27c93f"/>

  <text x="66" y="22" font-family="'Fira Code', 'Segoe UI', monospace" font-size="12" font-weight="600" fill="#8b949e">${USERNAME} ~ ${totalContribs} contributions in past year</text>

  <!-- Status Badge -->
  <g transform="translate(${svgWidth - 135}, 9)">
    <rect width="115" height="18" rx="9" fill="rgba(57, 211, 83, 0.15)" stroke="rgba(57, 211, 83, 0.4)" stroke-width="1"/>
    <circle cx="12" cy="9" r="3.5" fill="#39d353" class="badge-dot"/>
    <text x="22" y="13" font-family="'Fira Code', monospace" font-size="10" font-weight="700" fill="#39d353" letter-spacing="0.5">WASH EFFECT</text>
  </g>

  <!-- Grid Cells -->
  <g>
    ${rectElements}
  </g>

  <!-- Jet Spaceship Cursor Sprite with Laser Thruster -->
  <g class="jet-cursor">
    <g class="jet-bob">
      <!-- Plasma Thruster Trail -->
      <path d="M -6,0 L -22,-3 L -16,0 L -22,3 Z" fill="#39d353" opacity="0.95" filter="url(#glow)">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="0.2s" repeatCount="indefinite"/>
      </path>
      <path d="M 8,0 L -6,-6 L -2,0 L -6,6 Z" fill="#ffffff" filter="url(#glow)"/>
      <circle cx="-4" cy="0" r="2.5" fill="#39d353"/>
    </g>
  </g>

  <!-- Particles Layer -->
  <g>
    ${particleElements}
  </g>

  <!-- Footer Legend -->
  <g transform="translate(${PADDING_X}, ${svgHeight - 12})">
    <text x="0" y="9" font-family="monospace" font-size="10" fill="#8b949e">Less</text>
    <rect x="30" y="0" width="10" height="10" rx="2" fill="#161b22" stroke="#21262d"/>
    <rect x="44" y="0" width="10" height="10" rx="2" fill="#0e4429"/>
    <rect x="58" y="0" width="10" height="10" rx="2" fill="#006d32"/>
    <rect x="72" y="0" width="10" height="10" rx="2" fill="#26a641"/>
    <rect x="86" y="0" width="10" height="10" rx="2" fill="#39d353"/>
    <text x="102" y="9" font-family="monospace" font-size="10" fill="#8b949e">More</text>
  </g>
</svg>`;

    fs.writeFileSync('contribution_wash.svg', svgContent);
    console.log("SVG Generated with Jet Spaceship Cursor, dual particles, and automated GitHub workflow!");
}

main();