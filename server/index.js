import express from 'express';
import session from 'express-session';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'node:http';
import config from './config.js';
import authRoutes from './routes/auth.js';
import vmRoutes from './routes/vms.js';
import consoleRoutes from './routes/console.js';
import adminRoutes from './routes/admin.js';
import requireAuth from './middleware/auth.js';
import { setupWebSocket } from './ws.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

// Session middleware (shared with WebSocket upgrade)
const sessionMiddleware = session({
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // set true behind HTTPS reverse proxy
    maxAge: 2 * 60 * 60 * 1000, // 2 hours (matches Proxmox ticket TTL)
  },
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

// Serve user logos
app.use('/logos', express.static(path.join(__dirname, '..', 'logos')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/vms', requireAuth, vmRoutes);
app.use('/api/console', requireAuth, consoleRoutes);
app.use('/api/admin', requireAuth, adminRoutes);

// Debug: test node vncwebsocket endpoint
import axios from 'axios';
import https from 'node:https';
app.get('/api/debug/test-ws/:node', requireAuth, async (req, res) => {
  const { node } = req.params;
  const { ticket, csrfToken } = req.session.pve;
  try {
    // First create a termproxy
    const { createClient } = await import('./services/proxmox.js');
    const client = createClient(ticket, csrfToken);
    const { data: termData } = await client.post(`/nodes/${node}/termproxy`, new URLSearchParams({}));
    const port = termData.data.port;
    const vncticket = termData.data.ticket;

    // Now try a regular GET to vncwebsocket
    const url = `https://${config.proxmox.host}:${config.proxmox.port}/api2/json/nodes/${node}/vncwebsocket?port=${port}&vncticket=${encodeURIComponent(vncticket)}`;
    try {
      const wsRes = await axios.get(url, {
        headers: { Cookie: `PVEAuthCookie=${ticket}` },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      });
      res.json({ termproxy: termData.data, vncwebsocket: wsRes.data, url });
    } catch (err2) {
      res.json({
        termproxy: termData.data,
        vncwebsocket_error: {
          status: err2.response?.status,
          statusText: err2.response?.statusText,
          data: err2.response?.data,
          headers: err2.response?.headers,
        },
        url,
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message, data: err.response?.data });
  }
});

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// WebSocket proxy for noVNC
setupWebSocket(server, sessionMiddleware);

server.listen(config.port, '0.0.0.0', () => {
  console.log(`Proxmox Panel server running on http://0.0.0.0:${config.port}`);
});
