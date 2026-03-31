import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import MonitorChart from '../components/MonitorChart';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function VMDetail() {
  const { node, type, vmid } = useParams();
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

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm"
              >
                Console
              </Link>
              <button disabled={acting} onClick={() => doAction('shutdown')}
                className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 px-4 py-2 rounded text-sm cursor-pointer disabled:opacity-50">
                Shutdown
              </button>
              <button disabled={acting} onClick={() => doAction('reboot')}
                className="bg-blue-100 text-blue-800 hover:bg-blue-200 px-4 py-2 rounded text-sm cursor-pointer disabled:opacity-50">
                Reboot
              </button>
              <button disabled={acting} onClick={() => doAction('stop')}
                className="bg-red-100 text-red-800 hover:bg-red-200 px-4 py-2 rounded text-sm cursor-pointer disabled:opacity-50">
                Force Stop
              </button>
            </>
          ) : (
            <button disabled={acting} onClick={() => doAction('start')}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm cursor-pointer disabled:opacity-50">
              Start
            </button>
          )}
        </div>
      </div>

      {isRunning && rrd.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Monitoring</h2>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
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
