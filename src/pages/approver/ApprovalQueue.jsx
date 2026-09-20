import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import Icon from '../../components/ui/Icon';
import LoadError, { loadErrorMessage } from '../../components/LoadError';
import { SkeletonTable, SkeletonStats, Refreshing } from '../../components/ui/Skeleton';
import { label, CATEGORY } from '../../utils/labels';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

/**
 * Work waiting at a stage of the approval chain.
 *
 * One queue for all three stages rather than three near-identical pages. It
 * opens on whichever stage the signed-in officer works, so an assessment officer
 * sees assessment work without choosing anything, and an administrator can move
 * between stages to see where the register is congested.
 *
 * Superuser deep-links use ?stage=VERIFICATION|ASSESSMENT|SUPERVISOR_SIGNOFF
 * so each sidebar entry opens the right queue directly.
 */

const STAGES = [
  { key: 'VERIFICATION', label: 'Verification queue', question: 'Is what the household declared true?' },
  { key: 'ASSESSMENT', label: 'Assessment queue', question: 'Do they qualify, and can the budget carry it?' },
  { key: 'SUPERVISOR_SIGNOFF', label: 'Awaiting signature', question: 'Is the file sound enough to sign?' },
];

const STAGE_KEYS = STAGES.map((s) => s.key);

const money = (n) => (n == null ? '—' : `R ${Number(n).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`);

export default function ApprovalQueue() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const stageFromUrl = STAGE_KEYS.includes(searchParams.get('stage')) ? searchParams.get('stage') : null;
  const [stage, setStage] = useState(stageFromUrl);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Keep local stage in sync when the sidebar navigates with ?stage=
  useEffect(() => {
    if (stageFromUrl && stageFromUrl !== stage) {
      setStage(stageFromUrl);
      setPage(1);
    }
  }, [stageFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const res = await api.get('/approvals/queue', {
        params: { ...(stage ? { stage } : {}), search: query, page, pageSize: 20 },
      });
      setRows(res.data.data);
      setMeta(res.data);
      // The server decides the default stage from the caller's role, so adopt it.
      if (!stage && res.data.stage) {
        setStage(res.data.stage);
        if (user?.role === 'SUPERUSER' || user?.role === 'ADMIN') {
          setSearchParams({ stage: res.data.stage }, { replace: true });
        }
      }
    } catch (err) {
      setError(loadErrorMessage(err));
    } finally {
      setFirstLoad(false);
      setRefreshing(false);
    }
  }, [stage, query, page, user?.role, setSearchParams]);

  useEffect(() => { load(); }, [load]);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERUSER';
  const current = STAGES.find((s) => s.key === (stage || meta?.stage));
  const totalPages = meta?.pagination?.totalPages || 1;

  const selectStage = (key) => {
    setStage(key);
    setPage(1);
    setSearchParams({ stage: key });
  };

  return (
    <AdminLayout
      title={current ? current.label : 'Approvals'}
      description={current?.question}
      actions={
        <button type="button" className="btn btn-outline btn-sm" onClick={load} disabled={refreshing}>
          <Icon name="refresh" size={15} /> {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <LoadError message={error} />

      {/* Administrators move between stages; an officer only has one. */}
      {isAdmin ? (
        firstLoad ? <SkeletonStats count={3} /> : (
          <div className="stats-grid">
            {STAGES.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`stat-card stat-card-button${(stage || meta?.stage) === s.key ? ' active' : ''}`}
                onClick={() => selectStage(s.key)}
              >
                <div>
                  <span className="stat-value">{meta?.counts?.[s.key] ?? 0}</span>
                  <span className="stat-label">{s.label}</span>
                </div>
              </button>
            ))}
          </div>
        )
      ) : null}

      <div className="toolbar">
        <form className="toolbar-search" onSubmit={(e) => { e.preventDefault(); setQuery(search); setPage(1); }}>
          <Icon name="search" size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Reference, name or ID number"
            aria-label="Search this queue"
          />
        </form>
      </div>

      {firstLoad ? (
        <SkeletonTable rows={8} columns={6} />
      ) : rows.length === 0 ? (
        <div className="table-empty">
          <Icon name="check" size={28} />
          <p>Nothing is waiting at this stage.</p>
        </div>
      ) : (
        <Refreshing active={refreshing}>
          <div className="table-card table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Reference</th>
                  <th className="nowrap">Waiting</th>
                  <th>Household</th>
                  <th>Declared income</th>
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
                          ? ` · ${label(CATEGORY, r.applicantCategory)}`
                          : ''}
                        {r.wardNumber ? ` · ${r.wardNumber}` : ''}
                      </small>
                    </td>
                    <td className="nowrap">{r.reference || '—'}</td>
                    <td className={r.waitingDays > 14 ? 'warn-cell nowrap' : 'nowrap'}>
                      {r.waitingDays == null ? '—' : `${r.waitingDays} day${r.waitingDays === 1 ? '' : 's'}`}
                    </td>
                    <td className="nowrap">{r.peopleOnProperty ?? '—'}</td>
                    <td className="num nowrap">{money(r.totalHouseholdIncome)}</td>
                    <td className="text-right">
                      {r.canAct ? (
                        <Link className="btn btn-sm btn-primary" to={`/approvals/${r.id}`}>
                          <Icon name="shield" size={14} /> Open
                        </Link>
                      ) : (
                        // Said here rather than on opening, so nobody clicks
                        // into a file only to be refused.
                        <span className="field-hint" title={r.blockedReason}>Not yours to take</span>
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
