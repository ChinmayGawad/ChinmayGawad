const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const GIFEncoder = require('gif-encoder-2');
const { PNG } = require('pngjs');
const { getGitHubContributions } = require('./github-contributions');
const { getHTMLTemplate } = require('./renderer');

async function main() {
  console.log("=== GitHub Contribution Wash Animation Generator ===");

  const username = process.env.GITHUB_USERNAME || process.env.GH_USERNAME || 'ChinmayGawad';
  const outputDir = path.join(__dirname, '..', 'assets');
  const outputPath = path.join(outputDir, 'contribution.gif');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Step 1: Fetch Real GitHub Contribution Data
  let contributionData;
  try {
    contributionData = await getGitHubContributions(username);
  } catch (err) {
    console.error(`[FATAL] Failed to fetch contribution data: ${err.message}`);
    process.exit(1);
  }

  const { grid, totalContributions } = contributionData;
  console.log(`[Data] Grid initialized with 52x7 real days. Total contributions: ${totalContributions}`);

  // Step 2: Build HTML Page
  const htmlContent = getHTMLTemplate(grid, totalContributions);
  const tempHtmlPath = path.join(__dirname, 'temp_render.html');
  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');

  // Step 3: Launch Headless Browser via Playwright
  console.log("[Playwright] Launching Chromium browser...");
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  } catch (err) {
    console.error(`[FATAL] Failed to launch Chromium: ${err.message}`);
    console.error("Please run: npx playwright install chromium");
    process.exit(1);
  }

  const context = await browser.newContext({
    viewport: { width: 960, height: 320 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  console.log("[Playwright] Navigating to template page...");
  await page.goto(`file://${path.resolve(tempHtmlPath)}`, { waitUntil: 'load' });

  // Enable manual step mode for deterministic frame capturing
  await page.evaluate(() => {
    window.manualStepMode = true;
  });

  const cardElement = await page.$('#cardContainer') || await page.$('.card');
  if (!cardElement) {
    console.error("[FATAL] Card container element '.card' not found in HTML!");
    await browser.close();
    process.exit(1);
  }

  const boundingBox = await cardElement.boundingBox();
  const width = Math.round(boundingBox.width);
  const height = Math.round(boundingBox.height);
  console.log(`[Card Dimensions] Width: ${width}px, Height: ${height}px`);

  // Step 4: Configure Pure JS GIF Encoder
  const encoder = new GIFEncoder(width, height);
  encoder.start();
  encoder.setRepeat(0);   // 0 = loop forever
  encoder.setDelay(80);   // 80ms frame delay for smooth, readable slow motion

  const TOTAL_FRAMES = 80;
  console.log(`[Capturing] Capturing ${TOTAL_FRAMES} deterministic frames across full 100% Washing & Rebuilding cycles...`);

  for (let f = 0; f < TOTAL_FRAMES; f++) {
    const progressRatio = f / TOTAL_FRAMES;

    // Advance canvas animation step deterministically to exact ratio
    await page.evaluate((ratio) => {
      window.renderStep(ratio);
    }, progressRatio);

    // Capture card screenshot buffer
    const screenshotBuffer = await cardElement.screenshot({ type: 'png' });
    
    // Parse PNG buffer to raw RGBA pixels for GIFEncoder
    const png = PNG.sync.read(screenshotBuffer);
    encoder.addFrame(png.data);

    if ((f + 1) % 10 === 0 || f === TOTAL_FRAMES - 1) {
      console.log(`[Capturing] Progress: ${f + 1}/${TOTAL_FRAMES} frames encoded.`);
    }
  }

  encoder.finish();
  const finalBuffer = encoder.out.getData();

  fs.writeFileSync(outputPath, finalBuffer);
  console.log(`[Output] Successfully generated GIF animation at '${outputPath}' (${(finalBuffer.length / 1024).toFixed(1)} KB)`);

  await browser.close();

  // Clean up temp html file
  if (fs.existsSync(tempHtmlPath)) {
    fs.unlinkSync(tempHtmlPath);
  }

  console.log("=== Generation Complete! ===");
}

main().catch((err) => {
  console.error(`[Unhandled Error] ${err.message}`);
  process.exit(1);
});
