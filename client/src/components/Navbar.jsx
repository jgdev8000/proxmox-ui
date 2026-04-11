import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

function BrandLogo({ username }) {
  const name = (username || '').split('@')[0];
  const [hasLogo, setHasLogo] = useState(true);

  if (hasLogo && name) {
    return (
      <img
        src={`/logos/${name}.png`}
        alt=""
        className="h-8 max-w-[140px] object-contain"
        onError={() => setHasLogo(false)}
      />
    );
  }

  return (
    <svg className="w-6 h-6 text-blue-500 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 0 6h13.5a3 3 0 1 0 0-6m-13.5 0a3 3 0 0 1-3-3m3 3h13.5m-13.5 0a3 3 0 0 0-3 3m18-3a3 3 0 0 1 3-3m0 0a3 3 0 0 1-3 3m3-3H5.25m13.5 0a3 3 0 0 0 3-3M5.25 5.25A3 3 0 0 0 2.25 8.25m3-3h13.5a3 3 0 0 1 3 3m-19.5 0A3 3 0 0 1 5.25 5.25" />
    </svg>
  );
}

function NodeConsoleMenu() {
  const [open, setOpen] = useState(false);
  const [nodes, setNodes] = useState([]);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    async function fetchNodes() {
      try {
        const data = await api.getNodes();
        setNodes(data.filter((n) => n.status === 'online').sort((a, b) => a.node.localeCompare(b.node)));
      } catch {}
    }
    fetchNodes();
  }, [open]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="text-gray-400 hover:text-white hover:bg-gray-800 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
        Node Shell
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
          {nodes.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500">Loading...</div>
          ) : (
            nodes.map((n) => (
              <button key={n.node} onClick={() => { setOpen(false); navigate(`/node-console/${n.node}`); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white cursor-pointer flex items-center gap-2 transition-colors">
                <span className={`w-2 h-2 rounded-full ${n.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                {n.node}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 bg-gray-950 border-b border-gray-800 shadow-lg shadow-black/10">
      <div className="px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <BrandLogo username={user} />
          <span className="text-white font-semibold text-sm tracking-wide group-hover:text-gray-200 transition-colors">
            Proxmox Panel
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {isAdmin && <NodeConsoleMenu />}
          {isAdmin && (
            <Link to="/admin" className="text-gray-400 hover:text-white hover:bg-gray-800 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
              Admin
            </Link>
          )}
          <div className="w-px h-6 bg-gray-800" />
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
            {(user || '?').split('@')[0].slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-white text-sm font-medium leading-tight">{user?.split('@')[0]}</span>
            <span className="text-gray-500 text-[11px] leading-tight">{user?.includes('@') ? user.split('@')[1] : ''}</span>
          </div>
          <button
            onClick={logout}
            className="ml-2 text-gray-400 hover:text-white hover:bg-gray-800 p-2 rounded-lg transition-colors cursor-pointer"
            title="Logout"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
