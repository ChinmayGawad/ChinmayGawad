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

  for (let w = 52; w >= 0; w--) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const dayOffset = (w * 7) + (6 - d);
      const date = new Date(today);
      date.setDate(today.getDate() - dayOffset);

      const seed = Math.sin(w * 7 + d * 13 + 42) * 10000;
      const rand = seed - Math.floor(seed);
      let count = 0;
      if (rand > 0.35) {
        count = Math.floor(rand * 12) + 1;
      }

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

// Month names generator
function getMonthLabels(weeks) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const labels = [];
  let lastMonth = -1;

  weeks.forEach((week, wIndex) => {
    if (week.contributionDays && week.contributionDays.length > 0) {
      const firstDay = week.contributionDays[0];
      const d = new Date(firstDay.date);
      const m = d.getMonth();
      if (m !== lastMonth && wIndex < 50) {
        labels.push({ text: months[m], x: 65 + wIndex * 13.5 });
        lastMonth = m;
      }
    }
  });

  return labels;
}

// Generate animated SVG with sweeping laser jet eraser effect
function generateSVG(data, theme = 'dark') {
  const isDark = theme === 'dark';

  const colors = isDark ? {
    bg: '#090d16',
    cardBg: '#0d1117',
    border: '#30363d',
    textMain: '#f0f6fc',
    textMuted: '#8b949e',
    gridEmpty: '#161b22',
    levels: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
    laserCore: '#00FF66',
    laserGlow: 'rgba(0, 255, 102, 0.85)',
    headerBadgeBg: 'rgba(0, 255, 102, 0.12)',
    headerBadgeBorder: 'rgba(0, 255, 102, 0.4)',
    headerBadgeText: '#00FF66'
  } : {
    bg: '#ffffff',
    cardBg: '#f6f8fa',
    border: '#d0d7de',
    textMain: '#1F2328',
    textMuted: '#656d76',
    gridEmpty: '#ebedf0',
    levels: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    laserCore: '#216e39',
    laserGlow: 'rgba(33, 110, 57, 0.85)',
    headerBadgeBg: 'rgba(33, 110, 57, 0.1)',
    headerBadgeBorder: 'rgba(33, 110, 57, 0.3)',
    headerBadgeText: '#216e39'
  };

  const svgWidth = 880;
  const svgHeight = 240;
  const gridStartX = 65;
  const gridStartY = 85;
  const tileSize = 10;
  const tileStep = 13.5;

  const weeks = data.weeks || [];
  const monthLabels = getMonthLabels(weeks);

  let emptyTilesHTML = '';
  let activeTilesHTML = '';
  let activeTileCount = 0;

  weeks.forEach((week, wIndex) => {
    const x = gridStartX + (wIndex * tileStep);
    (week.contributionDays || []).forEach((day) => {
      const y = gridStartY + (day.weekday * tileStep);
      const lvl = getLevel(day.contributionCount);

      // Base layer empty dark tile
      emptyTilesHTML += `      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${tileSize}" height="${tileSize}" rx="2.5" fill="${colors.gridEmpty}" />\n`;

      // Top layer active green tile
      if (lvl > 0) {
        activeTileCount++;
        const tileColor = colors.levels[lvl];
        activeTilesHTML += `      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${tileSize}" height="${tileSize}" rx="2.5" fill="${tileColor}" />\n`;
      }
    });
  });

  // Render Month Labels
  let monthsHTML = monthLabels.map(m =>
    `<text x="${m.x.toFixed(1)}" y="72" font-family="'Fira Code', 'Courier New', monospace" font-size="10" fill="${colors.textMuted}">${m.text}</text>`
  ).join('\n    ');

  // Render Weekday Labels (Mon, Wed, Fri)
  const weekdays = [
    { name: 'Mon', y: gridStartY + 1 * tileStep + 8 },
    { name: 'Wed', y: gridStartY + 3 * tileStep + 8 },
    { name: 'Fri', y: gridStartY + 5 * tileStep + 8 }
  ];
  let weekdaysHTML = weekdays.map(w =>
    `<text x="35" y="${w.y.toFixed(1)}" font-family="'Fira Code', 'Courier New', monospace" font-size="10" fill="${colors.textMuted}">${w.name}</text>`
  ).join('\n    ');

  const totalGridWidth = weeks.length * tileStep;
  const beamStartX = gridStartX - 6;
  const beamEndX = gridStartX + totalGridWidth + 6;

  // Calculate statistics
  let activeDays = activeTileCount;
  let currentStreak = 0;
  let tempStreak = 0;
  weeks.forEach(w => {
    (w.contributionDays || []).forEach(d => {
      if (d.contributionCount > 0) {
        tempStreak++;
        if (tempStreak > currentStreak) currentStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%">
  <defs>
    <style>
      @keyframes wipe-mask {
        0% {
          transform: translateX(${beamStartX}px);
        }
        5% {
          transform: translateX(${beamStartX}px);
        }
        75% {
          transform: translateX(${beamEndX}px);
        }
        82% {
          transform: translateX(${beamEndX}px);
        }
        100% {
          transform: translateX(${beamStartX}px);
        }
      }

      @keyframes laser-sweep {
        0% {
          transform: translateX(${beamStartX}px);
          opacity: 0;
        }
        4% {
          transform: translateX(${beamStartX}px);
          opacity: 1;
        }
        75% {
          transform: translateX(${beamEndX}px);
          opacity: 1;
        }
        80% {
          transform: translateX(${beamEndX}px);
          opacity: 0;
        }
        100% {
          transform: translateX(${beamStartX}px);
          opacity: 0;
        }
      }

      @keyframes badge-pulse {
        0%, 100% { opacity: 0.85; }
        50% { opacity: 1; }
      }

      .laser-beam-group {
        animation: laser-sweep 7.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }

      .clip-reveal-rect {
        animation: wipe-mask 7.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }

      .badge-text {
        animation: badge-pulse 2s ease-in-out infinite;
      }
    </style>

    <!-- Clip Path for Laser Jet Eraser Wipe -->
    <clipPath id="laser-eraser-clip-${theme}">
      <!-- Revealed active green tiles lie strictly ahead of the laser beam line -->
      <rect class="clip-reveal-rect" x="0" y="60" width="${svgWidth}" height="140" />
    </clipPath>

    <!-- Laser Beam Glow Filter -->
    <filter id="laser-glow-${theme}" x="-100%" y="-20%" width="300%" height="140%">
      <feGaussianBlur stdDeviation="3.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <!-- Laser Beam Gradient -->
    <linearGradient id="laser-grad-${theme}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${colors.laserCore}" stop-opacity="0.1" />
      <stop offset="50%" stop-color="${colors.laserCore}" stop-opacity="1" />
      <stop offset="100%" stop-color="${colors.laserCore}" stop-opacity="0.1" />
    </linearGradient>
  </defs>

  <!-- Outer Card Container -->
  <rect x="2" y="2" width="${svgWidth - 4}" height="${svgHeight - 4}" rx="12" fill="${colors.cardBg}" stroke="${colors.border}" stroke-width="1.5" />

  <!-- Terminal Title Bar Header -->
  <g transform="translate(20, 24)">
    <!-- Window Controls -->
    <circle cx="0" cy="0" r="5" fill="#ff5f56" />
    <circle cx="15" cy="0" r="5" fill="#ffbd2e" />
    <circle cx="30" cy="0" r="5" fill="#27c93f" />

    <!-- Terminal Title -->
    <text x="50" y="4" font-family="'Fira Code', 'Courier New', monospace" font-size="12" font-weight="600" fill="${colors.textMain}">⚡ MATRIX LASER JET ERASER</text>

    <!-- Header Status Badge -->
    <g transform="translate(${svgWidth - 370}, -10)">
      <rect x="0" y="0" width="320" height="22" rx="11" fill="${colors.headerBadgeBg}" stroke="${colors.headerBadgeBorder}" stroke-width="1" />
      <circle cx="12" cy="11" r="3.5" fill="${colors.headerBadgeText}" class="badge-text" />
      <text x="24" y="15" font-family="'Fira Code', 'Courier New', monospace" font-size="10" font-weight="600" fill="${colors.headerBadgeText}" class="badge-text">[STATUS: LASER ERASER SWEEP ACTIVE]</text>
    </g>
  </g>

  <!-- Divider Line -->
  <line x1="15" y1="45" x2="${svgWidth - 15}" y2="45" stroke="${colors.border}" stroke-width="1" stroke-dasharray="4 4" />

  <!-- Month & Weekday Labels -->
  <g>
    ${monthsHTML}
    ${weekdaysHTML}
  </g>

  <!-- BASE LAYER: Empty Dark Contribution Grid -->
  <g id="base-empty-grid">
${emptyTilesHTML}  </g>

  <!-- TOP LAYER: Real GitHub Green Contribution Tiles (Clipped by Sweeping Laser Mask) -->
  <g id="active-contribution-grid" clip-path="url(#laser-eraser-clip-${theme})">
${activeTilesHTML}  </g>

  <!-- SWEEPING LASER JET ERASER BEAM -->
  <g class="laser-beam-group" filter="url(#laser-glow-${theme})">
    <!-- Laser Beam Bar -->
    <rect x="-2" y="${gridStartY - 10}" width="4" height="${7 * tileStep + 15}" fill="url(#laser-grad-${theme})" />
    <!-- Front Bright Edge Line -->
    <rect x="-4" y="${gridStartY - 10}" width="2" height="${7 * tileStep + 15}" fill="${colors.laserCore}" opacity="0.9" />

    <!-- Top Laser Energy Node -->
    <circle cx="0" cy="${gridStartY - 10}" r="4" fill="${colors.laserCore}" />
    <!-- Bottom Laser Energy Node -->
    <circle cx="0" cy="${gridStartY + 7 * tileStep + 5}" r="4" fill="${colors.laserCore}" />
  </g>

  <!-- FOOTER DIAGNOSTICS & LEGEND -->
  <g transform="translate(35, ${svgHeight - 20})">
    <!-- Stats Text -->
    <text x="0" y="0" font-family="'Fira Code', 'Courier New', monospace" font-size="10" fill="${colors.textMuted}">
      Total: <tspan fill="${colors.textMain}" font-weight="600">${data.totalContributions.toLocaleString()} commits</tspan>  |  Active Days: <tspan fill="${colors.textMain}" font-weight="600">${activeDays}</tspan>  |  Max Streak: <tspan fill="${colors.textMain}" font-weight="600">${currentStreak} days</tspan>
    </text>

    <!-- Contribution Level Legend -->
    <g transform="translate(${svgWidth - 210}, -8)">
      <text x="-32" y="9" font-family="'Fira Code', 'Courier New', monospace" font-size="9" fill="${colors.textMuted}">Less</text>
      <rect x="0" y="0" width="10" height="10" rx="2" fill="${colors.levels[0]}" />
      <rect x="13" y="0" width="10" height="10" rx="2" fill="${colors.levels[1]}" />
      <rect x="26" y="0" width="10" height="10" rx="2" fill="${colors.levels[2]}" />
      <rect x="39" y="0" width="10" height="10" rx="2" fill="${colors.levels[3]}" />
      <rect x="52" y="0" width="10" height="10" rx="2" fill="${colors.levels[4]}" />
      <text x="68" y="9" font-family="'Fira Code', 'Courier New', monospace" font-size="9" fill="${colors.textMuted}">More</text>
    </g>
  </g>
</svg>`;
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
