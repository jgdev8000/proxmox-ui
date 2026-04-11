import { WebSocketServer, WebSocket, createWebSocketStream } from 'ws';
import https from 'node:https';
import crypto from 'node:crypto';
import config from './config.js';

function connectToProxmoxWS(targetPath, ticket) {
  return new Promise((resolve, reject) => {
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

    console.log(`[ws] Raw upgrade to: ${options.hostname}:${options.port}${targetPath.split('?')[0]}`);

    const req = https.request(options);

    req.on('upgrade', (res, socket, head) => {
      console.log(`[ws] Upgrade successful, wrapping in WebSocket`);
      // Wrap the raw socket in a ws WebSocket object
      const pveWs = new WebSocket(null);
      pveWs.setSocket(socket, head, {
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: true,
      });
      resolve(pveWs);
    });

    req.on('response', (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        console.error(`[ws] Upgrade rejected: ${res.statusCode} - ${body}`);
        reject(new Error(`Upgrade rejected: ${res.statusCode}`));
      });
    });

    req.on('error', (err) => {
      console.error(`[ws] Request error: ${err.message}`);
      reject(err);
    });

    req.end();
  });
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
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    });
  });

  wss.on('connection', async (clientWs, req) => {
    const url = new URL(req.url, 'http://localhost');
    const node = url.searchParams.get('node');
    const type = url.searchParams.get('type') || 'qemu';
    const vmid = url.searchParams.get('vmid');
    const port = url.searchParams.get('port');
    const vncticket = url.searchParams.get('vncticket');

    if (!node || !port || !vncticket) {
      clientWs.close(1008, 'Missing parameters');
      return;
    }

    const { ticket } = req.session.pve;

    const basePath = vmid
      ? `/api2/json/nodes/${node}/${type}/${vmid}/vncwebsocket`
      : `/api2/json/nodes/${node}/vncwebsocket`;

    const targetPath = `${basePath}?port=${port}&vncticket=${encodeURIComponent(vncticket)}`;

    try {
      const pveWs = await connectToProxmoxWS(targetPath, ticket);

      let msgCount = 0;

      pveWs.on('message', (data, isBinary) => {
        msgCount++;
        if (msgCount <= 3) {
          console.log(`[ws] PVE→client #${msgCount}: ${data.length} bytes, binary=${isBinary}`);
        }
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data, { binary: isBinary });
        }
      });

      clientWs.on('message', (data, isBinary) => {
        if (pveWs.readyState === WebSocket.OPEN) {
          pveWs.send(data, { binary: isBinary });
        }
      });

      pveWs.on('close', (code, reason) => {
        console.log(`[ws] PVE closed: ${code} ${String(reason)}`);
        clientWs.close();
      });
      pveWs.on('error', (e) => {
        console.error(`[ws] PVE error: ${e.message}`);
        clientWs.close();
      });
      clientWs.on('close', () => pveWs.close());
      clientWs.on('error', () => pveWs.close());

    } catch (err) {
      clientWs.close();
    }
  });
}
