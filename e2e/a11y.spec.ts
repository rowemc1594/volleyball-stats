import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Automated accessibility scan (WCAG 2.1 A and AA, including text contrast) of every screen.
// It cannot judge everything, but it catches missing names, low contrast and bad structure.

async function scan(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`,
  );
  expect(summary, `${where} accessibility problems`).toEqual([]);
}

test('every owner screen passes the accessibility scan', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();

  await page.goto('./');
  await scan(page, 'Matches (empty)');

  await page.getByLabel('Opponent').fill('Ridgeline');
  await page.getByRole('button', { name: /start match/i }).click();
  await page.locator('button[data-key="pass:3"]').click();
  await page.locator('button[data-key="hit:kill"]').click();
  await scan(page, 'Track');

  await page.getByRole('button', { name: /action history/i }).click();
  await scan(page, 'Track with history open');

  await page.getByRole('button', { name: /^End Set 1$/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await scan(page, 'End set sheet');
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Match details' }).click();
  await scan(page, 'Match details');

  await page.goto('./#/season');
  await scan(page, 'Season');

  await page.goto('./#/');
  await scan(page, 'Matches (with a match)');
  await context.close();
});

test('the shared viewer passes the accessibility scan', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
  };
  await page.route('**/rest/v1/rpc/get_shared_stats', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: cors })
      : route.fulfill({
          status: 200,
          headers: cors,
          contentType: 'application/json',
          body: JSON.stringify({
            player: { id: 'p1', name: 'Maya', jersey: '7' },
            matches: [{ id: 'm1', player_id: 'p1', opponent: 'Ridgeline', match_date: '2026-03-01', event: '', done: true, created_at: '2026-03-01T18:00:00+00:00' }],
            sets: [{ id: 's1', match_id: 'm1', set_number: 1, score_us: 25, score_them: 20 }],
            events: [{ id: 'e1', match_id: 'm1', set_id: 's1', kind: 'pass', value: '3', occurred_at: '2026-03-01T18:05:00+00:00' }],
          }),
        }),
  );
  await page.goto('./#/share/a11y-token-a11y-token-a11y-token-01');
  await expect(page.getByRole('heading', { name: /Maya/ })).toBeVisible();
  await scan(page, 'Viewer season');
  await page.getByRole('cell', { name: /Ridgeline/ }).click();
  await expect(page.getByRole('heading', { name: 'vs Ridgeline' })).toBeVisible();
  await scan(page, 'Viewer match');
  await context.close();
});

test('the app can be zoomed and does not lock the viewport', async ({ page }) => {
  await page.goto('./');
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/);
  expect(viewport).not.toMatch(/maximum-scale/);
});
