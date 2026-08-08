const fs = require('fs');
const path = require('path');

const USERNAME = process.env.GH_USERNAME || 'ChinmayGawad';
const COLS = 34; // 34 weeks matching reference jet design
const ROWS = 7;
const CELL = 12;
const STEP = 15; // cell + gap
const GRID_X = 310;
const GRID_Y = 410;
const LOOP_DUR = 16; // seconds for full pass
const MAX_TARGETS = 12;

const FLASH_COLOR = '#00FF66';
const BULLET_COLOR = '#7ee787';
const BLAST_COLOR = '#39d353';
const PAD_Y = 550; // Jet flight altitude

const JET_X_START = GRID_X + 15;
const JET_X_END = GRID_X + (COLS - 1) * STEP - 15;

const svgWidth = 1180;
const svgHeight = 620;

const COLORS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];

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
                        color
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
                console.log(`Fetched real contribution calendar via GraphQL API.`);
                return weeks;
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
                
            const recent = pastDays.slice(-238); // 34 weeks * 7 days
            const weeks = [];
            for (let w = 0; w < COLS; w++) {
                const contributionDays = [];
                for (let d = 0; d < ROWS; d++) {
                    const idx = w * 7 + d;
                    const item = recent[idx] || { count: 0, level: 0, date: '' };
                    contributionDays.push({
                        date: item.date,
                        contributionCount: item.count || 0,
                        color: COLORS[Math.min(4, Math.max(0, item.level || 0))]
                    });
                }
                weeks.push({ contributionDays });
            }
            console.log(`Fetched real contribution calendar via public API.`);
            return weeks;
        }
    } catch (e) {
        console.error("Public API fetch failed:", e.message);
    }

    return null;
}

function buildCells(weeks) {
    let recent = weeks ? weeks.slice(-COLS) : [];
    const padCount = COLS - recent.length;
    const padded = Array.from({ length: Math.max(0, padCount) }, () => ({
        contributionDays: Array.from({ length: ROWS }, () => ({
            contributionCount: 0,
            color: '#161b22',
            date: null,
        })),
    })).concat(recent);

    const cells = [];
    padded.forEach((week, col) => {
        week.contributionDays.forEach((day, row) => {
            cells.push({
                col,
                row,
                x: GRID_X + col * STEP,
                y: GRID_Y + row * STEP,
                color: day.color || '#161b22',
                count: day.contributionCount || 0,
                date: day.date,
            });
        });
    });
    return cells;
}

function pickTargets(cells) {
    return [...cells]
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_TARGETS)
        .sort((a, b) => a.col - b.col || a.row - b.row);
}

function keyTimeForCol(col, direction) {
    const span = 0.44;
    const t = 0.03 + (col / (COLS - 1)) * span;
    return direction === 'forward' ? t : 1.0 - t;
}

function fmt(n) {
    return Number(n.toFixed(4));
}

function buildGrid(cells, targets) {
    const targetKey = new Set(targets.map((t) => `${t.col}-${t.row}`));
    let svg = '';
    for (const c of cells) {
        const isTarget = targetKey.has(`${c.col}-${c.row}`);
        if (!isTarget) {
            svg += `<rect x="${c.x.toFixed(2)}" y="${c.y.toFixed(2)}" width="${CELL}" height="${CELL}" rx="2" ry="2" fill="${c.color}"><title>${c.date || ''}: ${c.count} contributions</title></rect>\n`;
            continue;
        }
        const tFwd = keyTimeForCol(c.col, 'forward');
        const tBack = keyTimeForCol(c.col, 'backward');
        const [t1, t2] = [Math.min(tFwd, tBack), Math.max(tFwd, tBack)];
        const dur = 0.006;
        svg += `<rect x="${c.x.toFixed(2)}" y="${c.y.toFixed(2)}" width="${CELL}" height="${CELL}" rx="2" ry="2" fill="${c.color}">` +
            `<animate attributeName="fill" dur="${LOOP_DUR}s" repeatCount="indefinite" ` +
            `keyTimes="0;${fmt(t1)};${fmt(t1 + dur)};${fmt(t2)};${fmt(t2 + dur)};1" ` +
            `values="${c.color};${c.color};${FLASH_COLOR};${c.color};${FLASH_COLOR};${c.color}"/>` +
            `<title>${c.date || ''}: ${c.count} contributions (TARGET)</title></rect>\n`;
        
        // Target ring overlay on busiest tiles
        const cx = fmt(c.x + CELL / 2);
        const cy = fmt(c.y + CELL / 2);
        svg += `<circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="#00FF66" stroke-width="1.2" opacity="0.85"/>\n`;
        svg += `<circle cx="${cx}" cy="${cy}" r="2" fill="#00FF66"/>\n`;
    }
    return svg;
}

