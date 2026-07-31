const { chromium } = require("playwright-core");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const SCRATCH = "/tmp/claude-0/-home-user-pickdynasty/4842f265-e83a-511c-accb-00c8029a9744/scratchpad";

(async () => {
  const jwt = fs.readFileSync(SCRATCH + "/host.jwt", "utf8").trim();
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ name: "ep_session", value: jwt, url: "http://localhost:3000" }]);
  const page = await ctx.newPage();

  // 1. No theme cookie -> LIGHT by default now.
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  console.log("default theme:", theme, bg);
  await page.screenshot({ path: SCRATCH + "/light-default-dash.png", fullPage: false });

  // 2. Delete "The Corner Tap" venue (from the last test); its night must survive.
  const db = new PrismaClient();
  const before = await db.league.findFirst({ where: { name: { startsWith: "The Corner Tap" } } });
  await page.goto("http://localhost:3000/venues/cms88vpcd00017dbg76me26zz", { waitUntil: "networkidle" });
  page.on("dialog", (d) => d.accept());
  await page.click("text=Delete this venue");
  await page.waitForURL("**/dashboard?venueDeleted=1", { timeout: 15000 });
  await page.waitForSelector("text=Venue deleted");
  const gone = await db.venue.findUnique({ where: { id: "cms88vpcd00017dbg76me26zz" } });
  const after = await db.league.findUnique({ where: { id: before.id } });
  console.log(JSON.stringify({
    venueGone: gone === null,
    nightSurvives: Boolean(after),
    nightVenueId: after?.venueId ?? null,
  }));
  await page.screenshot({ path: SCRATCH + "/venue-deleted-dash.png", fullPage: false });
  await db.$disconnect();
  await browser.close();
})();
