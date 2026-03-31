import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import rfbModule from '@novnc/novnc/lib/rfb.js';
const RFB = rfbModule.default || rfbModule;

export default function Console() {
  const { node, type, vmid } = useParams();
  const containerRef = useRef(null);
  const rfbRef = useRef(null);
  const [status, setStatus] = useState('Connecting...');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectKey, setConnectKey] = useState(0);

  const connect = useCallback(async () => {
    // Clean up previous connection
    if (rfbRef.current) {
      try { rfbRef.current.disconnect(); } catch {}
      rfbRef.current = null;
    }
    // Clear the container of old canvases
    const container = containerRef.current;
    if (container) {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    }

    setStatus('Connecting...');

    try {
      const data = await api.getConsoleTicket(node, type, vmid);

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/api/console/ws?node=${node}&type=${type}&vmid=${vmid}&port=${data.port}&vncticket=${encodeURIComponent(data.ticket)}`;

      const rfb = new RFB(container, wsUrl, {
        credentials: { password: data.ticket },
      });
      rfb.scaleViewport = true;
      rfb.resizeSession = true;

      rfb.addEventListener('connect', () => setStatus('Connected'));
      rfb.addEventListener('disconnect', (e) => {
        setStatus(e.detail.clean ? 'Disconnected' : 'Connection lost');
        rfbRef.current = null;
      });

      rfbRef.current = rfb;
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }, [node, type, vmid]);

  useEffect(() => {
    connect();
    return () => {
      if (rfbRef.current) {
        try { rfbRef.current.disconnect(); } catch {}
        rfbRef.current = null;
      }
    };
  }, [connect, connectKey]);

  const reconnect = () => setConnectKey((k) => k + 1);

  const sendCtrlAltDel = () => {
    rfbRef.current?.sendCtrlAltDel();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const isDisconnected = status === 'Disconnected' || status === 'Connection lost';

  return (
    <div className="flex flex-col h-[calc(100vh-52px)]">
      <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-gray-200">
            VMs
          </Link>
          <span className="text-gray-600">/</span>
          <Link to={`/vm/${node}/${type}/${vmid}`} className="text-blue-300 hover:text-blue-200">
            VM {vmid}
          </Link>
          <span>
            Console &mdash; {type.toUpperCase()} {vmid}
          </span>
          <span className={`text-xs ${status === 'Connected' ? 'text-green-400' : 'text-yellow-400'}`}>
            {status}
          </span>
        </div>
        <div className="flex gap-2">
          {isDisconnected && (
            <button
              onClick={reconnect}
              className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded text-xs cursor-pointer"
            >
              Reconnect
            </button>
          )}
          <button
            onClick={sendCtrlAltDel}
            className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs cursor-pointer"
          >
            Ctrl+Alt+Del
          </button>
          <button
            onClick={toggleFullscreen}
            className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs cursor-pointer"
          >
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 bg-black" />
    </div>
  );
}
