# Proxmox Panel

A self-service web frontend for Proxmox VE that gives users access to only their VMs/containers. Features include console access (noVNC), basic monitoring, and start/stop/restart controls.

## Features

- **Per-user access** — users log in with Proxmox credentials and only see VMs they have permission to access
- **Console** — browser-based noVNC console with fullscreen and Ctrl+Alt+Del
- **Monitoring** — CPU, memory, network, and disk I/O charts
- **Power controls** — start, stop, shutdown, reboot
- **Dashboard** — table view with live CPU/RAM/disk usage bars, uptime, and status indicators

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Recharts, noVNC
- **Backend**: Node.js, Express, WebSocket proxy
- **Auth**: Proxmox native (PAM or PVE realm)

## Prerequisites

- Node.js 20+
- A Proxmox VE server with API access (port 8006)

## Quick Start

### 1. Install Node.js

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
```

### 2. Clone and install

```bash
cd ~/proxmox-panel
npm install
cd client && npm install && cd ..
```

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env` with your values:

```
PROXMOX_HOST=192.168.1.100
PROXMOX_PORT=8006
SESSION_SECRET=your-random-string-here
PORT=3000
```

Generate a session secret with:

```bash
openssl rand -hex 32
```

### 4. Build and run

```bash
npm run build
npm start
```

The panel will be available at `http://your-server:3000`.

### Development mode

```bash
npm run dev
```

This starts both the Vite dev server (port 5173) and the Express backend (port 3000) with hot reload.

## Deploying to Another Server

### Copy the project

From the source server:

```bash
cd ~/proxmox-panel
tar --exclude=node_modules -czf /tmp/proxmox-panel.tar.gz .
scp /tmp/proxmox-panel.tar.gz user@new-server:/tmp/
```

On the new server:

```bash
mkdir ~/proxmox-panel && cd ~/proxmox-panel
tar xzf /tmp/proxmox-panel.tar.gz
npm install
cd client && npm install && cd ..
npm run build
```

Then configure `.env` and start as described above.

### Run as a systemd service

Create `/etc/systemd/system/proxmox-panel.service`:

```ini
[Unit]
Description=Proxmox Panel
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/proxmox-panel
ExecStart=/home/youruser/.nvm/versions/node/v20.20.2/bin/node server/index.js
Environment=NODE_ENV=production
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now proxmox-panel
sudo systemctl status proxmox-panel
```

View logs with:

```bash
journalctl -u proxmox-panel -f
```

## Proxmox User Setup

Users authenticate with their Proxmox credentials. To control which VMs a user can see:

### Create a user

```bash
pveum user add john@pve -comment "John Doe"
pveum passwd john@pve
```

### Assign VM access via resource pools

```bash
pveum pool add customer-john
pveum pool modify customer-john -vms 100,101,102
pveum acl modify /pool/customer-john -user john@pve -role PVEVMUser
```

### Or assign per-VM access directly

```bash
pveum acl modify /vms/100 -user john@pve -role PVEVMUser
```

### Built-in roles

| Role | Permissions |
|------|-------------|
| `PVEVMUser` | Console, start, stop, shutdown, reboot |
| `PVEVMAdmin` | Above + modify VM config |
| `PVEAuditor` | View only, no actions |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PROXMOX_HOST` | Proxmox server IP or hostname | `127.0.0.1` |
| `PROXMOX_PORT` | Proxmox API port | `8006` |
| `SESSION_SECRET` | Secret for session cookies | `change-me` |
| `PORT` | Port the panel listens on | `3000` |
