import { useState, useEffect } from 'react';
import api from '../services/api';
import AdminLayout from '../components/AdminLayout';

function SimpleLineChart({ data, keys, colors, height = 220 }) {
  if (!data?.length) return <p className="muted">No data for this period</p>;
  const w = 800;
  const h = height;
  const pad = { t: 16, r: 16, b: 36, l: 36 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxY = Math.max(1, ...data.flatMap((d) => keys.map((k) => d[k] || 0)));
  const x = (i) => pad.l + (i / Math.max(1, data.length - 1)) * innerW;
  const y = (v) => pad.t + innerH - (v / maxY) * innerH;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w, display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const yy = pad.t + innerH * (1 - t);
          return (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={yy} y2={yy} stroke="#e5e7eb" />
              <text x={pad.l - 6} y={yy + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                {Math.round(maxY * t)}
              </text>
            </g>
          );
        })}
        {keys.map((key, ki) => {
          const pts = data.map((d, i) => `${x(i)},${y(d[key] || 0)}`).join(' ');
          return (
            <polyline
              key={key}
              fill="none"
              stroke={colors[ki]}
              strokeWidth="2.5"
              points={pts}
            />
          );
        })}
        {/* x labels every ~5 points */}
        {data.map((d, i) =>
          i % Math.ceil(data.length / 6) === 0 || i === data.length - 1 ? (
            <text key={d.date} x={x(i)} y={h - 8} textAnchor="middle" fontSize="9" fill="#9ca3af">
              {d.date.slice(5)}
            </text>
          ) : null
        )}
      </svg>
      <div className="chart-legend">
        {keys.map((k, i) => (
          <span key={k} className="legend-item">
            <span className="legend-swatch" style={{ background: colors[i] }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ segments }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const r = 60;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
      <svg width="160" height="160" viewBox="0 0 160 160">
        <g transform="translate(80,80)">
          {segments.map((seg) => {
            const len = (seg.value / total) * c;
            const el = (
              <circle
                key={seg.label}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth="24"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-acc}
                transform="rotate(-90)"
              />
            );
            acc += len;
            return el;
          })}
          <text textAnchor="middle" dy="6" fontSize="18" fontWeight="700" fill="#111">
            {total}
          </text>
        </g>
      </svg>
      <div>
        {segments.map((s) => (
          <div key={s.label} className="legend-item" style={{ marginBottom: '0.35rem' }}>
            <span className="legend-swatch" style={{ background: s.color }} />
            {s.label}: <strong>{s.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/admin/stats/analytics', { params: { days } })
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  const status = data?.statusTotals || {};
  const segments = [
    { label: 'Draft', value: status.draft || 0, color: '#9ca3af' },
    { label: 'Pending', value: status.pending || 0, color: '#f59e0b' },
    { label: 'Approved', value: status.approved || 0, color: '#10b981' },
    { label: 'Declined', value: status.declined || 0, color: '#ef4444' },
  ];

  return (
    <AdminLayout title="Analytics">
      <div className="toolbar">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="muted">Period:</span>
          {[7, 30, 60, 90].map((d) => (
            <button
              key={d}
              type="button"
              className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading analytics...</div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">New Registrations</div>
              <div className="stat-value">{data?.totals?.registrations ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">New Applications</div>
              <div className="stat-value">{data?.totals?.applications ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Approved (period)</div>
              <div className="stat-value" style={{ color: '#047857' }}>{data?.totals?.approved ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Declined (period)</div>
              <div className="stat-value" style={{ color: '#b91c1c' }}>{data?.totals?.declined ?? 0}</div>
            </div>
          </div>

          <div className="panel">
            <h3 className="panel-title">Application status breakdown</h3>
            <DonutChart segments={segments} />
          </div>

          <div className="panel">
            <h3 className="panel-title">Daily registrations & applications</h3>
            <SimpleLineChart
              data={data?.series || []}
              keys={['registrations', 'applications']}
              colors={['#e31c23', '#3b82f6']}
            />
          </div>

          <div className="panel">
            <h3 className="panel-title">Daily decisions (Approved vs Declined)</h3>
            <SimpleLineChart
              data={data?.series || []}
              keys={['approved', 'declined']}
              colors={['#10b981', '#ef4444']}
            />
          </div>
        </>
      )}
    </AdminLayout>
  );
}
