import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function MonitorChart({ title, data, dataKeys, unit = '', formatter }) {
  const format = formatter || ((v) => `${typeof v === 'number' ? v.toFixed(2) : v}${unit}`);

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10 }}
            tickFormatter={(t) => {
              const d = new Date(t * 1000);
              return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
            }}
          />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={format} />
          <Tooltip
            labelFormatter={(t) => new Date(t * 1000).toLocaleTimeString()}
            formatter={(v) => format(v)}
          />
          {dataKeys.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
