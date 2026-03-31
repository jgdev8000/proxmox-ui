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
