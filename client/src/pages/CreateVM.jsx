import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const OS_TYPES = [
  { value: 'l26', label: 'Linux 6.x/5.x/4.x Kernel' },
  { value: 'l24', label: 'Linux 2.4 Kernel' },
  { value: 'win11', label: 'Windows 11/2022/2025' },
  { value: 'win10', label: 'Windows 10/2016/2019' },
  { value: 'win8', label: 'Windows 8/2012' },
  { value: 'win7', label: 'Windows 7/2008' },
  { value: 'wxp', label: 'Windows XP/2003' },
  { value: 'solaris', label: 'Solaris' },
  { value: 'other', label: 'Other' },
];

function SectionCard({ title, icon, children }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
        {icon}{title}
      </h3>
      <div className="bg-slate-50 rounded-lg p-5 border border-gray-100 space-y-4">
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

const inputClass = "w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50";
const selectClass = inputClass;

export default function CreateVM() {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState([]);
  const [isos, setISOs] = useState([]);
  const [storages, setStorages] = useState([]);
  const [bridges, setBridges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [node, setNode] = useState('');
  const [vmid, setVmid] = useState('');
  const [name, setName] = useState('');
  const [ostype, setOstype] = useState('l26');
  const [cores, setCores] = useState(2);
  const [sockets, setSockets] = useState(1);
  const [memory, setMemory] = useState(2048);
  const [diskSize, setDiskSize] = useState(32);
  const [diskStorage, setDiskStorage] = useState('');
  const [iso, setIso] = useState('');
  const [bridge, setBridge] = useState('');
  const [vlan, setVlan] = useState('');
  const [model, setModel] = useState('virtio');
  const [bios, setBios] = useState('seabios');
  const [machine, setMachine] = useState('');
  const [description, setDescription] = useState('');
  const [startAfter, setStartAfter] = useState(false);

  // Initial data fetch
  useEffect(() => {
    async function init() {
      try {
        const [nodesData, nextId] = await Promise.all([
          api.getNodes(),
          api.getNextID(),
        ]);
        setNodes(nodesData.filter((n) => n.status === 'online').sort((a, b) => a.node.localeCompare(b.node)));
        setVmid(String(nextId.vmid));
        if (nodesData.length > 0) {
          const first = nodesData.filter((n) => n.status === 'online').sort((a, b) => a.node.localeCompare(b.node))[0];
          if (first) setNode(first.node);
        }
      } catch {}
      finally { setLoading(false); }
    }
    init();
  }, []);

  // Fetch node-specific data when node changes
  const fetchNodeData = useCallback(async () => {
    if (!node) return;
    try {
      const [storageData, isoStorages, networkData] = await Promise.all([
        api.getAllStorages(node),
        api.getStorages(node),
        api.getNetworks(node),
      ]);

      // Storages that support disk images
      const diskStorages = storageData.filter((s) =>
        s.content && (s.content.includes('images') || s.content.includes('rootdir'))
      );
      setStorages(diskStorages);
      if (diskStorages.length > 0 && !diskStorage) setDiskStorage(diskStorages[0].storage);

      // ISOs from all ISO-capable storages
      const allISOs = [];
      for (const s of isoStorages) {
        try {
          const list = await api.getISOs(node, s.storage);
          allISOs.push(...list);
        } catch {}
      }
      setISOs(allISOs.sort((a, b) => (a.volid || '').localeCompare(b.volid || '')));

      // Network bridges
      setBridges(networkData.sort((a, b) => (a.iface || '').localeCompare(b.iface || '')));
      if (networkData.length > 0 && !bridge) setBridge(networkData[0].iface);
    } catch {}
  }, [node]);

  useEffect(() => { fetchNodeData(); }, [fetchNodeData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    const config = {
      vmid: Number(vmid),
      name,
      cores: Number(cores),
      sockets: Number(sockets),
      memory: Number(memory),
      ostype,
      bios,
    };

    // Disk
    if (diskStorage && diskSize) {
      config.scsi0 = `${diskStorage}:${diskSize},iothread=1`;
    }

    // ISO
    if (iso) {
      config.ide2 = `${iso},media=cdrom`;
    }

    // Network
    if (bridge) {
      let net = `${model},bridge=${bridge}`;
      if (vlan) net += `,tag=${vlan}`;
      config.net0 = net;
    }

    // Boot order
    const bootDevs = [];
    if (config.scsi0) bootDevs.push('scsi0');
    if (config.ide2) bootDevs.push('ide2');
    if (config.net0) bootDevs.push('net0');
    if (bootDevs.length > 0) config.boot = `order=${bootDevs.join(';')}`;

    if (machine) config.machine = machine;
    if (description) config.description = description;

    try {
      const result = await api.createVM(node, config);
      if (startAfter) {
        // Wait a bit for creation task, then start
        setTimeout(async () => {
          try { await api.vmAction(node, 'qemu', vmid, 'start'); } catch {}
        }, 5000);
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-7 h-7 border-2 border-gray-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-blue-600 text-sm transition-colors cursor-pointer">
          &larr; Back to Dashboard
        </button>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 text-white flex items-center justify-center shadow-sm">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Virtual Machine</h1>
          <p className="text-sm text-gray-400 mt-0.5">Configure and deploy a new QEMU VM</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 mb-6 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General */}
        <SectionCard title="General" icon={
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
        }>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Node">
              <select value={node} onChange={(e) => setNode(e.target.value)} className={selectClass} required>
                {nodes.map((n) => (
                  <option key={n.node} value={n.node}>{n.node}</option>
                ))}
              </select>
            </Field>
            <Field label="VM ID">
              <input type="number" value={vmid} onChange={(e) => setVmid(e.target.value)} className={inputClass} required min={100} />
            </Field>
            <Field label="Name">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required placeholder="my-vm" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="OS Type">
              <select value={ostype} onChange={(e) => setOstype(e.target.value)} className={selectClass}>
                {OS_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="Optional notes" />
            </Field>
          </div>
        </SectionCard>

        {/* CPU & Memory */}
        <SectionCard title="CPU & Memory" icon={
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        }>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="CPU Cores">
              <input type="number" value={cores} onChange={(e) => setCores(e.target.value)} className={inputClass} min={1} max={128} />
            </Field>
            <Field label="Sockets">
              <input type="number" value={sockets} onChange={(e) => setSockets(e.target.value)} className={inputClass} min={1} max={4} />
            </Field>
            <Field label="Memory (MB)">
              <input type="number" value={memory} onChange={(e) => setMemory(e.target.value)} className={inputClass} min={128} step={128} />
            </Field>
          </div>
        </SectionCard>

        {/* Storage */}
        <SectionCard title="Storage" icon={
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
          </svg>
        }>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Disk Storage">
              <select value={diskStorage} onChange={(e) => setDiskStorage(e.target.value)} className={selectClass}>
                {storages.map((s) => (
                  <option key={s.storage} value={s.storage}>{s.storage} ({s.type})</option>
                ))}
              </select>
            </Field>
            <Field label="Disk Size (GB)">
              <input type="number" value={diskSize} onChange={(e) => setDiskSize(e.target.value)} className={inputClass} min={1} max={10240} />
            </Field>
          </div>
          <Field label="ISO Image">
            <select value={iso} onChange={(e) => setIso(e.target.value)} className={selectClass}>
              <option value="">None</option>
              {isos.map((i) => (
                <option key={i.volid} value={i.volid}>{i.volid}</option>
              ))}
            </select>
          </Field>
        </SectionCard>

        {/* Network */}
        <SectionCard title="Network" icon={
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
        }>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Bridge">
              <select value={bridge} onChange={(e) => setBridge(e.target.value)} className={selectClass}>
                <option value="">None</option>
                {bridges.map((b) => (
                  <option key={b.iface} value={b.iface}>{b.iface}</option>
                ))}
              </select>
            </Field>
            <Field label="NIC Model">
              <select value={model} onChange={(e) => setModel(e.target.value)} className={selectClass}>
                <option value="virtio">VirtIO (recommended)</option>
                <option value="e1000">Intel E1000</option>
                <option value="rtl8139">Realtek RTL8139</option>
                <option value="vmxnet3">VMware vmxnet3</option>
              </select>
            </Field>
            <Field label="VLAN Tag" hint="Leave empty for no VLAN">
              <input type="number" value={vlan} onChange={(e) => setVlan(e.target.value)} className={inputClass} min={1} max={4094} placeholder="Optional" />
            </Field>
          </div>
        </SectionCard>

        {/* Advanced */}
        <SectionCard title="Advanced" icon={
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        }>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="BIOS">
              <select value={bios} onChange={(e) => setBios(e.target.value)} className={selectClass}>
                <option value="seabios">SeaBIOS (Legacy)</option>
                <option value="ovmf">OVMF (UEFI)</option>
              </select>
            </Field>
            <Field label="Machine Type" hint="Leave empty for default (i440fx)">
              <select value={machine} onChange={(e) => setMachine(e.target.value)} className={selectClass}>
                <option value="">Default (i440fx)</option>
                <option value="q35">Q35</option>
              </select>
            </Field>
          </div>
        </SectionCard>

        {/* Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={startAfter} onChange={(e) => setStartAfter(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
            Start VM after creation
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate('/')}
              className="px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={creating}
              className="px-6 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium cursor-pointer disabled:opacity-50 transition-colors shadow-sm">
              {creating ? 'Creating...' : 'Create VM'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
