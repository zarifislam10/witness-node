# Witness-Node — Vultr Deploy

Production host: `https://104-238-130-123.sslip.io`

## Fresh server setup (Ubuntu 24.04+)

```bash
# 1. Install prerequisites
apt-get update
apt-get install -y python3-pip python3-venv python3-full git curl \
    debian-keyring debian-archive-keyring apt-transport-https

# 2. Install Caddy
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy

# 3. Clone + install
cd /opt
git clone https://github.com/zarifislam10/witness-node.git
cd witness-node/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Secrets (never committed)

Copy from your laptop:

```bash
scp backend/.env root@HOST:/opt/witness-node/backend/.env
scp ~/.config/solana/id.json root@HOST:/opt/witness-node/backend/solana-id.json
```

Then on the server, edit `/opt/witness-node/backend/.env`:

- `SOLANA_KEYPAIR_PATH=/opt/witness-node/backend/solana-id.json`
- `PUBLIC_BASE_URL=https://<your-sslip-hostname>`

## Services

```bash
# systemd unit for uvicorn
cp deploy/witness-backend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now witness-backend

# Caddy reverse proxy with auto-HTTPS
cp deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy

# Firewall
ufw allow 80/tcp
ufw allow 443/tcp
```

## Verify

```bash
curl https://104-238-130-123.sslip.io/health
```

## Updating

```bash
cd /opt/witness-node && git pull
cd backend && source .venv/bin/activate && pip install -r requirements.txt
systemctl restart witness-backend
```
