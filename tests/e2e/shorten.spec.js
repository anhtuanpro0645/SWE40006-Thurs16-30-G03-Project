import { test, expect } from '@playwright/test';

// One test, because the stats check needs a link that was visited exactly once.
// It creates exactly one link per run: the API allows 20 per minute per IP.
test('shorten a URL, follow the short link and see 1 click on the stats page', async ({ page, request }) => {
  const baseUrl = process.env.BASE_URL.replace(/\/$/, '');
  const target = `https://example.com/e2e/${Date.now()}`;
  let shortUrl;
  let code;

  await test.step('shorten', async () => {
    await page.goto('/');
    await page.getByTestId('url-input').fill(target);
    await page.getByTestId('shorten-button').click();
    await expect(page.getByTestId('result')).toBeVisible();

    const link = page.getByTestId('short-url');
    shortUrl = await link.getAttribute('href');
    await expect(link).toHaveText(shortUrl);
    expect(shortUrl.slice(0, baseUrl.length)).toBe(baseUrl);

    code = new URL(shortUrl).pathname.split('/').pop();
    expect(code).toMatch(/^[0-9A-Za-z]{7}$/);
  });

  await test.step('redirect', async () => {
    // maxRedirects: 0 checks the redirect without loading the external site
    const response = await request.get(shortUrl, { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers().location).toBe(target);
  });

  await test.step('stats', async () => {
    await page.getByTestId('stats-link').click();
    await expect(page).toHaveURL(new RegExp(`/stats/${code}$`));
    await expect(page.getByTestId('stats-total')).toHaveText('1');
    await expect(page.getByTestId('stats-days')).toBeVisible();
    await expect(page.getByTestId('stats-referrers')).toBeVisible();
    await expect(page.getByTestId('stats-browsers')).toBeVisible();
  });
});
