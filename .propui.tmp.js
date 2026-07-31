const { chromium } = require("playwright-core");
const fs = require("fs");
const SCRATCH = "/tmp/claude-0/-home-user-pickdynasty/4842f265-e83a-511c-accb-00c8029a9744/scratchpad";
const L = "cms9df1wx00017dmwgys6fujg";

(async () => {
  const jwt = fs.readFileSync(SCRATCH + "/host.jwt", "utf8").trim();
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
  await ctx.addCookies([{ name: "ep_session", value: jwt, url: "http://localhost:3000" }]);
  const page = await ctx.newPage();

  // Admin slates: graded prop rows + the add-prop form; add one via the UI.
  await page.goto(`http://localhost:3000/leagues/${L}/admin/slates`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=Add a player prop", { timeout: 60000 });
  await page.screenshot({ path: SCRATCH + "/prop-admin.png", fullPage: true });
  await page.fill("input[name='playerName']", "James Cook");
  await page.selectOption("select[name='statKey']", "rushYds");
  await page.fill("input[name='line']", "88.5");
  await page.click("button:has-text('Add prop')");
  await page.waitForSelector("text=James Cook · Rushing yards — O/U 88.5", { timeout: 20000 });
  console.log("UI add prop ✓");

  // Picks page: prop cards render with Over/Under buttons + results.
  const slateId = "cms9df1zc00057dmwu3lcnhs9";
  await page.goto(`http://localhost:3000/leagues/${L}/picks/${slateId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=Josh Allen · Passing yards", { timeout: 60000 });
  const overBtns = await page.locator("button:has-text('Over 249.5')").count();
  const finalChip = await page.locator("text=Final: 273").count();
  console.log("picks page:", JSON.stringify({ overBtns, allenFinalChip: finalChip }));
  await page.screenshot({ path: SCRATCH + "/prop-picks.png", fullPage: true });
  await browser.close();
})();
