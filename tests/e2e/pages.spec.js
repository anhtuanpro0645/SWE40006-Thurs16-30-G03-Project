import { test, expect } from '@playwright/test';

test('footer shows the deployed version', async ({ page }) => {
  test.skip(!process.env.GIT_SHA, 'GIT_SHA is not set');
  await page.goto('/');
  const sha = page.getByTestId('version-sha');
  await expect(sha).toHaveAttribute('title', process.env.GIT_SHA);
  await expect(sha).toHaveText(`v${process.env.GIT_SHA.slice(0, 7)}`);
});

// Makes one POST /api/links, which the rate limiter counts even though it returns 400
test('an invalid URL shows an error and no result', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('url-input').fill('not a url');
  await page.getByTestId('shorten-button').click();
  await expect(page.getByTestId('error-message')).toBeVisible();
  await expect(page.getByTestId('result')).toBeHidden();
});

test('stats for an unknown code show not found', async ({ page }) => {
  // generateCode never returns any casing of the reserved code "metrics", so this link cannot exist
  await page.goto('/stats/Metrics');
  await expect(page.getByTestId('stats-not-found')).toBeVisible();
});
