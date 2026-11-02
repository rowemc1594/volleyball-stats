import { expect, test } from '@playwright/test';

test('first run shows friendly empty states', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('No matches yet. Start your first match above.')).toBeVisible();
  await page.goto('./#/season');
  await expect(page.getByText('No matches yet.')).toBeVisible();
  // A link to a match that does not exist goes back to Matches instead of a blank page.
  await page.goto('./#/track/does-not-exist');
  await expect(page.getByRole('heading', { name: /start a match/i })).toBeVisible({ timeout: 5000 });
});

test('says so plainly when the browser will not allow local storage', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
  });
  await page.goto('./');
  await expect(page.getByRole('alert')).toContainText(/can.t save on this device/i);
  await context.close();
});

test('End Set sheet works like a real dialog: focus, Escape and return of focus', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Opponent').fill('Ridgeline');
  await page.getByRole('button', { name: /start match/i }).click();

  const opener = page.getByRole('button', { name: /^End Set 1$/ });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByLabel('Our score')).toBeFocused();

  // Tab never leaves the dialog.
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});
