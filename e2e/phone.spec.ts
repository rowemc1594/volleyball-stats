import { expect, test, type Page } from '@playwright/test';

// iPhone SE (smallest we support), a mid iPhone, and a large one. Heights are the
// full screen; an installed app loses about 20px to the status bar, so we leave that room.
const PHONES = [
  { name: 'iPhone SE 375x667', width: 375, height: 667 },
  { name: 'iPhone 390x844', width: 390, height: 844 },
  { name: 'iPhone Pro Max 430x932', width: 430, height: 932 },
];
const STATUS_BAR = 20;

const KEYS: Record<string, string> = {
  'pass 0': 'pass:0',
  'pass 1': 'pass:1',
  'pass 2': 'pass:2',
  'pass 3': 'pass:3',
  'hit KILL': 'hit:kill',
  'hit ERR': 'hit:error',
  'serve ACE': 'serve:ace',
  'serve FAULT': 'serve:error',
};
/** A tap button by its short name. Matches on a stable attribute, not on the words shown. */
const key = (page: Page, name: string) => page.locator(`button[data-key="${KEYS[name]}"]`);

async function startMatch(page: Page, opponent = 'Ridgeline') {
  await page.goto('./');
  await page.getByLabel('Opponent').fill(opponent);
  await page.getByRole('button', { name: /start match/i }).click();
  await expect(key(page, 'pass 3')).toBeVisible();
}

const tap = (page: Page, label: string, times = 1) =>
  (async () => {
    for (let i = 0; i < times; i++) await key(page, label).click();
  })();

