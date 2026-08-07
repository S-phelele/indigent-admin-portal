import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import Icon from '../components/ui/Icon';
import LoadError, { loadErrorMessage } from '../components/LoadError';
import { SkeletonTable, SkeletonStats, Refreshing } from '../components/ui/Skeleton';
import api from '../services/api';

/**
 * Applications waiting to be verified.
 *
 * Ordered oldest first, always. A queue sorted newest-first is how applications
 * rot at the bottom while the person who filed them assumes somebody is looking.
 */

const STAGES = [
  { key: 'all', label: 'Everything' },
  { key: 'NOT_STARTED', label: 'Not started' },
  { key: 'IN_VERIFICATION', label: 'In progress' },
  { key: 'AWAITING_INFORMATION', label: 'Waiting on applicant' },
  { key: 'RECOMMENDED', label: 'Recommended' },
];

const STAGE_BADGE = {
  NOT_STARTED: 'badge-neutral',
  IN_VERIFICATION: 'badge-draft',
  AWAITING_INFORMATION: 'badge-draft',
  RECOMMENDED: 'badge-approved',
};

const CATEGORY_LABELS = {
  STANDARD: 'Standard',
  PENSIONER: 'Pensioner',
  DECEASED_ESTATE: 'Deceased estate',
  CHILD_HEADED: 'Child-headed',
  DISABLED: 'Disabled',
};

export default function VerificationQueue() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [stage, setStage] = useState('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  // `firstLoad` drives skeletons; `refreshing` dims what is already on screen.
  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const res = await api.get('/verification/queue', { params: { stage, search: query, page, pageSize: 20 } });
      setRows(res.data.data);
      setMeta(res.data);
    } catch (err) {
      setError(loadErrorMessage(err));
    } finally {
      setFirstLoad(false);
      setRefreshing(false);
    }
  }, [stage, query, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = meta?.pagination?.totalPages || 1;

  return (
    <AdminLayout
      title="Verification queue"
      description="Applications submitted and awaiting checks. Oldest first."
      actions={
        <button type="button" className="btn btn-outline btn-sm" onClick={load} disabled={refreshing}>
          <Icon name="refresh" size={15} /> {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <LoadError message={error} />

      {firstLoad ? <SkeletonStats count={4} /> : (
        <div className="stats-grid">
          {STAGES.slice(1).map((s) => (
            <button
              key={s.key}
              type="button"
              className={`stat-card stat-card-button${stage === s.key ? ' active' : ''}`}
              onClick={() => { setStage(stage === s.key ? 'all' : s.key); setPage(1); }}
            >
              <div>
                <span className="stat-value">{meta?.stages?.[s.key] ?? 0}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar-actions">
          {STAGES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`pill${stage === s.key ? ' active' : ''}`}
              onClick={() => { setStage(s.key); setPage(1); }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <form className="toolbar-search" onSubmit={(e) => { e.preventDefault(); setQuery(search); setPage(1); }}>
          <Icon name="search" size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Reference, name or ID number"
            aria-label="Search the verification queue"
          />
        </form>
      </div>

      {firstLoad ? (
        <SkeletonTable rows={8} columns={6} />
      ) : rows.length === 0 ? (
        <div className="table-empty">
          <Icon name="check" size={28} />
          <p>Nothing waiting in this category.</p>
        </div>
      ) : (
        <Refreshing active={refreshing}>
          <div className="table-card table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Reference</th>
                  <th>Waiting</th>
                  <th>Stage</th>
                  <th>Progress</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <small>
                        {r.idNumber || 'No ID recorded'}
                        {r.applicantCategory && r.applicantCategory !== 'STANDARD'
                          ? ` · ${CATEGORY_LABELS[r.applicantCategory]}`
                          : ''}
                        {r.wardNumber ? ` · ${r.wardNumber}` : ''}
                      </small>
                    </td>
                    <td className="nowrap">{r.reference || '—'}</td>
                    <td className={r.waitingDays > 14 ? 'warn-cell nowrap' : 'nowrap'}>
                      {r.waitingDays === null ? '—' : `${r.waitingDays} day${r.waitingDays === 1 ? '' : 's'}`}
                    </td>
                    <td>
                      <span className={`badge ${STAGE_BADGE[r.verificationStage] || 'badge-neutral'}`}>
                        {STAGES.find((s) => s.key === r.verificationStage)?.label || r.verificationStage}
                      </span>
                      {r.recommendation ? (
                        <small>{r.recommendation.toLowerCase()} recommended</small>
                      ) : null}
                    </td>
                    <td>
                      <small>
                        {r.visits} visit{r.visits === 1 ? '' : 's'} · {r.checks} check{r.checks === 1 ? '' : 's'}
                      </small>
                      {!r.consentComplete ? (
                        <small className="is-warn">Consent incomplete</small>
                      ) : null}
                      {r.failedVisitCount > 0 ? (
                        <small className="is-warn">{r.failedVisitCount} failed visit{r.failedVisitCount === 1 ? '' : 's'}</small>
                      ) : null}
                    </td>
                    <td className="text-right">
                      {r.mine ? (
                        // Separation of duties: somebody who captured an
                        // application cannot also verify it. Saying so here saves
                        // them opening it to be refused.
                        <span className="field-hint" title="You captured this application">
                          Yours to capture, not to verify
                        </span>
                      ) : (
                        <Link className="btn btn-sm btn-primary" to={`/verification/${r.id}`}>
                          <Icon name="shield" size={14} /> Verify
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Refreshing>
      )}

      {totalPages > 1 ? (
        <div className="pagination">
          <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="muted">Page {page} of {totalPages}</span>
          <button type="button" className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      ) : null}
    </AdminLayout>
  );
}
