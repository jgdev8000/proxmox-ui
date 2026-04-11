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

// ── Config Editor ──

function ConfigEditor({ node, type, vmid, config, isRunning, isAdmin, onSaved }) {
  const [isos, setISOs] = useState([]);
  const [loadingISOs, setLoadingISOs] = useState(true);

  // Parse current config values
  const currentISO = config.ide2 || '';
  const currentISOVolid = currentISO.split(',')[0] || '';

  // Parse boot order: "order=scsi0;ide2;net0" → ['scsi0', 'ide2', 'net0']
  const bootStr = config.boot || '';
  const bootDevices = bootStr.startsWith('order=')
    ? bootStr.slice(6).split(';').filter(Boolean)
    : [];

  // Detect available boot devices from config keys
  const allDevices = Object.keys(config)
    .filter((k) => /^(scsi|sata|ide|virtio|efidisk|net)\d+$/.test(k))
    .sort();

  const [iso, setISO] = useState(currentISOVolid);
  const [boot, setBoot] = useState(bootDevices);
  const [description, setDescription] = useState(config.description || '');
  const [cores, setCores] = useState(config.cores || 1);
  const [memory, setMemory] = useState(config.memory || 512);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Fetch ISOs
  useEffect(() => {
    async function fetchISOs() {
      try {
        const storages = await api.getStorages(node);
        const allISOs = [];
        for (const s of storages) {
          try {
            const isoList = await api.getISOs(node, s.storage);
            allISOs.push(...isoList.map((i) => ({ ...i, storage: s.storage })));
          } catch {
            // storage might not be accessible
          }
        }
        setISOs(allISOs.sort((a, b) => (a.volid || '').localeCompare(b.volid || '')));
      } catch {
        // ignore
      } finally {
        setLoadingISOs(false);
      }
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
    if (boot.includes(device)) {
      setBoot(boot.filter((d) => d !== device));
    } else {
      setBoot([...boot, device]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const updates = {};

    // ISO
    if (iso !== currentISOVolid) {
      updates.ide2 = iso ? `${iso},media=cdrom` : 'none,media=cdrom';
    }

    // Boot order
    const newBootStr = `order=${boot.join(';')}`;
    if (newBootStr !== bootStr && boot.length > 0) {
      updates.boot = newBootStr;
    }

    // Description
    if (description !== (config.description || '')) {
      updates.description = description;
    }

    // Admin fields
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h2>

      {isRunning && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm p-3 rounded-lg mb-5">
          VM is running. Some changes (CPU, RAM) require a restart to take effect.
        </div>
      )}

      {message && (
        <div className={`p-3 rounded-lg text-sm mb-5 border ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
          message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
          'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ISO / CD-ROM */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">CD/DVD Drive (ide2)</label>
          {loadingISOs ? (
            <div className="text-sm text-gray-400">Loading ISOs...</div>
          ) : (
            <select value={iso} onChange={(e) => setISO(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
              <option value="">None (eject)</option>
              {isos.map((i) => (
                <option key={i.volid} value={i.volid}>
                  {i.volid}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description / Notes</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
            placeholder="VM description..." />
        </div>

        {/* Admin: CPU */}
        {isAdmin && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">CPU Cores</label>
            <input type="number" min={1} max={128} value={cores} onChange={(e) => setCores(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </div>
        )}

        {/* Admin: RAM */}
        {isAdmin && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Memory (MB)</label>
            <input type="number" min={128} step={128} value={memory} onChange={(e) => setMemory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
          </div>
        )}
      </div>

      {/* Boot Order */}
      <div className="mt-6">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Boot Order</label>
        <div className="space-y-1.5">
          {boot.map((device, i) => (
            <div key={device} className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
              <span className="text-xs font-bold text-blue-400 w-5">{i + 1}</span>
              <span className="text-sm font-medium text-gray-900 flex-1">{device}</span>
              <button onClick={() => moveBootDevice(i, -1)} disabled={i === 0}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-20 cursor-pointer p-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                </svg>
              </button>
              <button onClick={() => moveBootDevice(i, 1)} disabled={i === boot.length - 1}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-20 cursor-pointer p-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              <button onClick={() => toggleBootDevice(device)} title="Remove from boot order"
                className="text-red-400 hover:text-red-600 cursor-pointer p-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        {/* Devices not in boot order */}
        {allDevices.filter((d) => !boot.includes(d)).length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-gray-400">Available devices:</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {allDevices.filter((d) => !boot.includes(d)).map((device) => (
                <button key={device} onClick={() => toggleBootDevice(device)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1 rounded-md cursor-pointer transition-colors">
                  + {device}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end mt-6">
        <button onClick={handleSave} disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50 transition-colors shadow-sm">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
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

  const fetchData = useCallback(async () => {
    try {
      const [detailData, rrdData] = await Promise.all([
        api.getVM(node, type, vmid),
        api.getRRD(node, type, vmid, timeframe),
      ]);
      setDetail(detailData);
      setRRD(rrdData || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
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
    } catch (err) {
      alert(err.message);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-gray-500">Loading...</span>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 p-4 rounded">VM not found</div>
      </div>
    );
  }

  const { status, config } = detail;
  const isRunning = status.status === 'running';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <Link to="/" className="text-blue-600 hover:text-blue-800 text-sm">
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {config.name || status.name || `VM ${vmid}`}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {type.toUpperCase()} {vmid} &middot; Node: {node}
            </p>
          </div>
          <StatusBadge status={status.status} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-sm">
          <div>
            <span className="text-gray-400 block">CPU</span>
            <span className="font-medium">
              {isRunning ? `${((status.cpu || 0) * 100).toFixed(1)}%` : '-'}{' '}
              ({status.cpus || config.cores || '?'} cores)
            </span>
          </div>
          <div>
            <span className="text-gray-400 block">Memory</span>
            <span className="font-medium">
              {isRunning ? formatBytes(status.mem) : '-'} / {formatBytes(status.maxmem)}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block">Disk</span>
            <span className="font-medium">
              {formatBytes(status.disk)} / {formatBytes(status.maxdisk)}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block">Uptime</span>
            <span className="font-medium">
              {isRunning && status.uptime
                ? (() => {
                    const d = Math.floor(status.uptime / 86400);
                    const h = Math.floor((status.uptime % 86400) / 3600);
                    const m = Math.floor((status.uptime % 3600) / 60);
                    if (d >= 10) return `${d}d`;
                    return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m`;
                  })()
                : '-'}
            </span>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          {isRunning ? (
            <>
              <Link
                to={`/console/${node}/${type}/${vmid}`}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
              >
                Console
              </Link>
              <button disabled={acting} onClick={() => doAction('shutdown')}
                className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 px-4 py-2 rounded-lg text-sm cursor-pointer disabled:opacity-50">
                Shutdown
              </button>
              <button disabled={acting} onClick={() => doAction('reboot')}
                className="bg-blue-100 text-blue-800 hover:bg-blue-200 px-4 py-2 rounded-lg text-sm cursor-pointer disabled:opacity-50">
                Reboot
              </button>
              <button disabled={acting} onClick={() => doAction('stop')}
                className="bg-red-100 text-red-800 hover:bg-red-200 px-4 py-2 rounded-lg text-sm cursor-pointer disabled:opacity-50">
                Force Stop
              </button>
            </>
          ) : (
            <button disabled={acting} onClick={() => doAction('start')}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm cursor-pointer disabled:opacity-50 shadow-sm">
              Start
            </button>
          )}
        </div>
      </div>

      {/* Config Editor */}
      <div className="mb-6">
        <ConfigEditor
          node={node}
          type={type}
          vmid={vmid}
          config={config}
          isRunning={isRunning}
          isAdmin={isAdmin}
          onSaved={fetchData}
        />
      </div>

      {/* Monitoring */}
      {isRunning && rrd.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Monitoring</h2>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
            >
              <option value="hour">Last Hour</option>
              <option value="day">Last Day</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MonitorChart
              title="CPU Usage"
              data={rrd}
              dataKeys={['cpu']}
              formatter={(v) => `${(v * 100).toFixed(1)}%`}
            />
            <MonitorChart
              title="Memory Usage"
              data={rrd}
              dataKeys={['mem']}
              formatter={(v) => formatBytes(v)}
            />
            {rrd[0]?.netin !== undefined && (
              <MonitorChart
                title="Network I/O"
                data={rrd}
                dataKeys={['netin', 'netout']}
                formatter={(v) => formatBytes(v) + '/s'}
              />
            )}
            {rrd[0]?.diskread !== undefined && (
              <MonitorChart
                title="Disk I/O"
                data={rrd}
                dataKeys={['diskread', 'diskwrite']}
                formatter={(v) => formatBytes(v) + '/s'}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
