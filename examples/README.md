# Lightpanda Examples

Example scripts for connecting to and using Lightpanda as a headless browser server.

## Prerequisites

1. Lightpanda server running on `localhost:9222`
2. Node.js installed (v16 or higher)

## Installation

```bash
cd examples
npm install
```

## Running Examples

### Puppeteer Example

```bash
npm run puppeteer
```

This example demonstrates:
- Connecting to Lightpanda via Puppeteer
- Request interception and header modification
- Data extraction from pages
- Testing anti-bot features (document.all)
- Taking screenshots

### Playwright Example

```bash
npm run playwright
```

This example demonstrates:
- Connecting to Lightpanda via Playwright CDP
- Request interception and resource blocking
- Batch scraping multiple URLs
- Custom headers and user agent
- Screenshot capture

## Examples Included

### puppeteer-example.js

- **Basic Scraping**: Simple page navigation and data extraction
- **Anti-Bot Testing**: Verifies document.all is falsy (key anti-bot feature)
- **Proxy Example**: Advanced request interception via CDP

### playwright-example.js

- **Basic Scraping**: Page navigation with Playwright
- **Request Interception**: Modify headers and block resources
- **Batch Scraping**: Scrape multiple URLs sequentially
- **Resource Blocking**: Speed up scraping by blocking images/CSS

## Configuration

### Connecting to Remote Server

Change the endpoint URLs in the examples:

**Puppeteer:**
```javascript
const browser = await puppeteer.connect({
  browserWSEndpoint: 'ws://your-server:9222'
});
```

**Playwright:**
```javascript
const browser = await chromium.connectOverCDP('http://your-server:9222');
```

### Anti-Bot Best Practices

1. **Always test document.all**: The falsy `document.all` is Lightpanda's key anti-bot feature
2. **Use realistic headers**: Set Accept-Language, Accept, etc.
3. **Vary timing**: Add random delays between requests
4. **Rotate user agents**: Configure via `--user-agent-suffix` on server
5. **Use request interception**: Modify requests to appear more realistic

## Troubleshooting

### Connection Refused

Make sure Lightpanda server is running:
```bash
# Check if server is up
curl http://localhost:9222/json/version

# If using Docker
docker-compose ps
docker-compose logs lightpanda
```

### Module Not Found

Install dependencies:
```bash
npm install
```

### Timeout Errors

Increase timeout in the examples or on the server:
```javascript
// Client side
await page.goto(url, { timeout: 60000 });

// Server side
--http-timeout 60
```

## Advanced Usage

### Custom Headers Per Request

```javascript
await page.setExtraHTTPHeaders({
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
});
```

### Block Resources for Speed

```javascript
await page.route('**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2}', route => {
  route.abort();
});
```

### Handle Authentication

```javascript
await page.authenticate({
  username: 'user',
  password: 'pass'
});
```

### Stealth Mode

```javascript
// Combined stealth techniques
await page.setViewport({ width: 1920, height: 1080 });
await page.setExtraHTTPHeaders({
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
});

// Verify anti-bot features
const checks = await page.evaluate(() => ({
  documentAll: !document.all, // Should be true
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  languages: navigator.language,
}));
console.log('Bot detection checks:', checks);
```

## Next Steps

1. Read the main [DEPLOYMENT.md](../DEPLOYMENT.md) for server configuration
2. Check `.env.example` for server environment variables
3. Review [Lightpanda documentation](https://github.com/lightpanda-io/browser)

## License

GNU Affero General Public License v3.0
