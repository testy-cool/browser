# Lightpanda Deployment Guide

Deploy Lightpanda as a headless browser server for web scraping with anti-bot capabilities.

## 🚀 Cloud Platform Tutorials

**New to deployment?** Check out our step-by-step tutorials:

- **[Deploy on Hetzner Cloud](HETZNER_TUTORIAL.md)** - Complete tutorial with server setup, Docker installation, security hardening, and cost optimization

## Quick Start

### 1. Docker Deployment

```bash
# Copy and configure environment variables
cp .env.example .env
# Edit .env with your configuration

# Build and start the server
docker-compose up -d

# Check logs
docker-compose logs -f lightpanda

# Stop the server
docker-compose down
```

### 2. Manual Docker Build

```bash
# Build the image
docker build -t lightpanda:latest .

# Run with default settings
docker run -d -p 9222:9222 --name lightpanda lightpanda:latest

# Run with custom user agent
docker run -d -p 9222:9222 \
  --name lightpanda \
  lightpanda:latest \
  /bin/lightpanda serve \
  --host 0.0.0.0 \
  --port 9222 \
  --user-agent-suffix "Chrome/124.0.0.0 Safari/537.36"

# Run with proxy
docker run -d -p 9222:9222 \
  --name lightpanda \
  lightpanda:latest \
  /bin/lightpanda serve \
  --host 0.0.0.0 \
  --port 9222 \
  --http-proxy http://proxy.example.com:8080 \
  --proxy-bearer-token "your_token"
```

### 3. Native Build and Run

```bash
# Build lightpanda
make build

# Run server
./zig-out/bin/lightpanda serve --host 0.0.0.0 --port 9222
```

## Configuration Options

### Command-Line Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--host` | Server host address | `127.0.0.1` |
| `--port` | Server port | `9222` |
| `--user-agent-suffix` | Append to User-Agent | None |
| `--http-proxy` | HTTP proxy URL | None |
| `--proxy-bearer-token` | Proxy authentication token | None |
| `--tls-verify-host` | Enable TLS verification | `true` |
| `--http-timeout` | Request timeout (seconds) | `30` |
| `--http-connect-timeout` | Connection timeout (seconds) | `10` |
| `--http-max-concurrent` | Max concurrent requests | `100` |
| `--http-max-host-open` | Max connections per host | `6` |
| `--log-level` | Logging level (debug/info/warn/error) | `info` |
| `--log-format` | Log format (text/json) | `text` |

### Environment Variables (docker-compose)

See `.env.example` for all available environment variables.

## Anti-Bot Features

Lightpanda includes several anti-bot detection evasion features:

### 1. Document.all Undetectability
- `document.all` is marked as undetectable (falsy in boolean context)
- This is the most reliable anti-bot feature

```javascript
// In your scraper, this will return true (evading bot detection)
await page.evaluate(() => !document.all);
```

### 2. Custom User Agent
```bash
# Set realistic browser user agent
--user-agent-suffix "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
```

### 3. Fingerprinting Protection
- Event timestamps are coarsened
- Limited canvas API (prevents fingerprinting)
- Realistic navigator properties
- Standard WebGL extensions (39 extensions matching real browsers)

### 4. Request Interception
Use CDP Fetch domain to modify requests on-the-fly:
- Custom headers per request
- Cookie management
- Response modification

## Client Examples

### Puppeteer

```javascript
const puppeteer = require('puppeteer-core');

const browser = await puppeteer.connect({
  browserWSEndpoint: 'ws://localhost:9222'
});

const page = await browser.newPage();
await page.goto('https://example.com');
const title = await page.title();
console.log(title);

await browser.disconnect();
```

See `examples/puppeteer-example.js` for complete examples.

### Playwright

```javascript
const { chromium } = require('playwright-core');

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('https://example.com');
const title = await page.title();
console.log(title);

await browser.close();
```

See `examples/playwright-example.js` for complete examples.

## Production Deployment

### Docker Compose with Reverse Proxy (Nginx)

```yaml
version: '3.8'

services:
  lightpanda:
    build: .
    container_name: lightpanda
    expose:
      - 9222
    networks:
      - internal
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    networks:
      - internal
    depends_on:
      - lightpanda
    restart: unless-stopped

networks:
  internal:
    driver: bridge
```

