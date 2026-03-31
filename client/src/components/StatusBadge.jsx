const STATUS_CONFIG = {
  running: { dot: 'bg-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  stopped: { dot: 'bg-red-400', bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200' },
  paused:  { dot: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
};

const DEFAULT = { dot: 'bg-gray-400', bg: 'bg-gray-50', text: 'text-gray-600', ring: 'ring-gray-200' };

export default function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || DEFAULT;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ring-1 ring-inset ${c.bg} ${c.text} ${c.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${status === 'running' ? 'animate-pulse' : ''}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
