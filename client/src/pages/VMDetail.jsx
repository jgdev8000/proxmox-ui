import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import MonitorChart from '../components/MonitorChart';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// ── Tab Button ──

function Tab({ label, icon, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}>
      {icon}
      {label}
    </button>
  );
}

// ── Config Editor ──

function ConfigEditor({ node, type, vmid, config, isRunning, isAdmin, onSaved }) {
  const [isos, setISOs] = useState([]);
  const [loadingISOs, setLoadingISOs] = useState(true);
  const currentISO = config.ide2 || '';
  const currentISOVolid = currentISO.split(',')[0] || '';
  const bootStr = config.boot || '';
  const bootDevices = bootStr.startsWith('order=')
    ? bootStr.slice(6).split(';').filter(Boolean) : [];
  const allDevices = Object.keys(config)
    .filter((k) => /^(scsi|sata|ide|virtio|efidisk|net)\d+$/.test(k)).sort();

  const [iso, setISO] = useState(currentISOVolid);
  const [boot, setBoot] = useState(bootDevices);
  const [description, setDescription] = useState(config.description || '');
  const [cores, setCores] = useState(config.cores || 1);
  const [memory, setMemory] = useState(config.memory || 512);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    async function fetchISOs() {
      try {
        const storages = await api.getStorages(node);
        const allISOs = [];
        for (const s of storages) {
          try {
            const isoList = await api.getISOs(node, s.storage);
            allISOs.push(...isoList.map((i) => ({ ...i, storage: s.storage })));
          } catch {}
        }
        setISOs(allISOs.sort((a, b) => (a.volid || '').localeCompare(b.volid || '')));
      } catch {}
      finally { setLoadingISOs(false); }
    }
    fetchISOs();
  }, [node]);

  const moveBootDevice = (index, direction) => {
    const newBoot = [...boot];
    const target = index + direction;
    if (target < 0 || target >= newBoot.length) return;
    [newBoot[index], newBoot[target]] = [newBoot[target], newBoot[index]];
    setBoot(newBoot);
  };

  const toggleBootDevice = (device) => {
    setBoot(boot.includes(device) ? boot.filter((d) => d !== device) : [...boot, device]);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const updates = {};
    if (iso !== currentISOVolid) updates.ide2 = iso ? `${iso},media=cdrom` : 'none,media=cdrom';
    const newBootStr = `order=${boot.join(';')}`;
    if (newBootStr !== bootStr && boot.length > 0) updates.boot = newBootStr;
    if (description !== (config.description || '')) updates.description = description;
    if (isAdmin) {
      if (Number(cores) !== Number(config.cores)) updates.cores = Number(cores);
      if (Number(memory) !== Number(config.memory)) updates.memory = Number(memory);
    }
    if (Object.keys(updates).length === 0) {
      setMessage({ type: 'info', text: 'No changes to save' });
      setSaving(false);
      return;
    }
    try {
      await api.updateConfig(node, type, vmid, updates);
      setMessage({ type: 'success', text: 'Configuration saved' });
      onSaved();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      {isRunning && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm p-3 rounded-lg flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          VM is running. CPU and RAM changes require a restart to take effect.
        </div>
      )}

      {message && (
        <div className={`p-3 rounded-lg text-sm border flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
          message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
          'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          {message.type === 'success' && <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>}
          {message.text}
        </div>
      )}

      {/* Hardware section */}
      {isAdmin && (
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Hardware</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4 border border-gray-100">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">CPU Cores</label>
              <input type="number" min={1} max={128} value={cores} onChange={(e) => setCores(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-gray-100">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Memory (MB)</label>
              <input type="number" min={128} step={128} value={memory} onChange={(e) => setMemory(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
            </div>
          </div>
        </div>
      )}

      {/* Media section */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Media</h3>
        <div className="bg-slate-50 rounded-lg p-4 border border-gray-100">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">CD/DVD Drive (ide2)</label>
          {loadingISOs ? (
            <div className="text-sm text-gray-400">Loading ISOs...</div>
          ) : (
            <select value={iso} onChange={(e) => setISO(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
              <option value="">None (eject)</option>
              {isos.map((i) => (
                <option key={i.volid} value={i.volid}>{i.volid}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Boot Order section */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Boot Order</h3>
        <div className="bg-slate-50 rounded-lg p-4 border border-gray-100">
          <div className="space-y-1.5">
            {boot.map((device, i) => (
              <div key={device} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2.5 border border-gray-200 shadow-sm">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span className="text-sm font-medium text-gray-900 flex-1">{device}</span>
                <button onClick={() => moveBootDevice(i, -1)} disabled={i === 0}
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-20 cursor-pointer p-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" /></svg>
                </button>
                <button onClick={() => moveBootDevice(i, 1)} disabled={i === boot.length - 1}
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-20 cursor-pointer p-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                </button>
                <button onClick={() => toggleBootDevice(device)} title="Remove"
                  className="text-red-400 hover:text-red-600 cursor-pointer p-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
          {allDevices.filter((d) => !boot.includes(d)).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <span className="text-xs text-gray-400 font-medium">Add device:</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {allDevices.filter((d) => !boot.includes(d)).map((device) => (
                  <button key={device} onClick={() => toggleBootDevice(device)}
                    className="text-xs bg-white hover:bg-blue-50 text-gray-600 hover:text-blue-600 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors border border-gray-200 hover:border-blue-300">
                    + {device}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notes section */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Notes</h3>
        <div className="bg-slate-50 rounded-lg p-4 border border-gray-100">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
            placeholder="VM description or notes..." />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={handleSave} disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50 transition-colors shadow-sm">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ── Monitoring Tab ──

function MonitoringTab({ rrd, timeframe, setTimeframe }) {
  return (
    <div>
      <div className="flex justify-end mb-4">
        <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
          <option value="hour">Last Hour</option>
          <option value="day">Last Day</option>
          <option value="week">Last Week</option>
          <option value="month">Last Month</option>
        </select>
      </div>
      {rrd.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MonitorChart title="CPU Usage" data={rrd} dataKeys={['cpu']}
            formatter={(v) => `${(v * 100).toFixed(1)}%`} />
          <MonitorChart title="Memory Usage" data={rrd} dataKeys={['mem']}
            formatter={(v) => formatBytes(v)} />
          {rrd[0]?.netin !== undefined && (
            <MonitorChart title="Network I/O" data={rrd} dataKeys={['netin', 'netout']}
              formatter={(v) => formatBytes(v) + '/s'} />
          )}
          {rrd[0]?.diskread !== undefined && (
            <MonitorChart title="Disk I/O" data={rrd} dataKeys={['diskread', 'diskwrite']}
              formatter={(v) => formatBytes(v) + '/s'} />
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400 text-sm">No monitoring data available</div>
      )}
    </div>
  );
}

// ── Main Detail Page ──

export default function VMDetail() {
  const { node, type, vmid } = useParams();
  const { isAdmin } = useAuth();
  const [detail, setDetail] = useState(null);
  const [rrd, setRRD] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [timeframe, setTimeframe] = useState('hour');
  const [activeTab, setActiveTab] = useState('config');

  const fetchData = useCallback(async () => {
    try {
      const [detailData, rrdData] = await Promise.all([
        api.getVM(node, type, vmid),
        api.getRRD(node, type, vmid, timeframe),
      ]);
      setDetail(detailData);
      setRRD(rrdData || []);
    } catch {}
    finally { setLoading(false); }
  }, [node, type, vmid, timeframe]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const doAction = async (action) => {
    if (!confirm(`Are you sure you want to ${action} this VM?`)) return;
    setActing(true);
    try {
      await api.vmAction(node, type, vmid, action);
      setTimeout(fetchData, 2000);
    } catch (err) { alert(err.message); }
    finally { setActing(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-7 h-7 border-2 border-gray-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6"><div className="bg-red-50 text-red-700 p-4 rounded-lg">VM not found</div></div>
    );
  }

  const { status, config } = detail;
  const isRunning = status.status === 'running';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <Link to="/" className="text-gray-400 hover:text-blue-600 text-sm transition-colors">
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm ${
              type === 'lxc'
                ? 'bg-gradient-to-br from-violet-100 to-violet-50 text-violet-600 ring-1 ring-violet-200/60'
                : 'bg-gradient-to-br from-sky-100 to-sky-50 text-sky-600 ring-1 ring-sky-200/60'
            }`}>
              {type === 'lxc' ? 'CT' : 'VM'}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {config.name || status.name || `VM ${vmid}`}
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {type.toUpperCase()} {vmid} &middot; {node}
              </p>
            </div>
          </div>
          <StatusBadge status={status.status} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6">
          {[
            { label: 'CPU', value: isRunning ? `${((status.cpu || 0) * 100).toFixed(1)}%` : '-', sub: `${status.cpus || config.cores || '?'} cores` },
            { label: 'Memory', value: isRunning ? formatBytes(status.mem) : '-', sub: `of ${formatBytes(status.maxmem)}` },
            { label: 'Disk', value: formatBytes(status.disk), sub: `of ${formatBytes(status.maxdisk)}` },
            { label: 'Network', value: isRunning && status.netin ? formatBytes(status.netin) : '-', sub: isRunning && status.netout ? `${formatBytes(status.netout)} out` : '' },
            { label: 'Uptime', value: isRunning && status.uptime ? (() => {
                const d = Math.floor(status.uptime / 86400);
                const h = Math.floor((status.uptime % 86400) / 3600);
                const m = Math.floor((status.uptime % 3600) / 60);
                if (d >= 10) return `${d}d`;
                return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m`;
              })() : '-', sub: '' },
          ].map((s) => (
            <div key={s.label} className="bg-slate-50 rounded-lg p-3 border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.label}</span>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{s.value}</p>
              {s.sub && <p className="text-[10px] text-gray-400">{s.sub}</p>}
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-5 pt-5 border-t border-gray-100">
          {isRunning ? (
            <>
              <Link to={`/console/${node}/${type}/${vmid}`}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors">
                Console
              </Link>
              <button disabled={acting} onClick={() => doAction('shutdown')}
                className="bg-amber-50 text-amber-700 hover:bg-amber-100 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50 border border-amber-200 transition-colors">
                Shutdown
              </button>
              <button disabled={acting} onClick={() => doAction('reboot')}
                className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50 border border-blue-200 transition-colors">
                Reboot
              </button>
              <button disabled={acting} onClick={() => doAction('stop')}
                className="bg-red-50 text-red-700 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50 border border-red-200 transition-colors">
                Force Stop
              </button>
            </>
          ) : (
            <button disabled={acting} onClick={() => doAction('start')}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50 shadow-sm transition-colors">
              Start
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200 px-2">
          <Tab label="Configuration" active={activeTab === 'config'} onClick={() => setActiveTab('config')}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>} />
          <Tab label="Monitoring" active={activeTab === 'monitor'} onClick={() => setActiveTab('monitor')}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>} />
        </div>
        <div className="p-6">
          {activeTab === 'config' && (
            <ConfigEditor node={node} type={type} vmid={vmid} config={config}
              isRunning={isRunning} isAdmin={isAdmin} onSaved={fetchData} />
          )}
          {activeTab === 'monitor' && (
            <MonitoringTab rrd={rrd} timeframe={timeframe} setTimeframe={setTimeframe} />
          )}
        </div>
      </div>
    </div>
  );
}
