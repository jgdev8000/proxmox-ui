import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import StatusBadge from '../components/StatusBadge';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds) {
  if (!seconds) return '-';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d >= 10) return `${d}d`;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m`;
}

function usageColor(pct) {
  if (pct >= 95) return 'bg-red-500';
  if (pct >= 85) return 'bg-orange-500';
  if (pct >= 80) return 'bg-yellow-500';
  return 'bg-blue-500';
}

function UsageBar({ value, max }) {
  const pct = max ? Math.min((value / max) * 100, 100) : 0;
  const color = usageColor(pct);
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-10 text-right font-medium">{pct.toFixed(0)}%</span>
    </div>
  );
}

// SVG Icons
function IconPlay() {
  return (
    <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.841Z" />
    </svg>
  );
}
function IconStop() {
  return (
    <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M5.25 3A2.25 2.25 0 0 0 3 5.25v9.5A2.25 2.25 0 0 0 5.25 17h9.5A2.25 2.25 0 0 0 17 14.75v-9.5A2.25 2.25 0 0 0 14.75 3h-9.5Z" />
    </svg>
  );
}
function IconReboot() {
  return (
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
    </svg>
  );
}
function IconShutdown() {
  return (
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
    </svg>
  );
}
function IconTerminal() {
  return (
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}
function IconRefresh({ spinning }) {
  return (
    <svg className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
    </svg>
  );
}

function ActionButton({ label, onClick, disabled, variant, icon }) {
  const styles = {
    start: 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700',
    shutdown: 'text-amber-600 hover:bg-amber-50 hover:text-amber-700',
    reboot: 'text-blue-600 hover:bg-blue-50 hover:text-blue-700',
    stop: 'text-red-600 hover:bg-red-50 hover:text-red-700',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`p-1.5 rounded-md cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed ${styles[variant] || ''}`}
    >
      {icon}
    </button>
  );
}

function VMRow({ vm, onRefresh, striped }) {
  const [acting, setActing] = useState(false);
  const type = vm.type === 'lxc' ? 'lxc' : 'qemu';
  const isRunning = vm.status === 'running';

  const doAction = async (action) => {
    setActing(true);
    try {
      await api.vmAction(vm.node, type, vm.vmid, action);
      setTimeout(onRefresh, 1500);
    } catch (err) {
      alert(err.message);
    } finally {
      setActing(false);
    }
  };

  return (
    <tr className={`border-t border-gray-100 hover:bg-blue-50/50 transition-colors ${striped ? 'bg-slate-50/70' : 'bg-white'}`}>
      <td className="py-3.5 px-5">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shadow-sm ${
            type === 'lxc'
              ? 'bg-gradient-to-br from-violet-100 to-violet-50 text-violet-600 ring-1 ring-violet-200/60'
              : 'bg-gradient-to-br from-sky-100 to-sky-50 text-sky-600 ring-1 ring-sky-200/60'
          }`}>
            {type === 'lxc' ? 'CT' : 'VM'}
          </div>
          <div>
            <Link
              to={`/vm/${vm.node}/${type}/${vm.vmid}`}
              className="font-semibold text-gray-900 hover:text-blue-600 transition-colors"
            >
              {vm.name || `VM ${vm.vmid}`}
            </Link>
            <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{vm.vmid}</p>
          </div>
        </div>
      </td>
      <td className="py-3.5 px-5">
        <StatusBadge status={vm.status} />
      </td>
      <td className="py-3.5 px-5">
        <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">{vm.node}</span>
      </td>
      <td className="py-3.5 px-5 w-40">
        {isRunning ? (
          <UsageBar value={vm.cpu} max={1} />
        ) : (
          <span className="text-xs text-gray-300">&mdash;</span>
        )}
      </td>
      <td className="py-3.5 px-5 w-44">
        {isRunning ? (
          <div>
            <UsageBar value={vm.mem} max={vm.maxmem} />
            <p className="text-[10px] text-gray-400 mt-1 font-medium">
              {formatBytes(vm.mem)} / {formatBytes(vm.maxmem)}
            </p>
          </div>
        ) : (
          <span className="text-xs text-gray-300">&mdash;</span>
        )}
      </td>
      <td className="py-3.5 px-5 w-44">
        {vm.maxdisk ? (
          <div>
            <UsageBar value={vm.disk} max={vm.maxdisk} />
            <p className="text-[10px] text-gray-400 mt-1 font-medium">
              {formatBytes(vm.disk)} / {formatBytes(vm.maxdisk)}
            </p>
          </div>
        ) : (
          <span className="text-xs text-gray-300">&mdash;</span>
        )}
      </td>
      <td className="py-3.5 px-5">
        <span className="text-xs text-gray-500 tabular-nums font-medium">
          {isRunning ? formatUptime(vm.uptime) : '-'}
        </span>
      </td>
      <td className="py-3.5 px-5">
        <div className="flex items-center justify-end gap-0.5">
          {isRunning ? (
            <>
              <Link
                to={`/console/${vm.node}/${type}/${vm.vmid}`}
                title="Console"
                className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
              >
                <IconTerminal />
              </Link>
              <ActionButton icon={<IconShutdown />} label="Shutdown" onClick={() => doAction('shutdown')} disabled={acting} variant="shutdown" />
              <ActionButton icon={<IconReboot />} label="Reboot" onClick={() => doAction('reboot')} disabled={acting} variant="reboot" />
              <ActionButton icon={<IconStop />} label="Stop" onClick={() => doAction('stop')} disabled={acting} variant="stop" />
            </>
          ) : (
            <ActionButton icon={<IconPlay />} label="Start" onClick={() => doAction('start')} disabled={acting} variant="start" />
          )}
        </div>
      </td>
    </tr>
  );
}

