import { expect, test, type Route } from '@playwright/test';

// These tests stand in for the server: they answer the one call a viewer makes. The app must be
// built with the two Supabase settings (a local .env.local is enough) or the viewer has no client.

const SHARED = {
  player: { id: 'p1', name: 'Maya', jersey: '7' },
  matches: [
    { id: 'm1', player_id: 'p1', opponent: 'Ridgeline', match_date: '2026-03-01', event: '', done: true, created_at: '2026-03-01T18:00:00+00:00', deleted_at: null },
  ],
  sets: [{ id: 's1', match_id: 'm1', set_number: 1, score_us: 25, score_them: 20 }],
  events: [
    { id: 'e1', match_id: 'm1', set_id: 's1', kind: 'pass', value: '3', occurred_at: '2026-03-01T18:05:00+00:00' },
    { id: 'e2', match_id: 'm1', set_id: 's1', kind: 'pass', value: '3', occurred_at: '2026-03-01T18:06:00+00:00' },
    { id: 'e3', match_id: 'm1', set_id: 's1', kind: 'pass', value: '1', occurred_at: '2026-03-01T18:07:00+00:00' },
    { id: 'e4', match_id: 'm1', set_id: 's1', kind: 'hit', value: 'kill', occurred_at: '2026-03-01T18:08:00+00:00' },
  ],
};

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function serve(route: Route, body: unknown) {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(body) });
}

test('a viewer sees stats, cannot write, and loses access when the link is revoked', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  let answer: unknown = SHARED;
  const tokens: unknown[] = [];
  await page.route('**/rest/v1/rpc/get_shared_stats', (route) => {
    if (route.request().method() === 'POST') tokens.push(route.request().postDataJSON());
    return serve(route, answer);
  });
  // Any write to a table would be a bug in viewer mode.
  const writes: string[] = [];
  await page.route('**/rest/v1/**', (route) => {
    const r = route.request();
    if (r.url().includes('/rpc/get_shared_stats')) return route.fallback(); // handled above
    writes.push(`${r.method()} ${r.url()}`);
    return route.abort();
  });

  await page.goto('./#/share/test-token-test-token-test-token-0001');
  await expect(page.getByRole('heading', { name: /Maya #7/ })).toBeVisible();
  expect(tokens[0]).toEqual({ p_token: 'test-token-test-token-test-token-0001' });

  // Season totals: pass avg (3+3+1)/3 = 2.33.
  await expect(page.locator('.sum')).toContainText('2.33');

  // Read-only: no way to start a match, tap a stat, or edit a score.
  await expect(page.getByRole('button', { name: /start match/i })).toHaveCount(0);
  await expect(page.locator('.key')).toHaveCount(0);

  // Drill into the match.
  await page.getByRole('cell', { name: /Ridgeline/ }).click();
  await expect(page.getByRole('heading', { name: 'vs Ridgeline' })).toBeVisible();
  await expect(page.locator('.sum')).toContainText('3 passes');
  await expect(page.locator('.key')).toHaveCount(0);
  await expect(page.locator('input')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back' }).click();

  // The viewer's own device keeps nothing: no matches, events or outbox are saved locally.
  const stored = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.databases ? indexedDB.databases() : Promise.resolve([]);
        open.then((dbs) => resolve(dbs.filter((d) => d.name === 'side-out-stats').length));
      }),
  );
  if (stored) {
    const rows = await page.evaluate(
      () =>
        new Promise<number>((resolve, reject) => {
          const req = indexedDB.open('side-out-stats');
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result;
            let total = 0;
            const names = ['players', 'matches', 'sets', 'events', 'outbox'].filter((n) => db.objectStoreNames.contains(n));
            if (!names.length) return resolve(0);
            const tx = db.transaction(names, 'readonly');
            names.forEach((n) => (tx.objectStore(n).count().onsuccess = (e) => (total += (e.target as IDBRequest<number>).result)));
            tx.oncomplete = () => resolve(total);
          };
        }),
    );
    expect(rows).toBe(0);
  }

  // The owner revokes the link: the next refresh answers null, and the stats disappear.
  answer = null;
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByRole('heading', { name: /no longer active/i })).toBeVisible();
  await expect(page.locator('.sum')).toHaveCount(0);

  expect(writes).toEqual([]);
  await context.close();
});

test('a viewer sees a friendly message when the server cannot be reached', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route('**/rest/v1/rpc/get_shared_stats', (route) => route.abort());
  await page.goto('./#/share/another-token-another-token-another-0002');
  await expect(page.getByRole('heading', { name: /can.t load the stats/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await context.close();
});
