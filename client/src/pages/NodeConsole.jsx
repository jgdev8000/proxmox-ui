import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export default function NodeConsole() {
  const { node } = useParams();
  const termRef = useRef(null);
  const xtermRef = useRef(null);
  const wsRef = useRef(null);
  const fitRef = useRef(null);
  const [status, setStatus] = useState('Connecting...');
  const [connectKey, setConnectKey] = useState(0);

  const connect = useCallback(async () => {
    if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    if (xtermRef.current) { xtermRef.current.dispose(); xtermRef.current = null; }

    const container = termRef.current;
    if (!container) return;
    container.innerHTML = '';

    setStatus('Connecting...');

    try {
      const data = await api.getNodeConsoleTicket(node);

      const term = new Terminal({
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
        theme: {
          background: '#1a1b26',
          foreground: '#c0caf5',
          cursor: '#c0caf5',
          selectionBackground: '#33467c',
          black: '#15161e',
          red: '#f7768e',
          green: '#9ece6a',
          yellow: '#e0af68',
          blue: '#7aa2f7',
          magenta: '#bb9af7',
          cyan: '#7dcfff',
          white: '#a9b1d6',
        },
        cursorBlink: true,
        scrollback: 5000,
      });

      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(container);
      fit.fit();
      fitRef.current = fit;
      xtermRef.current = term;

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/api/console/ws?node=${node}&port=${data.port}&vncticket=${encodeURIComponent(data.ticket)}`;

      const ws = new WebSocket(wsUrl, 'binary');
      wsRef.current = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        setStatus('Connected');
      };

      ws.onmessage = (event) => {
        let text;
        if (event.data instanceof ArrayBuffer) {
          text = new TextDecoder().decode(event.data);
        } else {
          text = event.data;
        }
        term.write(text);
      };

      ws.onclose = (e) => {
        console.log(`[term] WS closed: ${e.code} ${e.reason}`);
        setStatus('Disconnected');
      };
      ws.onerror = () => setStatus('Connection error');

      term.onData((input) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(new TextEncoder().encode(input));
        }
      });

      term.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          // Send resize command: columns\0rows\0
          ws.send(new TextEncoder().encode(`\x01${cols}:${rows}:`));
        }
      });
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }, [node]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) { try { wsRef.current.close(); } catch {} }
      if (xtermRef.current) { xtermRef.current.dispose(); }
    };
  }, [connect, connectKey]);

  useEffect(() => {
    const handleResize = () => { if (fitRef.current) fitRef.current.fit(); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const reconnect = () => setConnectKey((k) => k + 1);
  const isDisconnected = status === 'Disconnected' || status === 'Connection error';

  return (
    <div className="flex flex-col h-[calc(100vh-52px)]">
      <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-gray-200">
            Dashboard
          </Link>
          <span className="text-gray-600">/</span>
          <span>Node Shell &mdash; {node}</span>
          <span className={`text-xs ${status === 'Connected' ? 'text-green-400' : 'text-yellow-400'}`}>
            {status}
          </span>
        </div>
        <div className="flex gap-2">
          {isDisconnected && (
            <button onClick={reconnect}
              className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded text-xs cursor-pointer">
              Reconnect
            </button>
          )}
        </div>
      </div>
      <div ref={termRef} className="flex-1" style={{ backgroundColor: '#1a1b26' }} />
    </div>
  );
}