### Security Considerations

1. **Network Isolation**: Run lightpanda in a private network
2. **Authentication**: Use nginx basic auth or API gateway for authentication
3. **Rate Limiting**: Implement rate limiting at nginx/gateway level
4. **TLS**: Always use HTTPS in production
5. **Monitoring**: Monitor resource usage and set limits

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lightpanda
spec:
  replicas: 3
  selector:
    matchLabels:
      app: lightpanda
  template:
    metadata:
      labels:
        app: lightpanda
    spec:
      containers:
      - name: lightpanda
        image: lightpanda:latest
        ports:
        - containerPort: 9222
        env:
        - name: USER_AGENT_SUFFIX
          value: "Chrome/124.0.0.0 Safari/537.36"
        resources:
          limits:
            memory: "2Gi"
            cpu: "2000m"
          requests:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: lightpanda-service
spec:
  selector:
    app: lightpanda
  ports:
  - protocol: TCP
    port: 9222
    targetPort: 9222
  type: LoadBalancer
```

## Monitoring and Health Checks

### Health Check Endpoint

```bash
# Check if server is running
curl http://localhost:9222/json/version
```

Response:
```json
{
  "Browser": "Lightpanda/1.0",
  "Protocol-Version": "1.3",
  "User-Agent": "Mozilla/5.0 ...",
  "V8-Version": "14.0.365.4",
  "WebKit-Version": "537.36"
}
```

### Docker Health Check

The docker-compose.yml includes a health check:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:9222/json/version"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Performance Tuning

### Resource Limits

```bash
# Limit concurrent requests
--http-max-concurrent 50

# Limit connections per host
--http-max-host-open 4

# Reduce timeout for faster failure
--http-timeout 15
```

### Docker Resource Limits

```yaml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 4G
    reservations:
      cpus: '2'
      memory: 1G
```

## Proxy Configuration

### HTTP Proxy

```bash
# Basic proxy
--http-proxy http://proxy.example.com:8080

# Authenticated proxy
--http-proxy http://proxy.example.com:8080 \
--proxy-bearer-token "your_api_token"
```

### Rotating Proxies

For rotating proxies, use the CDP Fetch API to intercept and modify requests:

```javascript
const client = await page.target().createCDPSession();
await client.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });

client.on('Fetch.requestPaused', async (event) => {
  // Set proxy per request
  await client.send('Fetch.continueRequest', {
    requestId: event.requestId,
    // Modify as needed
  });
});
```

## Troubleshooting

### Connection Refused
```bash
# Check if server is running
docker-compose ps

# Check logs
docker-compose logs lightpanda

# Verify port is exposed
netstat -tulpn | grep 9222
```

### High Memory Usage
- Reduce `--http-max-concurrent`
- Set Docker memory limits
- Close contexts/pages after use in client code

### Slow Performance
- Use request interception to block unnecessary resources
- Reduce `--http-timeout`
- Increase `--http-max-concurrent` if you have resources

### SSL/TLS Errors
```bash
# Disable verification (development only!)
--tls-verify-host false
```

## Scaling

### Horizontal Scaling
- Deploy multiple lightpanda instances
- Use load balancer to distribute connections
- Each instance can handle multiple concurrent browser contexts

### Connection Pool Management
```javascript
// Client-side connection pooling
class LightpandaPool {
  constructor(endpoints, maxConnections = 10) {
    this.endpoints = endpoints;
    this.connections = [];
    this.maxConnections = maxConnections;
  }

  async getConnection() {
    if (this.connections.length < this.maxConnections) {
      const endpoint = this.endpoints[this.connections.length % this.endpoints.length];
      const browser = await puppeteer.connect({
        browserWSEndpoint: endpoint
      });
      this.connections.push(browser);
      return browser;
    }
    return this.connections[Math.floor(Math.random() * this.connections.length)];
  }
}

const pool = new LightpandaPool([
  'ws://lightpanda-1:9222',
  'ws://lightpanda-2:9222',
  'ws://lightpanda-3:9222',
]);
```

## Support

- GitHub Issues: https://github.com/lightpanda-io/browser/issues
- Documentation: https://github.com/lightpanda-io/browser

## License

GNU Affero General Public License v3.0
