const fs = require('fs');
const path = require('path');
const https = require('https');

const USERNAME = process.env.GITHUB_USERNAME || 'ChinmayGawad';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

const distDir = path.join(__dirname, '..', 'dist');
const assetsDir = path.join(__dirname, '..', 'assets');
[distDir, assetsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

async function fetchContributions(username, token) {
  if (!token) {
    console.log('No GITHUB_TOKEN. Using fallback data.');
    return generateFallbackData();
  }
  const query = JSON.stringify({
    query: `query($u:String!){user(login:$u){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{contributionCount date weekday}}}}}}`,
    variables: { u: username }
  });
  const opts = {
    hostname: 'api.github.com', path: '/graphql', method: 'POST',
    headers: { 'Authorization': `bearer ${token}`, 'User-Agent': 'eraser-gen', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(query) }
  };
  return new Promise(resolve => {
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j.data?.user?.contributionsCollection) {
            const cal = j.data.user.contributionsCollection.contributionCalendar;
            resolve({ weeks: cal.weeks });
          } else resolve(generateFallbackData());
        } catch(e) { resolve(generateFallbackData()); }
      });
    });
    req.on('error', () => resolve(generateFallbackData()));
    req.write(query); req.end();
  });
}

function generateFallbackData() {
  const weeks = [];
  for (let w = 51; w >= 0; w--) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const c = 51 - w, r = d;
      const seed = Math.sin(c * 7 + r * 13 + 42) * 10000;
      const rand = seed - Math.floor(seed);
      let count = 0;
      if (rand > 0.35) count = 1;
      if (rand > 0.60) count = 3;
      if (rand > 0.80) count = 6;
      if (rand > 0.92) count = 10;
      days.push({ contributionCount: count, weekday: d });
    }
    weeks.push({ contributionDays: days });
  }
  return { weeks: weeks.reverse() };
}

function getLevel(count) {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  return 4;
}

