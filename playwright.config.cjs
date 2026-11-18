const { defineConfig } = require('@playwright/test');

const deployedURL = process.env.CSP_BASE_URL;
const baseURL = deployedURL ? new URL(deployedURL).href.replace(/\/?$/, '/') : 'http://127.0.0.1:4175/';

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'workbench.spec.cjs',
  timeout: 60000,
  reporter: 'list',
  projects: ['chromium', 'firefox', 'webkit'].map(browserName => ({
    name: browserName,
    use: { browserName }
  })),
  use: { baseURL },
  webServer: deployedURL ? undefined : {
    command: 'node scripts/serve.cjs',
    env: { PORT: '4175' },
    url: baseURL,
    reuseExistingServer: false
  }
});
