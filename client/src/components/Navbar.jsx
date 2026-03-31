import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function UserAvatar({ name }) {
  const username = (name || '').split('@')[0];
  const initials = username.slice(0, 2).toUpperCase() || '?';
  const [hasLogo, setHasLogo] = useState(true);

  if (hasLogo && username) {
    return (
      <img
        src={`/logos/${username}.png`}
        alt={username}
        className="w-8 h-8 rounded-full object-cover"
        onError={() => setHasLogo(false)}
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
      {initials}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 bg-gray-950 border-b border-gray-800 shadow-lg shadow-black/10">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <svg className="w-6 h-6 text-blue-500 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 0 6h13.5a3 3 0 1 0 0-6m-13.5 0a3 3 0 0 1-3-3m3 3h13.5m-13.5 0a3 3 0 0 0-3 3m18-3a3 3 0 0 1 3-3m0 0a3 3 0 0 1-3 3m3-3H5.25m13.5 0a3 3 0 0 0 3-3M5.25 5.25A3 3 0 0 0 2.25 8.25m3-3h13.5a3 3 0 0 1 3 3m-19.5 0A3 3 0 0 1 5.25 5.25" />
          </svg>
          <span className="text-white font-semibold text-sm tracking-wide group-hover:text-gray-200 transition-colors">
            Proxmox Panel
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <UserAvatar name={user} />
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
