const fs = require('fs');

/**
 * Normalizes contribution counts/levels into 52 columns x 7 rows grid data (364 days ending today)
 */
function normalizeContributionDays(rawDays) {
  if (!rawDays || rawDays.length === 0) {
    throw new Error("No raw contribution days provided for normalization.");
  }

  // Take the last 364 days (52 weeks x 7 days)
  const recentDays = rawDays.slice(-364);

  if (recentDays.length < 364) {
    // Pad with empty days if fewer than 364 days available
    const missing = 364 - recentDays.length;
    for (let i = 0; i < missing; i++) {
      recentDays.unshift({ level: 0, count: 0, date: '' });
    }
  }

  const grid = [];
  let totalContributions = 0;

  for (let c = 0; c < 52; c++) {
    const col = [];
    for (let r = 0; r < 7; r++) {
      const idx = c * 7 + r;
      const day = recentDays[idx] || { level: 0, count: 0, date: '' };
      const level = Math.min(4, Math.max(0, parseInt(day.level || 0, 10)));
      const count = parseInt(day.count || 0, 10);

      totalContributions += count;
      col.push({
        col: c,
        row: r,
        level: level,
        count: count,
        date: day.date || `Day ${idx + 1}`
      });
    }
    grid.push(col);
  }

  return { grid, totalContributions };
}

/**
 * Strategy 1: Fetch via GitHub GraphQL API if GITHUB_TOKEN is available
 */
async function fetchViaGraphQL(username, token) {
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'GitHub-Contribution-Wash/1.0'
      },
      body: JSON.stringify({ query }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`GraphQL API returned HTTP status ${response.status}`);
    }

    const json = await response.json();
    if (json.errors && json.errors.length > 0) {
      throw new Error(`GraphQL errors: ${json.errors.map(e => e.message).join(', ')}`);
    }

    const weeks = json?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
    if (!weeks || weeks.length === 0) {
      throw new Error(`No contribution calendar weeks found for user '${username}'`);
    }

    const levelMap = {
      'NONE': 0,
      'FIRST_QUARTILE': 1,
      'SECOND_QUARTILE': 2,
      'THIRD_QUARTILE': 3,
      'FOURTH_QUARTILE': 4
    };

    const rawDays = [];
    const sliceWeeks = weeks.slice(-52);
    for (const week of sliceWeeks) {
      for (const day of week.contributionDays) {
        rawDays.push({
          date: day.date,
          count: day.contributionCount,
          level: levelMap[day.contributionLevel] ?? (day.contributionCount > 0 ? 1 : 0)
        });
      }
    }

    return normalizeContributionDays(rawDays);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Strategy 2: Fetch via Public GitHub Profile Contributions Endpoint HTML Parsing
 */
