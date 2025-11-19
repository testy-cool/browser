# Deploy Lightpanda on Hetzner Cloud

Complete tutorial for deploying Lightpanda as a web scraping server on Hetzner Cloud.

## Prerequisites

- Hetzner Cloud account (https://www.hetzner.com/cloud)
- SSH key pair
- Basic command line knowledge

## Step 1: Create a Hetzner Cloud Server

### 1.1 Log into Hetzner Console

1. Go to https://console.hetzner.cloud/
2. Create a new project or select existing one
3. Click "Add Server"

### 1.2 Choose Server Configuration

**Recommended configurations:**

**Budget Option (Testing/Light Scraping):**
- **Location:** Choose closest to your target websites (e.g., Nuremberg for EU, Ashburn for US)
- **Image:** Ubuntu 22.04 (or latest LTS)
- **Type:** CPX11 (2 vCPU, 2 GB RAM) - €4.51/month
- **Volume:** None needed
- **Network:** Default

**Production Option (Heavy Scraping):**
- **Location:** Nuremberg or Falkenstein (EU) or Ashburn/Hillsboro (US)
- **Image:** Ubuntu 22.04
- **Type:** CPX31 (4 vCPU, 8 GB RAM) - €15.30/month
- **Volume:** Optional 10GB for logs
- **Network:** Default

**High-Performance Option:**
- **Type:** CPX41 (8 vCPU, 16 GB RAM) - €30.60/month

### 1.3 Configure Server

1. **SSH Key:** Add your SSH public key (or create new one)
2. **Firewall:** We'll configure this next
3. **User Data:** Leave empty for now
4. **Name:** `lightpanda-scraper-01`

### 1.4 Create Firewall Rules

Click "Create Firewall" and add these rules:

**Inbound Rules:**
```
- SSH (Port 22) from Your IP only
- Custom TCP (Port 9222) from Your IP only (or specific IPs that need access)
```

**Outbound Rules:**
```
- Allow all (needed for scraping external websites)
```

### 1.5 Launch Server

1. Click "Create & Buy now"
2. Wait 30-60 seconds for server to provision
3. Note the server's IP address

## Step 2: Initial Server Setup

### 2.1 Connect to Your Server

```bash
# Replace with your server IP
ssh root@YOUR_SERVER_IP
```

### 2.2 Update System

```bash
apt update && apt upgrade -y
```

### 2.3 Create Non-Root User (Optional but Recommended)

```bash
# Create user
adduser lightpanda

# Add to sudo group
usermod -aG sudo lightpanda

# Copy SSH keys
rsync --archive --chown=lightpanda:lightpanda ~/.ssh /home/lightpanda

# Switch to new user
su - lightpanda
```

## Step 3: Install Docker and Docker Compose

### 3.1 Install Docker

```bash
# Install dependencies
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package index
sudo apt update

# Install Docker
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Add your user to docker group (skip if using root)
sudo usermod -aG docker $USER

# Apply group changes (or logout/login)
newgrp docker

# Verify installation
docker --version
```

### 3.2 Install Docker Compose

```bash
# Download Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

## Step 4: Deploy Lightpanda

### 4.1 Clone Repository

```bash
# Install git if not present
sudo apt install -y git

# Clone the repository
git clone https://github.com/lightpanda-io/browser.git
cd browser
```

### 4.2 Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration
nano .env
```

**Recommended Hetzner configuration:**

```bash
# Server Configuration
LIGHTPANDA_PORT=9222
TZ=Europe/Berlin  # or your timezone

# Anti-Bot Configuration
USER_AGENT_SUFFIX=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36

# Optional: Use Proxy Service
# HTTP_PROXY=http://proxy.example.com:8080
# PROXY_BEARER_TOKEN=your_token_here

# Performance Tuning
HTTP_TIMEOUT=30
HTTP_MAX_CONCURRENT=100
HTTP_MAX_HOST_OPEN=6

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

Save with `Ctrl+O`, `Enter`, `Ctrl+X`

### 4.3 Build and Start

```bash
# Build the Docker image (this takes 15-30 minutes)
docker-compose build

# Start the service
docker-compose up -d

# Check if it's running
docker-compose ps

# View logs
docker-compose logs -f lightpanda
```

### 4.4 Verify Deployment

```bash
# Test from the server itself
curl http://localhost:9222/json/version

# Should return JSON with browser info
```

## Step 5: Access from Your Local Machine

### 5.1 Option A: Direct Access (Simple, Less Secure)

If you configured firewall to allow your IP:

```javascript
// From your local machine
const browser = await puppeteer.connect({
  browserWSEndpoint: 'ws://YOUR_SERVER_IP:9222'
});
```

### 5.2 Option B: SSH Tunnel (Recommended, More Secure)

Keep port 9222 blocked in firewall, use SSH tunnel:

```bash
# On your local machine, create SSH tunnel
ssh -N -L 9222:localhost:9222 root@YOUR_SERVER_IP

# Now connect to localhost in your scraper
# browserWSEndpoint: 'ws://localhost:9222'
```

**Make it persistent with autossh:**

```bash
# On local machine
brew install autossh  # macOS
# or
sudo apt install autossh  # Linux

# Create persistent tunnel
autossh -M 0 -N -L 9222:localhost:9222 root@YOUR_SERVER_IP
```

### 5.3 Option C: Nginx with Basic Auth (Production)

Install nginx on the server:

```bash
sudo apt install -y nginx apache2-utils

# Create password file
sudo htpasswd -c /etc/nginx/.htpasswd scraper
# Enter password when prompted

# Create nginx config
sudo nano /etc/nginx/sites-available/lightpanda
```

Add this configuration:

```nginx
upstream lightpanda {
    server localhost:9222;
}

server {
    listen 80;
    server_name YOUR_SERVER_IP;

    location / {
        auth_basic "Lightpanda Access";
        auth_basic_user_file /etc/nginx/.htpasswd;

        proxy_pass http://lightpanda;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

Enable and restart:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/lightpanda /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx

# Update firewall to allow HTTP
# In Hetzner Console: Add inbound rule for port 80
```

Connect with auth:

```javascript
const browser = await puppeteer.connect({
  browserWSEndpoint: 'ws://scraper:PASSWORD@YOUR_SERVER_IP'
});
```

## Step 6: Test Your Deployment

### 6.1 Copy Example Scripts to Server

```bash
# On server
cd ~/browser/examples
npm install

# Edit examples to use localhost
nano puppeteer-example.js
# Change: browserWSEndpoint: 'ws://localhost:9222'

# Run test
npm run puppeteer
```

### 6.2 Test from Local Machine

Copy `examples/` folder to your local machine and run:

```bash
# On local machine
cd examples
npm install

# Edit connection endpoint
# Change to: 'ws://YOUR_SERVER_IP:9222'
# or 'ws://localhost:9222' if using SSH tunnel

npm run puppeteer
```

## Step 7: Production Hardening

### 7.1 Enable UFW Firewall (Additional Layer)

```bash
# Enable UFW
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 9222/tcp  # Only if needed
sudo ufw enable

# Check status
sudo ufw status
```

### 7.2 Install Fail2Ban (Protect SSH)

```bash
sudo apt install -y fail2ban

# Start service
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

### 7.3 Setup Automatic Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 7.4 Configure Log Rotation

```bash
sudo nano /etc/docker/daemon.json
```

Add:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Restart Docker:

```bash
sudo systemctl restart docker
docker-compose up -d
```

### 7.5 Setup Monitoring

Create a simple monitoring script:

```bash
nano ~/monitor.sh
```

```bash
#!/bin/bash

# Check if Lightpanda is running
if ! docker-compose -f ~/browser/docker-compose.yml ps | grep -q "Up"; then
    echo "Lightpanda is down! Restarting..."
    cd ~/browser
    docker-compose up -d
    echo "Lightpanda restarted at $(date)" >> ~/monitor.log
fi
```

Make executable and add to crontab:

```bash
chmod +x ~/monitor.sh

# Add to crontab (check every 5 minutes)
crontab -e

# Add this line:
*/5 * * * * /home/lightpanda/monitor.sh
```

## Step 8: Scaling and Load Balancing

### 8.1 Deploy Multiple Instances

Create multiple servers following the same steps, then use a load balancer.

**Option 1: Hetzner Load Balancer**

1. In Hetzner Console, go to Load Balancers
2. Create new Load Balancer
3. Add your Lightpanda servers as targets
4. Configure health check: `http://target:9222/json/version`
5. Use load balancer IP in your scrapers

**Option 2: Client-Side Load Balancing**

```javascript
// Round-robin across multiple servers
class LightpandaCluster {
  constructor(endpoints) {
    this.endpoints = endpoints;
    this.currentIndex = 0;
  }

  getEndpoint() {
    const endpoint = this.endpoints[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;
    return endpoint;
  }

  async connect() {
    const endpoint = this.getEndpoint();
    return await puppeteer.connect({
      browserWSEndpoint: endpoint
    });
  }
}

const cluster = new LightpandaCluster([
  'ws://server1.example.com:9222',
  'ws://server2.example.com:9222',
  'ws://server3.example.com:9222',
]);

const browser = await cluster.connect();
```

### 8.2 Use Hetzner Volumes for Persistent Storage

```bash
# Create volume in Hetzner Console (e.g., 10GB)
# Attach to server

# Format and mount
sudo mkfs.ext4 /dev/disk/by-id/scsi-0HC_Volume_XXXXX
sudo mkdir /mnt/logs
sudo mount /dev/disk/by-id/scsi-0HC_Volume_XXXXX /mnt/logs

# Add to fstab for persistence
echo '/dev/disk/by-id/scsi-0HC_Volume_XXXXX /mnt/logs ext4 defaults 0 0' | sudo tee -a /etc/fstab

# Update docker-compose.yml to use volume
nano ~/browser/docker-compose.yml
```

Add volume mount:

```yaml
services:
  lightpanda:
    # ... existing config ...
    volumes:
      - /mnt/logs:/var/log/lightpanda
```

## Step 9: Backup and Recovery

### 9.1 Backup Configuration

```bash
# Create backup script
nano ~/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/root/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup .env and docker-compose.yml
tar -czf $BACKUP_DIR/lightpanda_config_$DATE.tar.gz \
    /home/lightpanda/browser/.env \
    /home/lightpanda/browser/docker-compose.yml

# Keep only last 7 backups
ls -t $BACKUP_DIR/lightpanda_config_*.tar.gz | tail -n +8 | xargs rm -f
```

```bash
chmod +x ~/backup.sh

# Run daily via cron
crontab -e
# Add: 0 2 * * * /root/backup.sh
```

### 9.2 Create Hetzner Snapshot

1. In Hetzner Console, select your server
2. Click "Create Snapshot"
3. Name it (e.g., `lightpanda-working-2024-01`)
4. Create snapshot (server will reboot briefly)

This allows instant recovery if something goes wrong.

## Step 10: Cost Optimization

### 10.1 Use Hetzner Cloud Snapshots Instead of Keeping Server Running

For intermittent scraping:

1. Stop server when not in use: `docker-compose down`
2. Create snapshot before stopping
3. Delete server (saves money)
4. Recreate from snapshot when needed (1-2 minutes)

### 10.2 Use Spot Instances (If Available)

Currently Hetzner doesn't offer spot instances, but check for any promotions.

### 10.3 Monitor Resource Usage

```bash
# Install monitoring tools
sudo apt install -y htop iotop nethogs

# Check resources
htop          # CPU/Memory
docker stats  # Container resources
```

Downgrade server type if consistently under 50% usage.

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs lightpanda

# Rebuild image
docker-compose build --no-cache
docker-compose up -d
```

### Out of Memory

```bash
# Check memory
free -h

# Add swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Can't Connect Remotely

```bash
# Check if service is running
docker-compose ps

# Check if port is open
sudo netstat -tlnp | grep 9222

# Check Hetzner firewall rules in console

# Test locally
curl http://localhost:9222/json/version
```

### High Bandwidth Usage

Check Hetzner Console for traffic graph. If exceeding limits:

1. Block unnecessary resources in your scrapers
2. Use request caching
3. Implement rate limiting

### Server Running Slow

```bash
# Check CPU usage
htop

# Check disk I/O
iotop

# Check network
nethogs

# Restart container
docker-compose restart
```

## Cost Estimate Examples

### Light Usage (Testing/Development)
- **Server:** CPX11 (2 vCPU, 2GB) - €4.51/month
- **Traffic:** ~1TB included
- **Backups:** 1 snapshot - €0.014/GB/month (~€0.10)
- **Total:** ~€5/month

### Medium Usage (Production)
- **Server:** CPX31 (4 vCPU, 8GB) - €15.30/month
- **Volume:** 10GB - €0.45/month
- **Load Balancer:** Optional - €5.83/month
- **Backups:** 2 snapshots - €0.20
- **Total:** ~€16-22/month

### Heavy Usage (High Volume)
- **Servers:** 3x CPX31 - €45.90/month
- **Load Balancer:** €5.83/month
- **Volumes:** 3x 10GB - €1.35/month
- **Backups:** €0.60/month
- **Total:** ~€54/month

## Next Steps

1. ✅ Server deployed and running
2. ✅ Lightpanda accessible
3. ✅ Security configured
4. 📝 Set up monitoring alerts (email/Slack)
5. 📝 Configure auto-scaling (if needed)
6. 📝 Set up development/staging environment

## Useful Commands

```bash
# Start service
docker-compose up -d

# Stop service
docker-compose down

# View logs
docker-compose logs -f

# Restart service
docker-compose restart

# Rebuild after changes
docker-compose up -d --build

# Check resource usage
docker stats

# Clean up old images
docker system prune -a

# Update from git
cd ~/browser
git pull
docker-compose up -d --build
```

## Support and Resources

- **Lightpanda Docs:** https://github.com/lightpanda-io/browser
- **Hetzner Docs:** https://docs.hetzner.com/
- **Hetzner Status:** https://status.hetzner.com/
- **Community:** https://github.com/lightpanda-io/browser/issues

## Security Notes

⚠️ **Important Security Reminders:**

1. Never expose port 9222 publicly without authentication
2. Always use SSH keys, never password authentication
3. Keep your server updated regularly
4. Use SSH tunnel or nginx auth for production
5. Monitor server logs for suspicious activity
6. Use Hetzner's firewall in addition to UFW
7. Regularly backup your configuration
8. Use strong passwords for nginx basic auth
9. Consider using VPN for additional security layer
10. Keep Docker and Docker Compose updated

---

Need help? Check the main [DEPLOYMENT.md](DEPLOYMENT.md) for more details or open an issue on GitHub.
