/**
 * Loading placeholders.
 *
 * A centred spinner tells somebody that something is happening. A skeleton tells
 * them what is about to arrive, which is the difference between waiting and
 * wondering — and it stops the page jumping when the data lands, because the
 * space is already the right shape.
 *
 * Used for a first load. For a *refresh* of data already on screen, keep the old
 * data visible and dim it instead: replacing a table somebody is reading with
 * grey bars is a downgrade, not a loading state. `Refreshing` below does that.
 */

export function Skeleton({ width = '100%', height = 14, radius = 4, style }) {
  return (
    <span
      className="skeleton"
      aria-hidden="true"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

/** A few lines of text. */
export function SkeletonText({ lines = 3, width = '100%' }) {
  return (
    <span className="skeleton-stack" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        // The last line is short, the way a paragraph actually ends.
        <Skeleton key={i} width={i === lines - 1 ? '60%' : width} />
      ))}
    </span>
  );
}

/** Placeholder rows matching the shape of a data table. */
export function SkeletonTable({ rows = 6, columns = 5 }) {
  return (
    <div className="table-card" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <table>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c}>
                  <Skeleton width={c === 0 ? '70%' : '45%'} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Placeholder cards matching the stat row. */
export function SkeletonStats({ count = 4 }) {
  return (
    <div className="stats-grid" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="stat-card" key={i}>
          <Skeleton width={72} height={11} />
          <Skeleton width={54} height={26} style={{ marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}

/** Placeholder panel, for a chart or a form that has not arrived. */
export function SkeletonPanel({ height = 200, title = true }) {
  return (
    <div className="panel" aria-busy="true">
      {title ? <Skeleton width={160} height={13} style={{ marginBottom: 16 }} /> : null}
      <Skeleton height={height} radius={8} />
    </div>
  );
}

/**
 * Wraps content that is being refreshed in place.
 *
 * Keeps what is on screen readable and dims it, with a thin bar at the top of
 * the region. Somebody re-sorting a table should not lose the row they were
 * looking at.
 */
export function Refreshing({ active, children }) {
  return (
    <div className={`refreshable${active ? ' is-refreshing' : ''}`} aria-busy={active || undefined}>
      {active ? <span className="refresh-bar" aria-hidden="true" /> : null}
      {children}
    </div>
  );
}

export default Skeleton;
