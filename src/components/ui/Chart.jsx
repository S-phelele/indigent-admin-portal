/**
 * Charts, drawn as inline SVG.
 *
 * No charting library. Recharts and its peers pull in several hundred kilobytes
 * for what amounts to four shapes, and this portal is opened over municipal
 * connections. Everything here is a handful of `<path>` elements that inherit
 * the design system's tokens, so nothing needs re-theming.
 *
 * Existing classes are reused wherever the design system already has them —
 * `.bar-list`, `.bar-row`, `.chart-legend` and friends all predate this file.
 *
 * Every chart degrades to a stated "no data yet" rather than an empty grid,
 * because an empty grid reads as zero, and zero applications is a very different
 * claim from no applications recorded.
 */

const Empty = ({ label }) => (
  <p className="chart-empty">{label || 'No data for this period yet.'}</p>
);

const niceMax = (value) => {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
};

/** Multi-series line chart over dates. */
export function LineChart({ data = [], series = [], height = 220 }) {
  const rows = data.filter(Boolean);
  if (rows.length === 0) return <Empty />;

  const max = niceMax(Math.max(1, ...rows.flatMap((row) => series.map((s) => row[s.key] || 0))));
  const width = 1000;
  const pad = { top: 12, right: 12, bottom: 28, left: 38 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const x = (i) => pad.left + (rows.length === 1 ? plotW / 2 : (i / (rows.length - 1)) * plotW);
  const y = (v) => pad.top + plotH - (v / max) * plotH;
  const line = (key) => rows.map((row, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(row[key] || 0).toFixed(1)}`).join(' ');

  const gridValues = [...new Set([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f)))];
  const tickEvery = Math.max(1, Math.ceil(rows.length / 6));

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Activity trend">
        {gridValues.map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={pad.left - 8} y={y(v) + 4} className="chart-axis" textAnchor="end">{v}</text>
          </g>
        ))}

        {rows.map((row, i) => (i % tickEvery === 0 ? (
          <text key={row.date} x={x(i)} y={height - 8} className="chart-axis" textAnchor="middle">
            {new Date(row.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
          </text>
        ) : null))}

        {series.map((s) => (
          <path
            key={s.key}
            d={line(s.key)}
            fill="none"
            stroke={s.colour}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>

      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key} className="legend-item">
            <span className="legend-swatch" style={{ background: s.colour }} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bars — the right shape for category names of varying length. */
export function BarList({ items = [], valueKey = 'count', labelKey = 'label', emptyLabel, showPercent = true }) {
  const rows = items.filter((i) => i && Number.isFinite(Number(i[valueKey])));
  const total = rows.reduce((sum, i) => sum + Number(i[valueKey]), 0);
  if (rows.length === 0 || total === 0) return <Empty label={emptyLabel} />;

  const max = Math.max(...rows.map((i) => Number(i[valueKey])));

  return (
    <div className="bar-list">
      {rows.map((item) => {
        const value = Number(item[valueKey]);
        return (
          <div className="bar-row" key={item.key ?? item[labelKey] ?? item.name}>
            <span className="bar-label" title={item[labelKey] ?? item.name}>{item[labelKey] ?? item.name}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
            </span>
            <span className="bar-count">
              {value}
              {showPercent ? <small className="bar-pct">{Math.round((value / total) * 100)}%</small> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Donut for a small number of parts of a whole.
 *
 * Capped at five slices on purpose: beyond that the eye cannot compare arcs and
 * a bar list is simply better.
 */
export function Donut({ items = [], size = 160, thickness = 20, centreLabel }) {
  const slices = items.filter((i) => Number(i.count) > 0).slice(0, 5);
  const total = slices.reduce((sum, i) => sum + Number(i.count), 0);
  if (total === 0) return <Empty />;

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Proportional breakdown">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {slices.map((item) => {
            const dash = (Number(item.count) / total) * circumference;
            const arc = (
              <circle
                key={item.key || item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={item.colour}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return arc;
          })}
        </g>
        <text x="50%" y="48%" textAnchor="middle" className="donut-value">{total}</text>
        {centreLabel ? <text x="50%" y="63%" textAnchor="middle" className="donut-caption">{centreLabel}</text> : null}
      </svg>

      <div className="donut-legend">
        {slices.map((item) => (
          <div className="legend-item" key={item.key || item.label}>
            <span className="legend-swatch" style={{ background: item.colour }} />
            <span className="donut-legend-label">{item.label}</span>
            <strong className="num">{item.count}</strong>
            <small className="muted">{Math.round((Number(item.count) / total) * 100)}%</small>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Stepped funnel — each bar sized against the first step. */
export function Funnel({ steps = [] }) {
  if (!steps.length || !steps[0].count) return <Empty label="Nobody has registered yet." />;

  return (
    <ol className="funnel">
      {steps.map((step) => (
        <li key={step.key}>
          <div className="funnel-head">
            <span>{step.label}</span>
            <strong className="num">{step.count}</strong>
          </div>
          <div className="bar-track">
            <span className="bar-fill" style={{ width: `${Math.max(1.5, step.percentOfStart)}%` }} />
          </div>
          <div className="funnel-foot">
            <small className="muted">{step.percentOfStart}% of everyone registered</small>
            {step.dropFromPrevious > 0 ? <small className="funnel-drop">−{step.dropFromPrevious} lost here</small> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * A single proportion, shown against an explicit target.
 *
 * Used for service-level compliance, where "82%" means nothing without knowing
 * what was promised.
 */
export function Gauge({ value, target = 90, label, caption }) {
  if (value === null || value === undefined) return <Empty label="No decisions recorded yet." />;

  const tone = value >= target ? 'is-good' : value >= target - 15 ? 'is-warn' : 'is-bad';

  return (
    <div className={`gauge ${tone}`}>
      <div className="gauge-value">{value}<small>%</small></div>
      <div className="gauge-track">
        <span className="gauge-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
        <span className="gauge-target" style={{ left: `${Math.min(100, target)}%` }} title={`Target ${target}%`} />
      </div>
      <div className="gauge-foot">
        <span>{label}</span>
        <small className="muted">Target {target}%</small>
      </div>
      {caption ? <p className="field-hint">{caption}</p> : null}
    </div>
  );
}