function buildBulletsAndBlasts(targets) {
    let bullets = '';
    let blasts = '';
    const dur = 0.006;

    for (const dir of ['forward', 'backward']) {
        const ordered = dir === 'forward' ? targets : [...targets].reverse();
        for (const c of ordered) {
            const t = keyTimeForCol(c.col, dir);
            const rise = t - dur * 3;
            const arrive = t;
            const fadeEnd = t + dur;
            const cx = fmt(c.x + CELL / 2);
            const targetY = fmt(c.y + CELL / 2);

            bullets += `<circle cx="${cx}" cy="${PAD_Y}" r="2.5" fill="${BULLET_COLOR}">` +
                `<animate attributeName="cy" dur="${LOOP_DUR}s" repeatCount="indefinite" ` +
                `keyTimes="0;${fmt(rise)};${fmt(arrive)};1" values="${PAD_Y};${PAD_Y};${targetY};${targetY}"/>` +
                `<animate attributeName="opacity" dur="${LOOP_DUR}s" repeatCount="indefinite" ` +
                `keyTimes="0;${fmt(rise)};${fmt(arrive)};${fmt(fadeEnd)};1" values="0;1;1;0;0"/>` +
                `</circle>\n`;

            blasts += `<circle cx="${cx}" cy="${targetY}" r="0" fill="none" stroke="${BLAST_COLOR}" stroke-width="1.6" opacity="0">` +
                `<animate attributeName="r" dur="${LOOP_DUR}s" repeatCount="indefinite" ` +
                `keyTimes="0;${fmt(arrive)};${fmt(arrive + dur * 3)};1" values="0;1;9;9"/>` +
                `<animate attributeName="opacity" dur="${LOOP_DUR}s" repeatCount="indefinite" ` +
                `keyTimes="0;${fmt(arrive)};${fmt(arrive + dur * 3)};1" values="0;1;1;0"/>` +
                `</circle>\n`;
        }
    }
    return { bullets, blasts };
}

function buildJet() {
    return `<g id="jet">
    <g transform="translate(0,0)">
      <!-- Jet Rocket Spacecraft Sprite -->
      <polygon points="0,-16 8,6 4,3 -4,3 -8,6" fill="#388bfd" stroke="#1f6feb" stroke-width="1.2"/>
      <polygon points="-8,6 -14,12 -4,7" fill="#2563eb"/>
      <polygon points="8,6 14,12 4,7" fill="#2563eb"/>
      <circle cx="0" cy="-5" r="2.5" fill="#c9e6ff"/>
      <!-- Orange Plasma Engine Thruster -->
      <polygon points="-3,7 3,7 0,16" fill="#f0883e">
        <animate attributeName="opacity" values="0.5;1;0.6;1" dur="0.18s" repeatCount="indefinite"/>
      </polygon>
    </g>
    <animateTransform attributeName="transform" attributeType="XML" type="translate"
      dur="${LOOP_DUR}s" repeatCount="indefinite"
      keyTimes="0;0.5;1"
      values="${JET_X_START}.00,${PAD_Y}.00;${JET_X_END}.00,${PAD_Y}.00;${JET_X_START}.00,${PAD_Y}.00"/>
  </g>`;
}