function generateSVG(data, theme) {
  const isDark = theme === 'dark';
  const C = isDark ? {
    card:'#161b22', brd:'#30363d', txt:'#c9d1d9', lbl:'#8b949e',
    empty:'#161b22', eStk:'#21262d',
    lv:['#161b22','#0e4429','#006d32','#26a641','#39d353'],
    wash:'#39d353', washBg:'rgba(57,211,83,0.15)', washBdr:'rgba(57,211,83,0.3)',
    reb:'#58a6ff', rebBg:'rgba(88,166,255,0.15)', rebBdr:'rgba(88,166,255,0.3)',
    jet:'#fff', visor:'#0d1117'
  } : {
    card:'#fff', brd:'#d0d7de', txt:'#1f2328', lbl:'#656d76',
    empty:'#ebedf0', eStk:'#d0d7de',
    lv:['#ebedf0','#9be9a8','#40c463','#30a14e','#216e39'],
    wash:'#216e39', washBg:'rgba(33,110,57,0.15)', washBdr:'rgba(33,110,57,0.3)',
    reb:'#0969da', rebBg:'rgba(9,105,218,0.15)', rebBdr:'rgba(9,105,218,0.3)',
    jet:'#1f2328', visor:'#f0f6ff'
  };

  // preview.html exact constants
  const COLS=52, ROWS=7, SZ=12, GAP=4, RR=2.5;
  const step = SZ+GAP; // 16
  const OL=30, OT=22;
  const mW = COLS*step+GAP; // 836
  const mH = ROWS*step+GAP; // 116
  const tW = mW+OL; // 866

  // SVG card layout
  const PAD=28, HDR=50, FTR=36;
  const svgW = tW+PAD*2; // 922
  const svgH = HDR+OT+mH+FTR+PAD; // 252

  // Grid origin
  const gX = PAD+OL; // 58
  const gY = HDR+OT; // 72

  const weeks = (data.weeks||[]).slice(-COLS);
  const dur = 8; // animation duration in seconds

  // ── Labels ──
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYLAB=['','Mon','','Wed','','Fri',''];
  let labels='';
  for(let r=0;r<ROWS;r++){
    if(DAYLAB[r]){
      labels+=`<text x="${PAD+4}" y="${gY+r*step+SZ-2}" font-family="sans-serif" font-size="10" fill="${C.lbl}">${DAYLAB[r]}</text>\n`;
    }
  }
  const mi=Math.floor(COLS/12);
  for(let m=0;m<12;m++){
    const ci=m*mi;
    if(ci<COLS) labels+=`<text x="${gX+ci*step}" y="${gY-8}" font-family="sans-serif" font-size="10" fill="${C.lbl}">${MONTHS[m]}</text>\n`;
  }

  // ── Build grid data ──
  let emptyTiles='', totalActive=0;

  // Per-row: compute sine offset (static bake of preview.html wave shape at time=0)
  // preview.html: rowOffset = Math.sin(r*0.85 + time*1.8)*18 + Math.cos(r*0.4 + time*2.5)*8
  // For SVG we bake time=0: sOff = Math.sin(r*0.85)*18 + Math.cos(r*0.4)*8
  const rowOffsets = [];
  for(let r=0;r<ROWS;r++){
    rowOffsets.push(Math.sin(r*0.85)*18 + Math.cos(r*0.4)*8);
  }

  // clipPath defs per row for eraser and rebuild
  let clipDefs='', clipAnims='';
  const sweepDist = mW + 100;

  // Sweep range for calculating per-tile timing
  const sweepMinX = gX - 50;
  const sweepRange = mW + 100; // total X distance the sweep covers

  for(let r=0;r<ROWS;r++){
    const so = rowOffsets[r];
    const startX = gX - 50 + so;
    const rowTop = gY + r*step - 2;
    const rowH = step + 4;

    clipDefs += `<clipPath id="ec${r}${theme}"><rect class="er${r}${theme}" x="${startX}" y="${rowTop}" width="${mW+200}" height="${rowH}"/></clipPath>\n`;
    clipDefs += `<clipPath id="rc${r}${theme}"><rect class="rr${r}${theme}" x="${startX}" y="${rowTop}" width="0" height="${rowH}"/></clipPath>\n`;

    clipAnims += `
@keyframes es${r}{0%{transform:translateX(0)}44%{transform:translateX(${sweepDist}px)}47%,100%{transform:translateX(${sweepDist}px)}}
.er${r}${theme}{animation:es${r} ${dur}s cubic-bezier(.4,0,.2,1) infinite}
@keyframes rs${r}{0%,48%{width:0}92%{width:${mW+140}px}97%,100%{width:${mW+140}px}}
.rr${r}${theme}{animation:rs${r} ${dur}s cubic-bezier(.4,0,.2,1) infinite}
@keyframes fl${r}{0%{transform:translateX(${startX}px);opacity:1}44%{transform:translateX(${startX+sweepDist}px);opacity:1}45%,49%{opacity:0}50%{transform:translateX(${startX}px);opacity:1}94%{transform:translateX(${startX+sweepDist}px);opacity:1}95%,100%{opacity:0}}
.fl${r}${theme}{animation:fl${r} ${dur}s cubic-bezier(.4,0,.2,1) infinite}
`;
  }

  // Build tiles per row, wrapped in clip groups
  let washTiles='', rebuildTiles='';

  for(let r=0;r<ROWS;r++){
    let wRow=`<g clip-path="url(#ec${r}${theme})">\n`;
    let rRow=`<g clip-path="url(#rc${r}${theme})">\n`;
    weeks.forEach((week,c)=>{
      const cx=gX+c*step, cy=gY+r*step;
      (week.contributionDays||[]).forEach(day=>{
        if(day.weekday!==r) return;
        const lvl=getLevel(day.contributionCount);
        emptyTiles+=`<rect x="${cx}" y="${cy}" width="${SZ}" height="${SZ}" rx="${RR}" fill="${C.empty}" stroke="${C.eStk}" stroke-width="1"/>\n`;
        if(lvl>0){
          totalActive++;
          const fill=C.lv[lvl];
          wRow+=`<rect x="${cx}" y="${cy}" width="${SZ}" height="${SZ}" rx="${RR}" fill="${fill}"/>\n`;
          rRow+=`<rect x="${cx}" y="${cy}" width="${SZ}" height="${SZ}" rx="${RR}" fill="${fill}"/>\n`;
        }
      });
    });
    wRow+='</g>\n'; rRow+='</g>\n';
    washTiles+=wRow; rebuildTiles+=rRow;
  }

  // ── Disintegration Particles (per-column, not per-tile) ──
  // 52 columns × 4 particles = 208 circles with 52 shared keyframes
  let particleSvg='', particleAnims='';
  function seededRand(s) { const x=Math.sin(s)*10000; return x-Math.floor(x); }

  for(let c=0;c<COLS;c++){
    const cx = gX + c*step + SZ/2;
    // When does the sweep reach this column? (use middle row offset)
    const progress = c / (COLS - 1);
    const eraseHit = Math.max(1, Math.min(42, progress * 44));
    const rebuildHit = Math.max(51, Math.min(92, 50 + progress * 44));

    const eH = eraseHit.toFixed(1);
    const eEnd = (eraseHit + 5).toFixed(1);
    const rH = rebuildHit.toFixed(1);
    const rEnd = (rebuildHit + 5).toFixed(1);

    // 4 particles per column, scattered across rows
    for(let pi=0;pi<4;pi++){
      const pid = `d${c}_${pi}`;
      const seed = c*73+pi*31+17;
      const vx = (seededRand(seed)-0.5)*30;
      const vy = (seededRand(seed+7)-0.8)*24;
      const pcy = gY + (seededRand(seed+3) * (ROWS-1)) * step + SZ/2;
      const sz = (seededRand(seed+13)*2+1).toFixed(1);
      const fillIdx = Math.min(4, Math.max(1, Math.round(seededRand(seed+19)*4)));

      particleAnims += `@keyframes ${pid}{0%,${eH}%{transform:translate(0,0);opacity:0}${(eraseHit+0.3).toFixed(1)}%{transform:translate(0,0);opacity:1}${eEnd}%{transform:translate(${vx.toFixed(0)}px,${vy.toFixed(0)}px);opacity:0}${(parseFloat(eEnd)+0.5).toFixed(1)}%,${rH}%{transform:translate(0,0);opacity:0}${(rebuildHit+0.3).toFixed(1)}%{transform:translate(0,0);opacity:1}${rEnd}%{transform:translate(${(-vx).toFixed(0)}px,${(vy*0.7).toFixed(0)}px);opacity:0}${(parseFloat(rEnd)+0.5).toFixed(1)}%,100%{opacity:0}}
.${pid}{animation:${pid} ${dur}s ease-out infinite}
`;
      particleSvg += `<circle class="${pid}" cx="${cx}" cy="${pcy.toFixed(0)}" r="${sz}" fill="${C.lv[fillIdx]}" filter="url(#gl${theme})"/>\n`;
    }
  }

  // Frontline glow bars per row
  let glowBarsW='', glowBarsR='';
  for(let r=0;r<ROWS;r++){
    const y=gY+r*step;
    glowBarsW+=`<rect class="fl${r}${theme}" x="0" y="${y}" width="5" height="${SZ}" rx="2" fill="${C.wash}" opacity="0.9" filter="url(#gl${theme})"/>\n`;
    glowBarsR+=`<rect class="fl${r}${theme}" x="0" y="${y}" width="5" height="${SZ}" rx="2" fill="${C.reb}" opacity="0.9" filter="url(#gl${theme})"/>\n`;
  }

  // White flash overlays on leading edge
  let flashW='', flashR='';
  for(let r=0;r<ROWS;r++){
    const y=gY+r*step;
    flashW+=`<rect class="fl${r}${theme}" x="-4" y="${y}" width="${SZ+10}" height="${SZ}" rx="${RR}" fill="white" opacity="0.8" filter="url(#gl${theme})"/>\n`;
    flashR+=`<rect class="fl${r}${theme}" x="-4" y="${y}" width="${SZ+10}" height="${SZ}" rx="${RR}" fill="white" opacity="0.8" filter="url(#gl${theme})"/>\n`;
  }

  // Jet exhaust trail particles
  let exhaustSvg='', exhaustAnims='';
  for(let ei=0;ei<4;ei++){
    const eid = `ex${ei}${theme}`;
    const vy = ((ei%3)-1)*3;
    exhaustAnims += `@keyframes ${eid}{0%,100%{transform:translate(0,${vy}px);opacity:0}5%{opacity:.7}12%{transform:translate(-18px,${vy*2}px);opacity:0}}
.${eid}{animation:${eid} 0.${8+ei}s ease-out ${(ei*0.2).toFixed(1)}s infinite}
`;
    exhaustSvg += `<circle class="${eid}" cx="-10" cy="0" r="${(1+ei*0.3).toFixed(1)}" fill="${C.wash}"/>\n`;
  }

  // Jet Y keyframes from preview.html: jetY = OT+(mH/2)+Math.sin(time*2.2)*(mH/2.8)
  const midY = gY + mH/2;
  const ampY = mH/2.8;
  let jetYKf='';
  for(let p=0;p<=100;p+=2){
    const t=(p/100)*dur*2.2;
    const y=Math.round(midY+Math.sin(t)*ampY);
    jetYKf+=`${p}%{transform:translateY(${y}px)}`;
  }
  const jMinX=gX-60, jMaxX=gX+mW+60;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" height="100%">
<defs>
<filter id="gl${theme}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
${clipDefs}
<style>
@keyframes pw{0%,44%{opacity:1}46%,94%{opacity:0}96%,100%{opacity:1}}
@keyframes pr{0%,44%{opacity:0}50%,94%{opacity:1}96%,100%{opacity:0}}
@keyframes bw{0%,44%{opacity:1}47%,95%{opacity:0}98%,100%{opacity:1}}
@keyframes br{0%,44%{opacity:0}47%,95%{opacity:1}98%,100%{opacity:0}}
@keyframes pd{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes jx{0%{transform:translateX(${jMinX}px);opacity:1}44%{transform:translateX(${jMaxX}px);opacity:1}45%,49%{transform:translateX(${jMaxX}px);opacity:0}50%{transform:translateX(${jMinX}px);opacity:1}94%{transform:translateX(${jMaxX}px);opacity:1}95%,100%{transform:translateX(${jMaxX}px);opacity:0}}
@keyframes jy{${jetYKf}}
.pw{animation:pw ${dur}s ease-in-out infinite}
.pr{animation:pr ${dur}s ease-in-out infinite}
.bw{animation:bw ${dur}s ease-in-out infinite}
.br{animation:br ${dur}s ease-in-out infinite}
.pd{animation:pd 1.5s ease-in-out infinite}
.jx{animation:jx ${dur}s cubic-bezier(.4,0,.2,1) infinite}
.jy{animation:jy ${dur}s ease-in-out infinite}
${clipAnims}
${particleAnims}
${exhaustAnims}
</style>
</defs>

<rect x="1" y="1" width="${svgW-2}" height="${svgH-2}" rx="12" fill="${C.card}" stroke="${C.brd}"/>

<g transform="translate(${PAD},${PAD})">
<path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" fill="${C.txt}"/>
<text x="26" y="13" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="15" font-weight="600" fill="${C.txt}">Contribution Activity</text>
<g class="bw" transform="translate(${svgW-PAD*2-200},-4)">
<rect width="195" height="24" rx="12" fill="${C.washBg}" stroke="${C.washBdr}"/>
<circle class="pd" cx="16" cy="12" r="3" fill="${C.wash}"/>
<text x="28" y="16" font-family="ui-monospace,monospace" font-size="10.5" font-weight="600" letter-spacing=".5" fill="${C.wash}">ERASER SWEEP ACTIVE</text>
</g>
<g class="br" transform="translate(${svgW-PAD*2-208},-4)">
<rect width="203" height="24" rx="12" fill="${C.rebBg}" stroke="${C.rebBdr}"/>
<circle class="pd" cx="16" cy="12" r="3" fill="${C.reb}"/>
<text x="28" y="16" font-family="ui-monospace,monospace" font-size="10.5" font-weight="600" letter-spacing=".5" fill="${C.reb}">RESTORE SWEEP ACTIVE</text>
</g>
</g>

${labels}
${emptyTiles}

<g class="pw">
${washTiles}</g>

<g class="pr">
${rebuildTiles}</g>

<g class="pw">
${flashW}</g>
<g class="pr">
${flashR}</g>

<g class="pw">
${glowBarsW}</g>
<g class="pr">
${glowBarsR}</g>

<!-- Disintegration particles -->
${particleSvg}

<g class="jx"><g class="jy">
<circle cx="-6" cy="0" r="7" fill="${C.wash}" opacity=".35" class="pw" filter="url(#gl${theme})"/>
<circle cx="-6" cy="0" r="3.5" fill="${C.wash}" class="pw"/>
<circle cx="-6" cy="0" r="7" fill="${C.reb}" opacity=".35" class="pr" filter="url(#gl${theme})"/>
<circle cx="-6" cy="0" r="3.5" fill="${C.reb}" class="pr"/>
<path d="M12 0L-8-8L-3 0L-8 8Z" fill="${C.jet}"/>
<path d="M2 0L-4-6L-1 0L-4 6Z" fill="${C.wash}" class="pw"/>
<path d="M2 0L-4-6L-1 0L-4 6Z" fill="${C.reb}" class="pr"/>
<ellipse cx="3" cy="0" rx="3" ry="1.5" fill="${C.visor}"/>
${exhaustSvg}
</g></g>

<g transform="translate(${PAD},${gY+mH+18})">
<text class="pw" font-family="ui-monospace,monospace" font-size="12" fill="${C.lbl}">${totalActive} / ${COLS*ROWS} days erased</text>
<text class="pr" font-family="ui-monospace,monospace" font-size="12" fill="${C.lbl}">0 / ${COLS*ROWS} days restored</text>
<g transform="translate(${svgW-PAD*2-130},-10)">
<text x="0" y="10" font-family="sans-serif" font-size="12" fill="${C.lbl}">Less</text>
<rect x="35" y="1" width="10" height="10" rx="2" fill="${C.lv[0]}" stroke="${C.eStk}"/>
<rect x="50" y="1" width="10" height="10" rx="2" fill="${C.lv[1]}"/>
<rect x="65" y="1" width="10" height="10" rx="2" fill="${C.lv[2]}"/>
<rect x="80" y="1" width="10" height="10" rx="2" fill="${C.lv[3]}"/>
<rect x="95" y="1" width="10" height="10" rx="2" fill="${C.lv[4]}"/>
<text x="113" y="10" font-family="sans-serif" font-size="12" fill="${C.lbl}">More</text>
</g>
</g>
</svg>`;
  return svg;
}

async function main() {
  console.log('Generating SVGs...');
  const data = await fetchContributions(USERNAME, GITHUB_TOKEN);
  const dark = generateSVG(data, 'dark');
  const light = generateSVG(data, 'light');
  fs.writeFileSync(path.join(distDir, 'eraser-dark.svg'), dark, 'utf8');
  fs.writeFileSync(path.join(distDir, 'eraser-light.svg'), light, 'utf8');
  fs.writeFileSync(path.join(assetsDir, 'eraser-dark.svg'), dark, 'utf8');
  fs.writeFileSync(path.join(assetsDir, 'eraser-light.svg'), light, 'utf8');
  console.log('Done! Files written to dist/ and assets/');
  // Verify
  console.log('dist:', fs.readdirSync(distDir));
  console.log('assets:', fs.readdirSync(assetsDir));
}

main().catch(e => { console.error(e); process.exit(1); });