async function fetchViaProfileHTML(username) {
  const url = `https://github.com/users/${username}/contributions`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`GitHub profile HTML returned HTTP status ${response.status}`);
    }

    const html = await response.text();

    // Map element ID -> tooltip text (exact contribution count)
    const tooltipMap = {};
    const tooltipPattern = /for="([^"]+)"[^>]*>([^<]+)<\/tool-tip>/g;
    for (const match of html.matchAll(tooltipPattern)) {
      const elemId = match[1];
      const text = match[2].trim();
      let count = 0;
      const countMatch = text.match(/^(\d+)\s+contribution/i);
      if (countMatch) {
        count = parseInt(countMatch[1], 10);
      }
      tooltipMap[elemId] = count;
    }

    // Pattern for calendar cells
    const cellPattern = /(?:data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"|data-level="(\d)"[^>]*data-date="(\d{4}-\d{2}-\d{2})")[^>]*id="([^"]+)"/g;
    const matches = [...html.matchAll(cellPattern)];

    const dayMap = {};

    if (matches && matches.length > 0) {
      for (const m of matches) {
        const dateStr = m[1] || m[4];
        const levelStr = m[2] || m[3];
        const elemId = m[5];
        if (dateStr && levelStr) {
          const level = parseInt(levelStr, 10);
          const count = tooltipMap[elemId] !== undefined ? tooltipMap[elemId] : (level * 3);
          dayMap[dateStr] = { level, count };
        }
      }
    } else {
      const simplePattern = /data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"|data-level="(\d)"[^>]*data-date="(\d{4}-\d{2}-\d{2})"/g;
      const simpleMatches = [...html.matchAll(simplePattern)];
      if (!simpleMatches || simpleMatches.length === 0) {
        throw new Error(`Could not parse contribution days from profile HTML for '${username}'`);
      }
      for (const m of simpleMatches) {
        const dateStr = m[1] || m[4];
        const levelStr = m[2] || m[3];
        if (dateStr && levelStr) {
          const level = parseInt(levelStr, 10);
          dayMap[dateStr] = { level, count: level * 3 };
        }
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const sortedDates = Object.keys(dayMap).filter(d => d <= todayStr).sort();
    const rawDays = sortedDates.map(d => ({
      date: d,
      level: dayMap[d].level,
      count: dayMap[d].count
    }));

    return normalizeContributionDays(rawDays);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Strategy 3: Fetch via public jogruber.de REST API
 */
async function fetchViaPublicAPI(username) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`https://github-contributions-api.jogruber.de/v4/${username}`, {
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Public API returned HTTP status ${response.status}`);
    }

    const data = await response.json();
    if (!data || !data.contributions || data.contributions.length === 0) {
      throw new Error(`No contribution data returned from public API for user '${username}'`);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const sortedContributions = [...data.contributions]
      .filter(item => item.date <= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));

    const rawDays = sortedContributions.map(item => ({
      date: item.date,
      count: item.count || 0,
      level: item.level || 0
    }));

    return normalizeContributionDays(rawDays);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Strategy 4: Fallback fetch via public GitHub user events API stream
 */
async function fetchViaUserEvents(username) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`https://api.github.com/users/${username}/events/public`, {
      headers: {
        'User-Agent': 'GitHub-Contribution-Wash/1.0',
        'Accept': 'application/vnd.github.v3+json'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`GitHub events API returned HTTP status ${response.status}`);
    }

    const events = await response.json();
    const eventCountsByDate = {};

    if (Array.isArray(events)) {
      for (const event of events) {
        if (event.created_at) {
          const dateStr = event.created_at.split('T')[0];
          eventCountsByDate[dateStr] = (eventCountsByDate[dateStr] || 0) + 1;
        }
      }
    }

    const rawDays = [];
    const today = new Date();
    for (let i = 363; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = eventCountsByDate[dateStr] || 0;
      let level = 0;
      if (count > 0) level = 1;
      if (count >= 3) level = 2;
      if (count >= 6) level = 3;
      if (count >= 10) level = 4;
      rawDays.push({ date: dateStr, count, level });
    }

    return normalizeContributionDays(rawDays);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Main Data Fetcher
 * Tries GraphQL first if GITHUB_TOKEN is available, then profile HTML, then Public REST API, then User Events API.
 */
async function getGitHubContributions(usernameOverride) {
  const username = usernameOverride || process.env.GITHUB_USERNAME || process.env.GH_USERNAME || 'ChinmayGawad';
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  console.log(`[GitHub Contributions] Fetching real data for user '${username}'...`);

  if (token) {
    try {
      console.log(`[GitHub Contributions] Attempting GraphQL API fetch with token...`);
      const result = await fetchViaGraphQL(username, token);
      console.log(`[GitHub Contributions] Successfully fetched ${result.totalContributions} total contributions via GraphQL API.`);
      return result;
    } catch (e) {
      console.warn(`[GitHub Contributions] GraphQL fetch failed: ${e.message}. Trying profile HTML parsing...`);
    }
  }

  try {
    console.log(`[GitHub Contributions] Attempting live profile HTML fetch...`);
    const result = await fetchViaProfileHTML(username);
    console.log(`[GitHub Contributions] Successfully fetched ${result.totalContributions} total contributions via Profile HTML.`);
    return result;
  } catch (e) {
    console.warn(`[GitHub Contributions] Profile HTML fetch failed: ${e.message}. Trying public REST API...`);
  }

  try {
    console.log(`[GitHub Contributions] Attempting public REST API fetch...`);
    const result = await fetchViaPublicAPI(username);
    console.log(`[GitHub Contributions] Successfully fetched ${result.totalContributions} total contributions via Public API.`);
    return result;
  } catch (e) {
    console.warn(`[GitHub Contributions] Public REST API fetch failed: ${e.message}. Trying GitHub public events stream...`);
  }

  try {
    console.log(`[GitHub Contributions] Attempting public user events fetch...`);
    const result = await fetchViaUserEvents(username);
    console.log(`[GitHub Contributions] Successfully fetched ${result.totalContributions} total contributions via Events API.`);
    return result;
  } catch (e) {
    console.error(`[GitHub Contributions] ERROR: All contribution data fetch attempts failed for user '${username}': ${e.message}`);
    throw new Error(`Failed to retrieve GitHub contributions for user '${username}'. Please verify the username and internet connection.`);
  }
}

module.exports = {
  getGitHubContributions,
  normalizeContributionDays,
  fetchViaGraphQL,
  fetchViaProfileHTML,
  fetchViaPublicAPI,
  fetchViaUserEvents
};

