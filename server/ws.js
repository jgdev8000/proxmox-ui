import { WebSocketServer, WebSocket } from 'ws';
import https from 'node:https';
import crypto from 'node:crypto';
import config from './config.js';

function connectToProxmoxWS(targetPath, ticket, callback) {
  const key = crypto.randomBytes(16).toString('base64');

  const options = {
    hostname: config.proxmox.host,
    port: config.proxmox.port,
    path: targetPath,
    method: 'GET',
    rejectUnauthorized: false,
    headers: {
      'Connection': 'Upgrade',
      'Upgrade': 'websocket',
      'Sec-WebSocket-Version': '13',
      'Sec-WebSocket-Key': key,
      'Sec-WebSocket-Protocol': 'binary',
      'Cookie': `PVEAuthCookie=${ticket}`,
      'Host': `${config.proxmox.host}:${config.proxmox.port}`,
      'Origin': `https://${config.proxmox.host}:${config.proxmox.port}`,
    },
  };

  console.log(`[ws] Raw upgrade request to: ${options.hostname}:${options.port}${targetPath.split('?')[0]}`);

  const req = https.request(options);

  req.on('upgrade', (res, socket, head) => {
    console.log(`[ws] Upgrade successful`);
    callback(null, socket);
  });

  req.on('response', (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      console.error(`[ws] Upgrade rejected: ${res.statusCode} ${res.statusMessage}`);
      console.error(`[ws] Response headers:`, JSON.stringify(res.headers));
      console.error(`[ws] Response body: ${body}`);
      callback(new Error(`Upgrade rejected: ${res.statusCode}`));
    });
  });

  req.on('error', (err) => {
    console.error(`[ws] Request error: ${err.message}`);
    callback(err);
  });

  req.end();
}

export function setupWebSocket(server, sessionMiddleware) {
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: () => 'binary',
  });

  server.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/api/console/ws')) {
      return;
    }

    const res = {
      setHeader() {},
      writeHead() {},
      end() {},
    };

    sessionMiddleware(req, res, () => {
      if (!req.session?.pve) {
        console.error('[ws] No session, rejecting upgrade');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    });
  });

  wss.on('connection', (clientWs, req) => {
    const url = new URL(req.url, 'http://localhost');
    const node = url.searchParams.get('node');
    const type = url.searchParams.get('type') || 'qemu';
    const vmid = url.searchParams.get('vmid');
    const port = url.searchParams.get('port');
    const vncticket = url.searchParams.get('vncticket');

    if (!node || !port || !vncticket) {
      console.error('[ws] Missing params:', { node, vmid, port, vncticket: !!vncticket });
      clientWs.close(1008, 'Missing parameters');
      return;
    }

    const { ticket } = req.session.pve;

    const basePath = vmid
      ? `/api2/json/nodes/${node}/${type}/${vmid}/vncwebsocket`
      : `/api2/json/nodes/${node}/vncwebsocket`;

    const targetPath = `${basePath}?port=${port}&vncticket=${encodeURIComponent(vncticket)}`;

    connectToProxmoxWS(targetPath, ticket, (err, pveSocket) => {
      if (err) {
        clientWs.close();
        return;
      }

      // Raw TCP socket from the upgraded connection — pipe data bidirectionally
      pveSocket.on('data', (data) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data);
        }
      });

      clientWs.on('message', (data) => {
        if (!pveSocket.destroyed) {
          pveSocket.write(data);
        }
      });

      pveSocket.on('close', () => clientWs.close());
      pveSocket.on('error', (e) => {
        console.error(`[ws] PVE socket error: ${e.message}`);
        clientWs.close();
      });
      clientWs.on('close', () => pveSocket.destroy());
      clientWs.on('error', () => pveSocket.destroy());
    });
  });
}
