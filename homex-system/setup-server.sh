#!/bin/bash
set -e

echo "========================================"
echo "   Homex System - Server Setup Script"
echo "========================================"

# 1. Update system
echo "[1/5] Updating system..."
apt update && apt upgrade -y

# 2. Install Docker
echo "[2/5] Installing Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# 3. Install Docker Compose plugin
echo "[3/5] Installing Docker Compose..."
apt install -y docker-compose-plugin git

# 4. Clone the repository
echo "[4/5] Cloning Homex repository..."
cd /root
if [ -d "Homex.emp" ]; then
  cd Homex.emp && git fetch origin && git checkout claude/session-vq7i9k && git pull origin claude/session-vq7i9k
else
  git clone https://github.com/reyad848131-pixel/Homex.emp.git
  cd Homex.emp
  git checkout claude/session-vq7i9k
fi

# 5. Setup and start
echo "[5/5] Setting up and starting..."
cd homex-system

# Switch prisma to PostgreSQL for production
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma

# Create production .env
cat > .env.production <<'ENVEOF'
DB_USER=homex
DB_PASSWORD=HomexSecure2024!
DB_NAME=homex_prod
NEXTAUTH_SECRET=hX9kP2mN7vQ4wR8tY1uJ6oL3iE5aD0fG
NEXTAUTH_URL=http://65.20.80.207
PORT=3000
ENVEOF

# Create nginx config directory
mkdir -p nginx/ssl

# Create nginx config (HTTP only for now)
cat > nginx/nginx.conf <<'NGEOF'
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    server {
        listen 80;
        server_name 65.20.80.207;

        client_max_body_size 10M;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
NGEOF

# Create empty SSL dir placeholder
touch nginx/ssl/.keep

# Build and start with production env
echo "Building Docker containers (this may take 5-10 minutes)..."
docker compose --env-file .env.production up -d --build

echo ""
echo "========================================"
echo "   Setup Complete!"
echo "========================================"
echo ""
echo "   Open in browser: http://65.20.80.207"
echo ""
echo "   Login credentials:"
echo "   --------------------"
echo "   Admin:   Civil ID: 2016  |  Password: 2016"
echo "   Manager: Civil ID: 1389  |  Password: 1389"
echo "   Sales:   Civil ID: 1383  |  Password: 1383"
echo ""
echo "========================================"
