#!/usr/bin/env bash
set -euo pipefail

APP_USER="${APP_USER:-tagam-accounting}"
APP_DIR="${APP_DIR:-/opt/tagam-accounting}"
ENV_FILE="${ENV_FILE:-/etc/tagam-accounting.env}"
SERVICE_NAME="${SERVICE_NAME:-tagam-accounting-api}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
RELEASE_ARCHIVE="${1:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this installer as root, for example: sudo bash deploy/vps/install.sh" >&2
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required. Install Node.js first, then rerun this installer." >&2
  exit 2
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "Node.js 20+ is required. Current version: $(node -v)" >&2
  exit 2
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required." >&2
  exit 2
fi

if [[ -n "$RELEASE_ARCHIVE" ]]; then
  if [[ ! -f "$RELEASE_ARCHIVE" ]]; then
    echo "Release archive was not found: $RELEASE_ARCHIVE" >&2
    exit 2
  fi

  command -v unzip >/dev/null 2>&1 || {
    apt-get update
    apt-get install -y unzip
  }

  SOURCE_DIR="$(mktemp -d)"
  unzip -q "$RELEASE_ARCHIVE" -d "$SOURCE_DIR"
else
  SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi

if [[ ! -f "$SOURCE_DIR/package.json" ]]; then
  echo "Source directory does not look like the TAGAM Accounting repository: $SOURCE_DIR" >&2
  exit 2
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required. Install it with: apt-get install -y rsync" >&2
  exit 2
fi

if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
fi

install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR"

rsync -a --delete \
  --exclude ".git" \
  --exclude ".deploy" \
  --exclude ".env" \
  --exclude "node_modules" \
  "$SOURCE_DIR"/ "$APP_DIR"/

chown -R "$APP_USER:$APP_USER" "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  install -m 0640 -o root -g "$APP_USER" "$APP_DIR/deploy/vps/env.example" "$ENV_FILE"
  echo "Created $ENV_FILE. Edit DATABASE_URL and rerun this installer." >&2
  exit 2
fi

if grep -q "CHANGE_ME" "$ENV_FILE"; then
  echo "Edit $ENV_FILE and replace CHANGE_ME before starting the service." >&2
  exit 2
fi

NPM_BIN="$(command -v npm)"
sed \
  -e "s#__APP_DIR__#${APP_DIR}#g" \
  -e "s#__APP_USER__#${APP_USER}#g" \
  -e "s#__ENV_FILE__#${ENV_FILE}#g" \
  -e "s#__NPM_BIN__#${NPM_BIN}#g" \
  "$APP_DIR/deploy/vps/tagam-accounting-api.service" > "$SERVICE_FILE"

systemctl daemon-reload

runuser -u "$APP_USER" -- bash -lc "cd '$APP_DIR' && npm ci"
runuser -u "$APP_USER" -- bash -lc "cd '$APP_DIR' && set -a && source '$ENV_FILE' && set +a && npm run db:migrate"

systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo "Service started: $SERVICE_NAME"
systemctl --no-pager --full status "$SERVICE_NAME" || true
