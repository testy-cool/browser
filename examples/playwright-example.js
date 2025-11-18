/**
 * Playwright Example - Connecting to Lightpanda Server
 *
 * Install: npm install playwright-core
 */

const { chromium } = require('playwright-core');

async function scrapeWithLightpanda() {
  // Connect to lightpanda server via CDP
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  // For remote server: 'http://your-server-ip:9222'

  try {
    const context = await browser.newContext({
      // Optional: Set viewport
      viewport: { width: 1920, height: 1080 },
      // Optional: Extra headers
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const page = await context.newPage();

    // Navigate to target website
    console.log('Navigating to example.com...');
    await page.goto('https://example.com', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Extract data
    const content = await page.evaluate(() => {
      return {
        title: document.title,
        heading: document.querySelector('h1')?.textContent,
        paragraphs: Array.from(document.querySelectorAll('p')).map(p => p.textContent),
        // Test document.all (should be falsy - anti-bot feature)
        documentAllTest: !document.all ? 'PASSED: document.all is falsy' : 'FAILED',
        userAgent: navigator.userAgent,
        screen: {
          width: screen.width,
          height: screen.height,
          colorDepth: screen.colorDepth,
        },
      };
    });

    console.log('Content:', JSON.stringify(content, null, 2));

    // Take screenshot
    await page.screenshot({ path: 'screenshot-playwright.png' });
    console.log('Screenshot saved to screenshot-playwright.png');

    await context.close();
  } finally {
    await browser.close();
  }
}

// Example with request interception
async function scrapeWithInterception() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Intercept and modify requests
    await page.route('**/*', (route) => {
      const headers = {
        ...route.request().headers(),
        'X-Custom-Header': 'LightpandaScraper',
      };
      route.continue({ headers });
    });

    // Block unnecessary resources to speed up scraping
    await page.route('**/*.{png,jpg,jpeg,gif,svg,css}', (route) => {
      route.abort();
    });

    await page.goto('https://httpbin.org/headers');
    const headers = await page.textContent('body');
    console.log('Headers seen by server:', headers);

    await context.close();
  } finally {
    await browser.close();
  }
}

// Example: Batch scraping with multiple pages
async function batchScrape(urls) {
  const browser = await chromium.connectOverCDP('http://localhost:9222');

  try {
    const results = [];

    for (const url of urls) {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        console.log(`Scraping ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        const data = await page.evaluate(() => ({
          url: window.location.href,
          title: document.title,
          heading: document.querySelector('h1')?.textContent,
        }));

        results.push(data);
      } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        results.push({ url, error: error.message });
      } finally {
        await context.close();
      }
    }

    return results;
  } finally {
    await browser.close();
  }
}

// Run examples
(async () => {
  try {
    console.log('=== Basic Scraping Example ===');
    await scrapeWithLightpanda();

    console.log('\n=== Request Interception Example ===');
    await scrapeWithInterception();

    console.log('\n=== Batch Scraping Example ===');
    const urls = [
      'https://example.com',
      'https://example.org',
    ];
    const results = await batchScrape(urls);
    console.log('Batch results:', JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
