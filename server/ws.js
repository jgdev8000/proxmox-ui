import { WebSocketServer, WebSocket } from 'ws';
import config from './config.js';

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

    if (!node || !vmid || !port || !vncticket) {
      console.error('[ws] Missing params:', { node, vmid, port, vncticket: !!vncticket });
      clientWs.close(1008, 'Missing parameters');
      return;
    }

    const { ticket } = req.session.pve;
    const targetUrl =
      `wss://${config.proxmox.host}:${config.proxmox.port}/api2/json/nodes/${node}/${type}/${vmid}/vncwebsocket?port=${port}&vncticket=${encodeURIComponent(vncticket)}`;

    console.log(`[ws] Connecting to Proxmox VNC: ${node}/${type}/${vmid}`);

    const pveWs = new WebSocket(targetUrl, 'binary', {
      headers: {
        Cookie: `PVEAuthCookie=${ticket}`,
      },
      rejectUnauthorized: false,
    });

    let msgCount = 0;

    pveWs.on('open', () => {
      console.log(`[ws] Connected to Proxmox VNC for ${type}/${vmid}`);

      // Forward queued client messages now that upstream is ready
      clientWs.on('message', (data, isBinary) => {
        if (pveWs.readyState === WebSocket.OPEN) {
          pveWs.send(data, { binary: isBinary });
        }
      });
    });

    pveWs.on('message', (data, isBinary) => {
      msgCount++;
      if (msgCount <= 3) {
        console.log(`[ws] PVE→client msg #${msgCount}: ${data.length} bytes, binary=${isBinary}`);
      }
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data, { binary: isBinary });
      }
    });

    pveWs.on('error', (err) => {
      console.error(`[ws] Proxmox WS error: ${err.message}`);
      clientWs.close();
    });

    pveWs.on('close', (code, reason) => {
      console.log(`[ws] Proxmox WS closed: ${code} ${String(reason)}`);
      clientWs.close();
    });

    clientWs.on('close', () => pveWs.close());
    clientWs.on('error', () => pveWs.close());
  });
}
