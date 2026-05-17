# VPS Deployment

This folder contains the production-oriented VPS setup for the optional TAGAM Accounting module.

The service is designed to run as a separate online API behind Nginx:

- API process: `tagam-accounting-api`
- Default local port: `4010`
- Default app directory: `/opt/tagam-accounting`
- Default env file: `/etc/tagam-accounting.env`
- Suggested domain: `accounting.tagam.delivery`

No secrets are stored in this repository. Put production credentials only into the server env file.

## 1. Prepare PostgreSQL

If PostgreSQL already exists on the VPS, create a dedicated database and user:

```bash
export DATABASE_NAME=tagam_accounting
export DATABASE_USER=tagam_accounting
export DATABASE_PASSWORD='change-this-before-running'
sudo -E bash deploy/vps/create-postgres-db.sh
```

Then set the matching `DATABASE_URL` in `/etc/tagam-accounting.env`.

For a managed PostgreSQL database, skip this step and use the managed connection URL.

## 2. Create Environment File

```bash
sudo install -m 0640 -o root -g www-data deploy/vps/env.example /etc/tagam-accounting.env
sudo nano /etc/tagam-accounting.env
```

Required values:

```bash
DATABASE_URL=postgres://tagam_accounting:password@127.0.0.1:5432/tagam_accounting
API_HOST=127.0.0.1
API_PORT=4010
NODE_ENV=production
```

## 3. Install API Service

From the unpacked repository on the VPS:

```bash
sudo bash deploy/vps/install.sh
```

The installer:

- verifies Node.js 20+
- copies the app to `/opt/tagam-accounting`
- installs npm dependencies
- runs database migrations
- installs and starts the systemd service

Check status:

```bash
systemctl status tagam-accounting-api --no-pager
curl http://127.0.0.1:4010/health
```

## 4. Configure Nginx

Copy the Nginx template:

```bash
sudo cp deploy/vps/nginx-accounting.tagam.delivery.conf /etc/nginx/sites-available/accounting.tagam.delivery.conf
sudo ln -s /etc/nginx/sites-available/accounting.tagam.delivery.conf /etc/nginx/sites-enabled/accounting.tagam.delivery.conf
sudo nginx -t
sudo systemctl reload nginx
```

Issue a certificate after DNS points to the VPS:

```bash
sudo certbot --nginx -d accounting.tagam.delivery
```

If this VPS uses FastPanel-managed Nginx includes, place the proxy block in the relevant FastPanel vhost instead of enabling the file directly.

## 5. Package From Windows

From the local repo:

```powershell
.\deploy\vps\deploy.ps1
```

To upload through an existing SSH setup:

```powershell
$env:VPS_HOST="server.example.com"
$env:VPS_USER="root"
.\deploy\vps\deploy.ps1 -Upload
```

The script does not handle passwords. Use SSH keys, an existing agent, or enter the password into the SSH prompt if your terminal asks for it.
