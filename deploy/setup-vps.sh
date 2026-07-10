#!/usr/bin/env bash
# One-time setup for deploying this app on a fresh Ubuntu 22.04/24.04 VPS,
# with GitHub Actions auto-deploying on every push to main.
#
# Run this ONCE, directly on the VPS, as a user with sudo access:
#   bash setup-vps.sh
#
# It does NOT need your VPS password to be shared with anyone — it
# generates its own SSH keys locally and prints out exactly what to paste
# into GitHub, in your own browser.

set -euo pipefail

APP_DIR="/var/www/say-hello"
APP_NAME="say-hello"
NODE_MAJOR=20
APP_PORT=3000
DEPLOY_USER="$(whoami)"

echo "==> Installing base packages (git, nginx, curl)…"
sudo apt-get update -y
sudo apt-get install -y git nginx curl build-essential

echo "==> Installing Node.js ${NODE_MAJOR}.x…"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v
npm -v

echo "==> Installing PM2 (keeps the app running, restarts on crash/reboot)…"
sudo npm install -g pm2

# ---------------------------------------------------------------------------
# Key 1: lets GitHub Actions SSH into THIS server to trigger a deploy.
# Private half -> GitHub Secret. Public half -> this server's authorized_keys.
# ---------------------------------------------------------------------------
GH_ACTIONS_KEY="$HOME/.ssh/gh_actions_deploy"
if [ ! -f "$GH_ACTIONS_KEY" ]; then
  echo "==> Generating deploy key (GitHub Actions -> this VPS)…"
  mkdir -p "$HOME/.ssh"
  ssh-keygen -t ed25519 -f "$GH_ACTIONS_KEY" -N "" -C "github-actions-deploy"
  cat "${GH_ACTIONS_KEY}.pub" >> "$HOME/.ssh/authorized_keys"
  chmod 600 "$HOME/.ssh/authorized_keys"
fi

# ---------------------------------------------------------------------------
# Key 2: lets THIS server pull the private repo from GitHub.
# Private half stays on this server. Public half -> GitHub "Deploy keys".
# ---------------------------------------------------------------------------
REPO_PULL_KEY="$HOME/.ssh/repo_pull_key"
if [ ! -f "$REPO_PULL_KEY" ]; then
  echo "==> Generating repo pull key (this VPS -> GitHub)…"
  ssh-keygen -t ed25519 -f "$REPO_PULL_KEY" -N "" -C "vps-repo-pull"
fi

cat >> "$HOME/.ssh/config" <<EOF

Host github.com-say-hello
  HostName github.com
  User git
  IdentityFile ${REPO_PULL_KEY}
  IdentitiesOnly yes
EOF

echo "==> Setting up app directory at ${APP_DIR}…"
sudo mkdir -p "$APP_DIR"
sudo chown "$DEPLOY_USER":"$DEPLOY_USER" "$APP_DIR"

echo "==> Configuring Nginx reverse proxy (port 80 -> ${APP_PORT})…"
sudo tee /etc/nginx/sites-available/${APP_NAME} > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/${APP_NAME}
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "=============================================================="
echo " STEP 1 — Add this as a GitHub Deploy Key (read-only) at:"
echo " https://github.com/<your-username>/<your-repo>/settings/keys"
echo "=============================================================="
cat "${REPO_PULL_KEY}.pub"
echo ""
echo "=============================================================="
echo " STEP 2 — Add this as a GitHub Actions Secret named VPS_SSH_KEY at:"
echo " https://github.com/<your-username>/<your-repo>/settings/secrets/actions"
echo "=============================================================="
cat "$GH_ACTIONS_KEY"
echo ""
echo "=============================================================="
echo " STEP 3 — Also add these two secrets:"
echo "   VPS_HOST = $(curl -s ifconfig.me || echo 'YOUR_SERVER_IP')"
echo "   VPS_USER = ${DEPLOY_USER}"
echo "=============================================================="
echo ""
echo "Then clone the repo once by hand (replace the URL):"
echo "  git clone github.com-say-hello:YOUR_USERNAME/say-hello.git ${APP_DIR}"
echo ""
echo "After that, every 'git push' to main will auto-deploy via GitHub Actions."