async function main() {
    let avatarB64 = '';
    try {
        if (fs.existsSync('./assets/avatar_b64.txt')) {
            avatarB64 = fs.readFileSync('./assets/avatar_b64.txt', 'utf8').trim();
        }
    } catch (e) {
        console.warn("Could not read avatar_b64.txt:", e.message);
    }

    const weeks = await getRealContributions(USERNAME);
    const cells = buildCells(weeks);
    const targets = pickTargets(cells);
    const { bullets, blasts } = buildBulletsAndBlasts(targets);
    const totalContribs = cells.reduce((sum, c) => sum + (c.count || 0), 0);

    const cssRules = `
    @keyframes pulseBadge {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
    }
    .badge-dot { animation: pulseBadge 2s ease-in-out infinite; }
    .label-key { font-family: 'Fira Code', monospace; fill: #38BDF8; font-weight: 600; }
    .label-val { font-family: 'Fira Code', monospace; fill: #E2E8F0; }
    .accent-val { font-family: 'Fira Code', monospace; fill: #00FF66; font-weight: 700; }
`;

    const svgContent = `<svg width="100%" height="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#0d1117"/>
      <stop offset="100%" stop-color="#050816"/>
    </radialGradient>
    <linearGradient id="neonBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00FF66"/>
      <stop offset="50%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#7C3AED"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <clipPath id="avatar-clip">
      <circle cx="120" cy="185" r="70" />
    </clipPath>
    <style>
      ${cssRules}
    </style>
  </defs>

  <!-- Container Frame -->
  <rect width="${svgWidth}" height="${svgHeight}" rx="12" fill="url(#bgGlow)" stroke="url(#neonBorder)" stroke-width="1.5"/>

  <!-- Top Header Bar -->
  <path d="M 0,12 A 12,12 0 0,1 12,0 L ${svgWidth - 12},0 A 12,12 0 0,1 ${svgWidth},12 L ${svgWidth},38 L 0,38 Z" fill="#161b22"/>
  <line x1="0" y1="38" x2="${svgWidth}" y2="38" stroke="#30363d" stroke-width="1"/>

  <!-- macOS Control Buttons -->
  <circle cx="24" cy="19" r="5" fill="#ff5f56"/>
  <circle cx="40" cy="19" r="5" fill="#ffbd2e"/>
  <circle cx="56" cy="19" r="5" fill="#27c93f"/>

  <!-- Terminal Title -->
  <text x="78" y="23" font-family="'Fira Code', monospace" font-size="12" font-weight="600" fill="#8b949e">chinmay@devos ~ % ./profile.sh --live</text>

  <!-- Status Live Badge -->
  <g transform="translate(${svgWidth - 140}, 10)">
    <rect width="120" height="18" rx="9" fill="rgba(0, 255, 102, 0.12)" stroke="rgba(0, 255, 102, 0.4)" stroke-width="1"/>
    <circle cx="12" cy="9" r="3.5" fill="#00FF66" class="badge-dot"/>
    <text x="22" y="13" font-family="'Fira Code', monospace" font-size="10" font-weight="700" fill="#00FF66" letter-spacing="0.5">SCANNING OK</text>
  </g>

  <!-- PANEL 1: VISUAL MAP (LEFT SIDE) -->
  <g transform="translate(24, 54)">
    <rect width="220" height="310" rx="8" fill="#161b22" stroke="#30363d" stroke-width="1"/>
    <text x="14" y="24" font-family="'Fira Code', monospace" font-size="11" font-weight="700" fill="#38BDF8" letter-spacing="1">VISUAL.MAP</text>
    <line x1="14" y1="32" x2="206" y2="32" stroke="#30363d" stroke-width="1"/>

    <!-- Avatar Image & Neon Ring -->
    <circle cx="110" cy="130" r="62" fill="none" stroke="#00FF66" stroke-width="2.5" filter="url(#glow)"/>
    ${avatarB64 ? `<image href="data:image/png;base64,${avatarB64}" x="48" y="68" width="124" height="124" clip-path="url(#avatar-clip)" />` : ''}

    <text x="110" y="222" font-family="'Fira Code', monospace" font-size="12" font-weight="700" fill="#00FF66" text-anchor="middle">Chinmay Gawad</text>
    <text x="110" y="242" font-family="'Fira Code', monospace" font-size="10" fill="#8b949e" text-anchor="middle">SYSTEM ID: CG-9042</text>
    <text x="110" y="260" font-family="'Fira Code', monospace" font-size="10" fill="#38BDF8" text-anchor="middle">STATUS: ONLINE / ACTIVE</text>
    <rect x="24" y="278" width="172" height="18" rx="4" fill="rgba(56, 189, 248, 0.1)" stroke="rgba(56, 189, 248, 0.3)" stroke-width="1"/>
    <text x="110" y="291" font-family="'Fira Code', monospace" font-size="9" font-weight="700" fill="#38BDF8" text-anchor="middle">AI/ML &amp; Android Dev</text>
  </g>

  <!-- PANEL 2: SYSTEM DIAGNOSTICS & INFO (RIGHT SIDE) -->
  <g transform="translate(260, 54)">
    <rect width="896" height="310" rx="8" fill="#161b22" stroke="#30363d" stroke-width="1"/>
    <text x="18" y="24" font-family="'Fira Code', monospace" font-size="11" font-weight="700" fill="#38BDF8" letter-spacing="1">SYSTEM.INFO</text>
    <line x1="18" y1="32" x2="878" y2="32" stroke="#30363d" stroke-width="1"/>

    <text x="24" y="58" class="label-key">. Subject<tspan fill="#8b949e">: ............................. </tspan><tspan class="accent-val">Chinmay Gawad</tspan></text>
    <text x="24" y="82" class="label-key">. Role<tspan fill="#8b949e">: ................................ </tspan><tspan class="label-val">Android Developer | AI/ML Engineer</tspan></text>
    <text x="24" y="106" class="label-key">. Education<tspan fill="#8b949e">: ........................... </tspan><tspan class="label-val">B.E. Computer Engineering Student</tspan></text>
    <text x="24" y="130" class="label-key">. Status<tspan fill="#8b949e">: .............................. </tspan><tspan class="label-val">Building Scalable &amp; Intelligent Systems</tspan></text>
    <text x="24" y="154" class="label-key">. ToolChain<tspan fill="#8b949e">: ........................... </tspan><tspan class="label-val">Android Studio, VS Code, Git, Firebase, Linux</tspan></text>
    
    <line x1="24" y1="168" x2="872" y2="168" stroke="#21262d" stroke-width="1"/>

    <text x="24" y="192" class="label-key">. Core.Lang<tspan fill="#8b949e">: ........................... </tspan><tspan class="accent-val">Kotlin, Python, Java, C, C#, SQL</tspan></text>
    <text x="24" y="216" class="label-key">. Core.AI_ML<tspan fill="#8b949e">: .......................... </tspan><tspan class="label-val">TensorFlow, YOLOv8, FastAPI, Scikit-Learn</tspan></text>
    <text x="24" y="240" class="label-key">. Core.Mobile_Tools<tspan fill="#8b949e">: .................... </tspan><tspan class="label-val">Jetpack Compose, Android Studio, Firebase</tspan></text>
    <text x="24" y="264" class="label-key">. Core.Systems<tspan fill="#8b949e">: ......................... </tspan><tspan class="label-val">Cybersecurity, Custom Linux Kernel, Deep Learning</tspan></text>

    <line x1="24" y1="278" x2="872" y2="278" stroke="#21262d" stroke-width="1"/>

    <text x="24" y="296" class="label-key">. Grid.Contact<tspan fill="#8b949e">: ......................... </tspan><tspan class="accent-val">chinmaygawad365@gmail.com | LinkedIn | Portfolio</tspan></text>
  </g>

  <!-- PANEL 3: CONTRIBUTION MATRIX (BOTTOM SIDE) -->
  <g transform="translate(24, 380)">
    <rect width="1132" height="216" rx="8" fill="#161b22" stroke="#30363d" stroke-width="1"/>
    <text x="18" y="24" font-family="'Fira Code', monospace" font-size="11" font-weight="700" fill="#38BDF8" letter-spacing="1">CONTRIBUTION.MATRIX</text>
    <text x="180" y="24" font-family="'Fira Code', monospace" font-size="11" font-weight="600" fill="#8b949e">(${USERNAME} ~ ${totalContribs} contributions in past year)</text>
    <line x1="18" y1="32" x2="1114" y2="32" stroke="#30363d" stroke-width="1"/>

    <!-- Status Badge -->
    <g transform="translate(980, 8)">
      <rect width="130" height="18" rx="9" fill="rgba(57, 211, 83, 0.15)" stroke="rgba(57, 211, 83, 0.4)" stroke-width="1"/>
      <circle cx="12" cy="9" r="3.5" fill="#39d353" class="badge-dot"/>
      <text x="22" y="13" font-family="'Fira Code', monospace" font-size="10" font-weight="700" fill="#39d353" letter-spacing="0.5">JET HEATMAP</text>
    </g>

    <!-- Grid Cells -->
    <g id="grid">
      ${buildGrid(cells, targets)}
    </g>

    <!-- Bullets Layer -->
    <g id="bullets">
      ${bullets}
    </g>

    <!-- Blasts Layer -->
    <g id="blasts">
      ${blasts}
    </g>

    <!-- Jet Spaceship Sprite -->
    ${buildJet()}

    <!-- Footer Legend -->
    <g transform="translate(20, 192)">
      <text x="0" y="9" font-family="monospace" font-size="10" fill="#8b949e">Less</text>
      <rect x="30" y="0" width="10" height="10" rx="2" fill="#161b22" stroke="#21262d"/>
      <rect x="44" y="0" width="10" height="10" rx="2" fill="#0e4429"/>
      <rect x="58" y="0" width="10" height="10" rx="2" fill="#006d32"/>
      <rect x="72" y="0" width="10" height="10" rx="2" fill="#26a641"/>
      <rect x="86" y="0" width="10" height="10" rx="2" fill="#39d353"/>
      <text x="102" y="9" font-family="monospace" font-size="10" fill="#8b949e">More</text>
    </g>
  </g>
</svg>`;

    fs.writeFileSync('dark.svg', svgContent);
    fs.writeFileSync('light.svg', svgContent);
    fs.writeFileSync('contribution_wash.svg', svgContent);
    console.log("Master Jet Heatmap Dashboard SVG generated successfully!");
}

main().catch(console.error);