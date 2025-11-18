/**
 * Puppeteer Example - Connecting to Lightpanda Server
 *
 * Install: npm install puppeteer-core
 */

const puppeteer = require('puppeteer-core');

async function scrapeWithLightpanda() {
  // Connect to lightpanda server
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://localhost:9222',
    // For remote server: 'ws://your-server-ip:9222'
  });

  try {
    const page = await browser.newPage();

    // Enable request interception for anti-bot features
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      // Modify headers per request
      const headers = {
        ...request.headers(),
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      };
      request.continue({ headers });
    });

    // Navigate to target website
    console.log('Navigating to example.com...');
    await page.goto('https://example.com', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Extract data
    const title = await page.title();
    const content = await page.evaluate(() => {
      return {
        heading: document.querySelector('h1')?.textContent,
        paragraphs: Array.from(document.querySelectorAll('p')).map(p => p.textContent),
        // Test document.all (should be falsy - anti-bot feature)
        documentAllTest: !document.all ? 'PASSED: document.all is falsy' : 'FAILED',
        userAgent: navigator.userAgent,
      };
    });

    console.log('Page title:', title);
    console.log('Content:', JSON.stringify(content, null, 2));

    // Take screenshot
    await page.screenshot({ path: 'screenshot.png' });
    console.log('Screenshot saved to screenshot.png');

    await page.close();
  } finally {
    await browser.disconnect();
  }
}

// Advanced example with proxy rotation
async function scrapeWithProxy() {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://localhost:9222',
  });

  try {
    const page = await browser.newPage();
    const client = await page.target().createCDPSession();

    // Enable fetch domain for request interception
    await client.send('Fetch.enable', {
      patterns: [{ urlPattern: '*' }],
    });

    // Intercept and modify requests
    client.on('Fetch.requestPaused', async (event) => {
      const { requestId, request } = event;

      // You can modify the request here
      await client.send('Fetch.continueRequest', {
        requestId,
      });
    });

    await page.goto('https://httpbin.org/headers');
    const headers = await page.evaluate(() => document.body.textContent);
    console.log('Headers seen by server:', headers);

    await page.close();
  } finally {
    await browser.disconnect();
  }
}

// Run examples
(async () => {
  try {
    console.log('=== Basic Scraping Example ===');
    await scrapeWithLightpanda();

    console.log('\n=== Advanced Proxy Example ===');
    await scrapeWithProxy();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