const STAT_CONFIG = [
  { key: 'total', label: 'Total', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 0 1 2.25-2.25h7.5A2.25 2.25 0 0 1 18 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 0 0 4.5 9v.878m13.5-3A2.25 2.25 0 0 1 19.5 9v.878m0 0a2.246 2.246 0 0 0-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0 1 21 12v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6c0-1.243 1.007-2.25 2.25-2.25h13.5" />
    </svg>
  ), gradient: 'from-gray-600 to-gray-500' },
  { key: 'running', label: 'Running', icon: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.841Z" />
    </svg>
  ), gradient: 'from-emerald-600 to-emerald-500' },
  { key: 'stopped', label: 'Stopped', icon: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M5.25 3A2.25 2.25 0 0 0 3 5.25v9.5A2.25 2.25 0 0 0 5.25 17h9.5A2.25 2.25 0 0 0 17 14.75v-9.5A2.25 2.25 0 0 0 14.75 3h-9.5Z" />
    </svg>
  ), gradient: 'from-red-600 to-red-500' },
  { key: 'cpu', label: 'Avg CPU', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ), gradient: 'from-blue-600 to-blue-500' },
  { key: 'memory', label: 'Memory', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6Zm0 9.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6Zm0 9.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
    </svg>
  ), gradient: 'from-violet-600 to-violet-500' },
];

export default function Dashboard() {
  const [vms, setVMs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchVMs = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const data = await api.getVMs();
      setVMs(data.sort((a, b) => {
        if (a.status === 'running' && b.status !== 'running') return -1;
        if (a.status !== 'running' && b.status === 'running') return 1;
        return a.vmid - b.vmid;
      }));
      setError('');
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVMs();
    const interval = setInterval(fetchVMs, 10000);
    return () => clearInterval(interval);
  }, [fetchVMs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-7 h-7 border-2 border-gray-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">{error}</div>
      </div>
    );
  }

  const running = vms.filter((v) => v.status === 'running').length;
  const stopped = vms.filter((v) => v.status === 'stopped').length;
  const totalCpu = vms.reduce((sum, v) => sum + (v.status === 'running' ? (v.cpu || 0) : 0), 0);
  const totalMem = vms.reduce((sum, v) => sum + (v.status === 'running' ? (v.mem || 0) : 0), 0);
  const totalMaxMem = vms.reduce((sum, v) => sum + (v.status === 'running' ? (v.maxmem || 0) : 0), 0);

  const statValues = {
    total: { value: vms.length, sub: 'machines' },
    running: { value: running, sub: 'active' },
    stopped: { value: stopped, sub: 'inactive' },
    cpu: { value: running ? `${((totalCpu / running) * 100).toFixed(1)}%` : '0%', sub: 'across running' },
    memory: { value: formatBytes(totalMem), sub: `of ${formatBytes(totalMaxMem)}` },
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Virtual Machines</h1>
          <p className="text-sm text-gray-400 mt-1">Manage and monitor your infrastructure</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchVMs(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
          >
            <IconRefresh spinning={refreshing} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {STAT_CONFIG.map((s) => {
          const sv = statValues[s.key];
          return (
            <div key={s.key} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{s.label}</span>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.gradient} text-white flex items-center justify-center shadow-sm`}>
                  {s.icon}
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{sv.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sv.sub}</p>
            </div>
          );
        })}
      </div>

      {vms.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center shadow-sm">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 0 6h13.5a3 3 0 1 0 0-6m-13.5 0a3 3 0 0 1-3-3m3 3h13.5m-13.5 0a3 3 0 0 0-3 3m18-3a3 3 0 0 1 3-3m0 0a3 3 0 0 1-3 3m3-3H5.25m13.5 0a3 3 0 0 0 3-3M5.25 5.25A3 3 0 0 0 2.25 8.25m3-3h13.5a3 3 0 0 1 3 3m-19.5 0A3 3 0 0 1 5.25 5.25" />
          </svg>
          <p className="text-gray-400 text-sm">No virtual machines found for your account.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-200">
                <th className="py-3 px-5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Machine</th>
                <th className="py-3 px-5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="py-3 px-5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Node</th>
                <th className="py-3 px-5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">CPU</th>
                <th className="py-3 px-5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Memory</th>
                <th className="py-3 px-5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Disk</th>
                <th className="py-3 px-5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Uptime</th>
                <th className="py-3 px-5 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vms.map((vm, i) => (
                <VMRow key={`${vm.node}-${vm.vmid}`} vm={vm} onRefresh={fetchVMs} striped={i % 2 === 1} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
