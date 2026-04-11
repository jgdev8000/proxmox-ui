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
  const [pendingSections, setPendingSections] = useState(new Set());

  // Track which sections have unsaved changes
  const hwChanged = isAdmin && (Number(cores) !== Number(config.cores || 1) || Number(memory) !== Number(config.memory || 512));
  const mediaChanged = iso !== currentISOVolid;
  const bootChanged = `order=${boot.join(';')}` !== bootStr;
  const notesChanged = description !== (config.description || '');

  // After save, keep sections highlighted if they need a restart
  const needsRestart = isRunning && (pendingSections.has('hardware') || hwChanged);

  function sectionClass(changed, sectionKey) {
    const pending = pendingSections.has(sectionKey);
    if (pending) return 'bg-amber-50 rounded-lg p-4 border border-amber-300 ring-1 ring-amber-200';
    if (changed) return 'bg-blue-50 rounded-lg p-4 border border-blue-300 ring-1 ring-blue-200';
    return 'bg-slate-50 rounded-lg p-4 border border-gray-100';
  }

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
      // Track sections that need restart (CPU/RAM while running)
      const newPending = new Set(pendingSections);
      if (isRunning && (updates.cores !== undefined || updates.memory !== undefined)) {
        newPending.add('hardware');
      }
      // Clear sections that don't need restart
      if (updates.ide2 !== undefined) newPending.delete('media');
      if (updates.boot !== undefined) newPending.delete('boot');
      if (updates.description !== undefined) newPending.delete('notes');
      setPendingSections(newPending);

      if (newPending.size > 0) {
        setMessage({ type: 'warning', text: 'Configuration saved. Restart the VM to apply hardware changes.' });
      } else {
        setMessage({ type: 'success', text: 'Configuration saved' });
      }
      onSaved();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-3 rounded-lg text-sm border flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
          message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
          message.type === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
          'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          {message.type === 'success' && <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>}
          {message.type === 'warning' && <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>}
          {message.text}
        </div>
      )}

      {/* Hardware section */}
      {isAdmin && (
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Hardware</h3>
          <div className={`${sectionClass(hwChanged, 'hardware')} transition-all duration-300`}>
            {pendingSections.has('hardware') && (
              <p className="text-xs text-amber-600 font-medium mb-3 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                Restart required to apply these changes
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">CPU Cores</label>
                <input type="number" min={1} max={128} value={cores} onChange={(e) => setCores(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Memory (MB)</label>
                <input type="number" min={128} step={128} value={memory} onChange={(e) => setMemory(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Media section */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Media</h3>
        <div className={`${sectionClass(mediaChanged, 'media')} transition-all duration-300`}>
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
        <div className={`${sectionClass(bootChanged, 'boot')} transition-all duration-300`}>
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
        <div className={`${sectionClass(notesChanged, 'notes')} transition-all duration-300`}>
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

// ── Backups Tab ──

function BackupsTab({ node, type, vmid }) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [storages, setStorages] = useState([]);
  const [backupStorage, setBackupStorage] = useState('');
  const [backupMode, setBackupMode] = useState('snapshot');
  const [backupCompress, setBackupCompress] = useState('zstd');
  const [backupNotes, setBackupNotes] = useState('');
  const [message, setMessage] = useState(null);

  const fetchBackups = useCallback(async () => {
    try {
      const data = await api.getBackups(node, type, vmid);
      setBackups(data);
    } catch {}
    finally { setLoading(false); }
  }, [node, type, vmid]);

  useEffect(() => {
    fetchBackups();
    async function fetchStorages() {
      try {
        const data = await api.getAllStorages(node);
        const bs = data.filter((s) => s.content && s.content.split(',').includes('backup'));
        setStorages(bs);
        if (bs.length > 0) setBackupStorage(bs[0].storage);
      } catch {}
    }
    fetchStorages();
  }, [fetchBackups, node]);

  const handleCreate = async () => {
    setCreating(true);
    setMessage(null);
    try {
      await api.createBackup(node, type, vmid, {
        storage: backupStorage,
        mode: backupMode,
        compress: backupCompress,
        notes: backupNotes || undefined,
      });
      setMessage({ type: 'success', text: 'Backup task started. It may take a few minutes to complete.' });
      setShowCreate(false);
      setBackupNotes('');
      setTimeout(fetchBackups, 5000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally { setCreating(false); }
  };

  const handleRestore = async (volid) => {
    if (!confirm(`Restore VM ${vmid} from this backup? The current VM will be overwritten.`)) return;
    setMessage(null);
    try {
      await api.restoreBackup(node, type, vmid, volid);
      setMessage({ type: 'success', text: 'Restore task started. The VM will be recreated from the backup.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleDelete = async (volid) => {
    if (!confirm('Delete this backup permanently?')) return;
    setMessage(null);
    try {
      await api.deleteBackup(node, volid);
      setMessage({ type: 'success', text: 'Backup deleted' });
      fetchBackups();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const fmtDate = (ts) => {
    if (!ts) return '-';
    return new Date(ts * 1000).toLocaleString();
  };

  const fmtSize = (bytes) => formatBytes(bytes);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-gray-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {message && (
        <div className={`p-3 rounded-lg text-sm border flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
          'bg-red-50 text-red-700 border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Create backup form */}
      {showCreate ? (
        <div className="bg-slate-50 rounded-lg p-5 border border-gray-100 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Create Backup</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Storage</label>
              <select value={backupStorage} onChange={(e) => setBackupStorage(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                {storages.map((s) => (
                  <option key={s.storage} value={s.storage}>{s.storage}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Mode</label>
              <select value={backupMode} onChange={(e) => setBackupMode(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                <option value="snapshot">Snapshot (no downtime)</option>
                <option value="suspend">Suspend (brief pause)</option>
                <option value="stop">Stop (VM stops during backup)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Compression</label>
              <select value={backupCompress} onChange={(e) => setBackupCompress(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                <option value="zstd">ZSTD (recommended)</option>
                <option value="lzo">LZO (fast)</option>
                <option value="gzip">GZIP (compatible)</option>
                <option value="0">None</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Notes (optional)</label>
            <input type="text" value={backupNotes} onChange={(e) => setBackupNotes(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              placeholder="e.g. Before upgrade" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={creating}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium cursor-pointer disabled:opacity-50 transition-colors shadow-sm">
              {creating ? 'Starting...' : 'Start Backup'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium cursor-pointer transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Backup
          </button>
        </div>
      )}

      {/* Backup list */}
      {backups.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <p className="text-sm text-gray-400">No backups found for this VM</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-200">
                <th className="py-2.5 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="py-2.5 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Size</th>
                <th className="py-2.5 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Storage</th>
                <th className="py-2.5 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Format</th>
                <th className="py-2.5 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Notes</th>
                <th className="py-2.5 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b, i) => (
                <tr key={b.volid} className={`border-t border-gray-100 hover:bg-blue-50/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/70' : ''}`}>
                  <td className="py-2.5 px-4 text-sm text-gray-900">{fmtDate(b.ctime)}</td>
                  <td className="py-2.5 px-4 text-sm text-gray-500">{fmtSize(b.size)}</td>
                  <td className="py-2.5 px-4">
                    <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{b.storage}</span>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-gray-500">{b.format || '-'}</td>
                  <td className="py-2.5 px-4 text-xs text-gray-500 max-w-[200px] truncate">{b.notes || '-'}</td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleRestore(b.volid)} title="Restore"
                        className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(b.volid)} title="Delete"
                        className="p-1.5 rounded-md text-red-600 hover:bg-red-50 cursor-pointer transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          <Tab label="Backups" active={activeTab === 'backups'} onClick={() => setActiveTab('backups')}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>} />
        </div>
        <div className="p-6">
          {activeTab === 'config' && (
            <ConfigEditor node={node} type={type} vmid={vmid} config={config}
              isRunning={isRunning} isAdmin={isAdmin} onSaved={fetchData} />
          )}
          {activeTab === 'monitor' && (
            <MonitoringTab rrd={rrd} timeframe={timeframe} setTimeframe={setTimeframe} />
          )}
          {activeTab === 'backups' && (
            <BackupsTab node={node} type={type} vmid={vmid} />
          )}
        </div>
      </div>
    </div>
  );
}
