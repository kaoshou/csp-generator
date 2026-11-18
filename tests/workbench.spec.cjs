const path = require('node:path');
const { test, expect } = require('@playwright/test');

test('workbench browser regression suite', async ({ page, baseURL }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  // Pages excludes the test harness. Intercept just its two files in a fresh
  // browser context so the iframe loads the published app on its own origin.
  if (process.env.CSP_BASE_URL) {
    for (const file of ['browser.html', 'browser.js']) {
      await page.route(new URL('tests/' + file, baseURL).href, route =>
        route.fulfill({ path: path.join(__dirname, file) })
      );
    }
  }
  await page.goto('tests/browser.html');
  await expect(page.frameLocator('#app').locator('#directives > :first-child')).toBeAttached();
  await page.locator('#run').click();
  await expect(page.locator('#summary')).toContainText('完成', { timeout: 45000 });

  const failures = await page.locator('#results .fail').allTextContents();
  expect(failures).toEqual([]);
  await expect(page.locator('#summary')).toHaveText(/^完成：\d+ 通過，0 失敗。$/);
  await expect(page.locator('#results .pass').first()).toBeVisible();
  expect(errors).toEqual([]);
  console.log(await page.locator('#summary').innerText());
});

for (const strategy of ['preserve', 'only']) {
  test(`browser enforces the exported ${strategy} hash policy`, async ({ page }) => {
    const inlineScript = 'document.body.dataset.inline = "loaded";';
    await page.goto('index.html');
    await page.locator('.header-actions [data-action="open-import"]').click();
    await page.locator('#import-text').fill("Content-Security-Policy: default-src 'self';");
    await page.locator('#preview-import').click();
    await page.locator('#apply-import').click();
    await page.locator('[data-view="guidance"]').click();
    await page.locator('[data-action="open-hash"]').click();
    await page.locator('#hash-target').selectOption('script-src-elem');
    await page.locator('#hash-content').fill(inlineScript);
    await page.locator('#calculate-hash').click();
    await page.locator('#add-hash').click();
    await page.locator('#hash-strategy').selectOption(strategy);
    await page.locator('#apply-hash').click();
    await page.locator('#output-format').selectOption('header');
    const header = await page.locator('#policy-output').inputValue();
    expect(header).toMatch(/^Content-Security-Policy: [^\r\n]+$/);

    // Both resources are provided in memory. The browser receives an actual
    // enforcing response header and executes two fixed marker scripts.
    const fixture = 'https://workbench-fixture.invalid/';
    await page.route(fixture + '**', route => {
      switch (new URL(route.request().url()).pathname) {
        case '/':
          return route.fulfill({
            contentType: 'text/html',
            headers: { 'Content-Security-Policy': header.slice('Content-Security-Policy: '.length) },
            body: `<!doctype html><body><script>${inlineScript}</script><script src="marker.js"></script></body>`
          });
        case '/marker.js':
          return route.fulfill({ contentType: 'text/javascript', body: 'document.body.dataset.external = "loaded";' });
        default:
          return route.fulfill({ status: 404 });
      }
    });
    await page.goto(fixture, { waitUntil: 'load' });
    await expect(page.locator('body')).toHaveAttribute('data-inline', 'loaded');
    expect(await page.locator('body').getAttribute('data-external')).toBe(strategy === 'preserve' ? 'loaded' : null);
  });
}

test.describe('mobile navigation', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('workbench tabs, primer contents and return link', async ({ page, baseURL }) => {
    await page.goto('index.html');
    for (const view of ['guidance', 'simulator', 'rollout', 'learn', 'editor']) {
      const tab = page.locator(`.workspace-nav [data-view="${view}"]`);
      await tab.tap();
      await expect(tab).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#view-' + view)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    const [primer] = await Promise.all([
      page.waitForEvent('popup'),
      page.locator('.hero a[href="about-csp.html"]').tap()
    ]);
    await expect(primer.locator('#primer-title')).toBeVisible();
    await primer.locator('nav a[href="#history"]').tap();
    await expect(primer).toHaveURL(new URL('about-csp.html#history', baseURL).href);
    await expect(primer.locator('#history')).toBeInViewport();
    await primer.locator('.primer-back').tap();
    await expect(primer).toHaveURL(new URL('index.html#editor', baseURL).href);
    await expect(primer.locator('#view-editor')).toBeVisible();
  });
});
