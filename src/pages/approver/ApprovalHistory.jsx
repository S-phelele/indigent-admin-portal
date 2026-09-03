import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import Icon from '../../components/ui/Icon';
import LoadError, { loadErrorMessage } from '../../components/LoadError';
import { SkeletonTable, Refreshing } from '../../components/ui/Skeleton';
import api from '../../services/api';

/**
 * Everything the signed-in officer has personally decided.
 *
 * The queue only ever shows what is still waiting — the moment a case is
 * decided it leaves that screen, and there was nowhere to look back at it. A
 * verification officer, an assessment officer and a supervisor all end up
 * asking the same question — "what have I actually done" — so this is one
 * page reading one endpoint, the same way the queue itself is one page for
 * all three stages.
 */

const OUTCOME_LABELS = {
  RECOMMEND_APPROVE: 'Recommended approval',
  RECOMMEND_REJECT: 'Recommended rejection',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RETURNED: 'Returned',
};

const OUTCOME_TONE = {
  RECOMMEND_APPROVE: 'badge-uploaded',
  APPROVED: 'badge-uploaded',
  RECOMMEND_REJECT: 'badge-declined',
  REJECTED: 'badge-declined',
  RETURNED: 'badge-pending',
};

const dateZA = (d) => (d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default function ApprovalHistory() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const res = await api.get('/approvals/history', { params: { page, pageSize: 20 } });
      setRows(res.data.data);
      setMeta(res.data);
    } catch (err) {
      setError(loadErrorMessage(err));
    } finally {
      setFirstLoad(false);
      setRefreshing(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = meta?.pagination?.totalPages || 1;

  return (
    <AdminLayout
      title="History"
      description="Every case you have personally decided, most recent first."
      actions={
        <button type="button" className="btn btn-outline btn-sm" onClick={load} disabled={refreshing}>
          <Icon name="refresh" size={15} /> {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <LoadError message={error} />

      {firstLoad ? (
        <SkeletonTable rows={8} columns={6} />
      ) : rows.length === 0 ? (
        <div className="table-empty">
          <Icon name="clock" size={28} />
          <p>Nothing decided yet. Cases you act on will appear here.</p>
        </div>
      ) : (
        <Refreshing active={refreshing}>
          <div className="table-card table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Reference</th>
                  <th>Stage</th>
                  <th>Your decision</th>
                  <th className="nowrap">Decided</th>
                  <th>Now stands as</th>
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
                        {r.wardNumber ? ` · ${r.wardNumber}` : ''}
                      </small>
                    </td>
                    <td className="nowrap">{r.reference || '—'}</td>
                    <td>{r.stageLabel || r.stage}</td>
                    <td>
                      <span className={`badge ${OUTCOME_TONE[r.outcome] || 'badge-optional'}`}>
                        {OUTCOME_LABELS[r.outcome] || r.outcome}
                      </span>
                      {r.isOverride ? <small className="field-hint is-warn"> · taken alone</small> : null}
                      {r.outcome === 'RETURNED' && r.returnReason ? (
                        <small className="field-hint">{r.returnReason}</small>
                      ) : null}
                    </td>
                    <td className="nowrap">{dateZA(r.decidedAt)}</td>
                    <td>{r.currentStatus}</td>
                    <td className="text-right">
                      <Link className="btn btn-sm btn-outline" to={`/applications/${r.applicationId}/print`}>
                        <Icon name="file" size={14} /> View
                      </Link>
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