for (const phone of PHONES) {
  test(`Track controls fit without scrolling on ${phone.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: phone.width, height: phone.height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await startMatch(page);

    const limit = phone.height - STATUS_BAR;
    for (const name of ['pass 3', 'pass 0', 'hit KILL', 'hit ERR', 'serve ACE', 'serve FAULT']) {
      const box = await key(page, name).boundingBox();
      expect(box, name).not.toBeNull();
      expect(box!.y + box!.height, `${name} bottom`).toBeLessThanOrEqual(limit);
    }
    const add = await page.getByRole('button', { name: 'Add a point for Them' }).boundingBox();
    expect(add!.y + add!.height, 'score buttons').toBeLessThanOrEqual(limit);
    const end = await page.getByRole('button', { name: /^End Set 1$/ }).boundingBox();
    expect(end!.y + end!.height, 'End Set').toBeLessThanOrEqual(limit);

    // The tap targets are big enough for one-handed use.
    const pass3 = await key(page, 'pass 3').boundingBox();
    expect(pass3!.height).toBeGreaterThanOrEqual(54);

    // No sideways scrolling anywhere.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await context.close();
  });
}

// Zoomed-in iPhones (Display Zoom, large text) give the app less room. Not everything can
// fit there, so the content scrolls under the header, but the header must never cover it.
for (const phone of [
  { name: 'small 320x568', width: 320, height: 568 },
  { name: 'iPhone SE 375x667', width: 375, height: 667 },
  { name: 'iPhone 390x844', width: 390, height: 844 },
]) {
  test(`header never covers the stats on ${phone.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: phone.width, height: phone.height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await startMatch(page);

    const bottom = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
    const header = await bottom('.stick');
    const summary = await bottom('.sum');
    expect(summary.y, 'summary starts below the header').toBeGreaterThanOrEqual(header.y + header.height);

    // The page itself never scrolls; only the content area does.
    const pageScrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
    expect(pageScrolls).toBe(false);

    // Scroll the content all the way down and back up: the summary is reachable again.
    await page.locator('.scroller').evaluate((el) => (el.scrollTop = el.scrollHeight));
    const headerAfter = await bottom('.stick');
    expect(headerAfter.y).toBe(header.y);
    await page.locator('.scroller').evaluate((el) => (el.scrollTop = 0));
    const summaryAgain = await bottom('.sum');
    expect(summaryAgain.y).toBeGreaterThanOrEqual(header.y + header.height);

    // Band headings stay on one line.
    for (const h of await page.locator('.bt').all()) {
      expect((await h.boundingBox())!.height).toBeLessThan(24);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await context.close();
  });
}

test('tap, undo and reload keep the right totals', async ({ page }) => {
  await startMatch(page);
  await tap(page, 'pass 3', 2);
  await tap(page, 'pass 1');
  await tap(page, 'hit KILL');
  await tap(page, 'hit ERR');
  await tap(page, 'serve ACE');

  const summary = page.locator('.sum');
  await expect(summary).toContainText('2.33'); // (3+3+1)/3
  await expect(summary).toContainText('.000'); // (1 kill - 1 error)/2
  await expect(summary).toContainText('100%');

  await page.getByRole('button', { name: /undo/i }).click(); // removes the ace
  await expect(summary).toContainText('–'); // no serves left

  await page.reload();
  await expect(page.locator('.sum')).toContainText('2.33');
  await expect(page.locator('.sum')).toContainText('3 passes');
});

test('manifest and icons are served from the subpath', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/volleyball-stats/manifest.webmanifest');

  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ display: 'standalone', start_url: './', scope: './' });
  const purposes = manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`);
  expect(purposes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']));
  for (const icon of manifest.icons) {
    const res = await request.get(`/volleyball-stats/${icon.src}`);
    expect(res.status(), icon.src).toBe(200);
  }

  const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect(touch).toBe('/volleyball-stats/apple-touch-icon.png');
  expect((await request.get(touch!)).status()).toBe(200);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
});

test('works offline from a cold start', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  // Visit once online so the service worker can cache the app, then wait until it controls the page.
  await startMatch(page, 'Offline FC');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // The precache finishes right after activation; give it a moment to settle.
  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).length))
    .toBeGreaterThan(0);

  await tap(page, 'pass 2', 2);
  await context.setOffline(true);

  // Cold start: a brand new page in the same browser profile, with no network at all.
  const cold = await context.newPage();
  await cold.goto('./');
  await expect(cold.getByRole('heading', { name: /start a match/i })).toBeVisible();
  await expect(cold.getByRole('button', { name: /resume match/i })).toContainText('Offline FC');

  // And a deep link straight into the match works too.
  await cold.getByRole('button', { name: /resume match/i }).click();
  await expect(cold.locator('.sum')).toContainText('2.00');
  await expect(cold.locator('.sum')).toContainText('2 passes');

  // Tapping while offline still saves, and survives a reload.
  await key(cold, 'hit KILL').click();
  await expect(cold.locator('.sum')).toContainText('1.000'); // shown only after the local write lands
  await cold.reload();
  await expect(cold.locator('.sum')).toContainText('1.000');
  await context.close();
});

// The little count badge in a button's corner must never sit on top of that button's own words.
for (const phone of [
  { name: 'small 320x568', width: 320, height: 568 },
  { name: 'iPhone SE 375x667', width: 375, height: 667 },
  { name: 'iPhone 390x844', width: 390, height: 844 },
]) {
  test(`count badges do not cover button labels on ${phone.name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: phone.width, height: phone.height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await startMatch(page);
    // Tap one key to a two-digit count so the badge is at its widest.
    for (let i = 0; i < 12; i++) await key(page, 'pass 3').click();
    await page.waitForTimeout(600); // let the badge finish its little pop animation before measuring

    const overlaps = await page.evaluate(() => {
      const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const found: string[] = [];
      document.querySelectorAll<HTMLElement>('.key').forEach((k) => {
        const badge = k.querySelector('.n')!.getBoundingClientRect();
        k.querySelectorAll('b, strong, small').forEach((t) => {
          if (hit(badge, t.getBoundingClientRect())) found.push(`${k.dataset.key}: ${t.tagName} "${t.textContent}"`);
        });
      });
      return found;
    });
    expect(overlaps).toEqual([]);
    await context.close();
  });
}
