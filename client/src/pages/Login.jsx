import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [realm, setRealm] = useState('pam');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password, realm);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />

      <form
        onSubmit={handleSubmit}
        className="relative bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/40 border border-white/10 p-8 w-full max-w-sm"
      >
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 0 6h13.5a3 3 0 1 0 0-6m-13.5 0a3 3 0 0 1-3-3m3 3h13.5m-13.5 0a3 3 0 0 0-3 3m18-3a3 3 0 0 1 3-3m0 0a3 3 0 0 1-3 3m3-3H5.25m13.5 0a3 3 0 0 0 3-3M5.25 5.25A3 3 0 0 0 2.25 8.25m3-3h13.5a3 3 0 0 1 3 3m-19.5 0A3 3 0 0 1 5.25 5.25" />
            </svg>
          </div>
        </div>

        <h1 className="text-xl font-bold text-white mb-1 text-center">
          Proxmox Panel
        </h1>
        <p className="text-sm text-gray-400 mb-6 text-center">Sign in to manage your machines</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
          Username
        </label>
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
          </svg>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
            placeholder="admin"
            required
          />
        </div>

        <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
          Password
        </label>
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
            placeholder="••••••••"
            required
          />
        </div>

        <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
          Realm
        </label>
        <select
          value={realm}
          onChange={(e) => setRealm(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors appearance-none cursor-pointer"
        >
          <option value="pam" className="bg-gray-900">Linux PAM</option>
          <option value="pve" className="bg-gray-900">Proxmox VE</option>
        </select>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-2.5 rounded-lg cursor-pointer disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
