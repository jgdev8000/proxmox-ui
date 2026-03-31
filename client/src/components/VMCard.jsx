import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { api } from '../api/client';
import { useState } from 'react';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function VMCard({ vm, onRefresh }) {
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
    <div className="bg-white rounded-lg shadow border border-gray-200 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <Link
            to={`/vm/${vm.node}/${type}/${vm.vmid}`}
            className="font-semibold text-gray-900 hover:text-blue-600"
          >
            {vm.name || `VM ${vm.vmid}`}
          </Link>
          <p className="text-xs text-gray-500 mt-0.5">
            {type.toUpperCase()} {vm.vmid} &middot; {vm.node}
          </p>
        </div>
        <StatusBadge status={vm.status} />
      </div>

      {isRunning && (
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div>
            <span className="text-gray-400">CPU</span>{' '}
            {((vm.cpu || 0) * 100).toFixed(1)}%
          </div>
          <div>
            <span className="text-gray-400">RAM</span>{' '}
            {formatBytes(vm.mem)} / {formatBytes(vm.maxmem)}
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        {isRunning ? (
          <>
            <button
              disabled={acting}
              onClick={() => doAction('shutdown')}
              className="flex-1 text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-200 py-1.5 rounded cursor-pointer disabled:opacity-50"
            >
              Shutdown
            </button>
            <button
              disabled={acting}
              onClick={() => doAction('reboot')}
              className="flex-1 text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 py-1.5 rounded cursor-pointer disabled:opacity-50"
            >
              Reboot
            </button>
            <button
              disabled={acting}
              onClick={() => doAction('stop')}
              className="flex-1 text-xs bg-red-100 text-red-800 hover:bg-red-200 py-1.5 rounded cursor-pointer disabled:opacity-50"
            >
              Stop
            </button>
          </>
        ) : (
          <button
            disabled={acting}
            onClick={() => doAction('start')}
            className="flex-1 text-xs bg-green-100 text-green-800 hover:bg-green-200 py-1.5 rounded cursor-pointer disabled:opacity-50"
          >
            Start
          </button>
        )}
      </div>
    </div>
  );
}
