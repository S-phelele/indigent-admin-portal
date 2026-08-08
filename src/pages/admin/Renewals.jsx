import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../../components/AdminLayout';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import LoadError, { loadErrorMessage } from '../../components/LoadError';
import { SkeletonTable, SkeletonStats, Refreshing } from '../../components/ui/Skeleton';
import { friendlyError } from '../../utils/apiError';
import api from '../../services/api';

/**
 * Annual re-verification.
 *
 * A register that never expires drifts away from who actually qualifies — in
 * both directions. This is the working list that stops that: registrations
 * approaching their date, sorted soonest first, so a re-verification drive has
 * somewhere to start.
 *
 * Lapsed is deliberately not the same as declined. A household that lapsed
 * because nobody got to them has not been refused, and the wording here says so.
 */

const BUCKETS = [
  { key: '', label: 'All', tone: '' },
  { key: 'DUE_SOON', label: 'Due soon', tone: 'badge-draft' },
  { key: 'OVERDUE', label: 'Overdue', tone: 'badge-declined' },
  { key: 'LAPSED', label: 'Lapsed', tone: 'badge-declined' },
  { key: 'ACTIVE', label: 'Active', tone: 'badge-approved' },
];

const TONE = {
  ACTIVE: 'badge-approved',
  DUE_SOON: 'badge-draft',
  OVERDUE: 'badge-declined',
  LAPSED: 'badge-declined',
};

const dateZA = (d) => (d ? new Date(d).toLocaleDateString('en-ZA') : '—');

export default function Renewals() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [bucket, setBucket] = useState('DUE_SOON');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [renewing, setRenewing] = useState(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const res = await api.get('/renewals', {
        params: { ...(bucket ? { status: bucket } : {}), search: query, page, pageSize: 25 },
      });
      setRows(res.data.data);
      setMeta(res.data);
    } catch (err) {
      setError(loadErrorMessage(err));
    } finally {
      setFirstLoad(false);
      setRefreshing(false);
    }
  }, [bucket, query, page]);

  useEffect(() => { load(); }, [load]);

  const renew = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/renewals/${renewing.id}/renew`, { notes });
      toast.success(res.data.message);
      setRenewing(null);
      setNotes('');
      await load();
    } catch (err) {
      toast.error(friendlyError(err, 'Could not renew that registration.'));
    } finally {
      setBusy(false);
    }
  };

  const runCheck = async () => {
    try {
      const res = await api.post('/renewals/check');
      toast.success(res.data.message);
      await load();
    } catch (err) {
      toast.error(friendlyError(err, 'Could not run the check.'));
    }
  };

  const totalPages = meta?.pagination?.totalPages || 1;

  return (
    <AdminLayout
      title="Re-verification"
      description={
        meta?.policy
          ? `Registrations are valid for ${meta.policy.validMonths} months. Households are warned ${meta.policy.warnDays} days before expiry.`
          : 'Registrations that need to be re-verified.'
      }
      actions={
        <>
          <a className="btn btn-outline btn-sm" href={`/api/export/renewals.csv${bucket ? `?status=${bucket}` : ''}`}>
            <Icon name="download" size={15} /> Export
          </a>
          <button type="button" className="btn btn-outline btn-sm" onClick={runCheck}>
            <Icon name="refresh" size={15} /> Run check now
          </button>
        </>
      }
    >
      <LoadError message={error} />

      {firstLoad ? <SkeletonStats count={4} /> : (
        <div className="stats-grid">
          {BUCKETS.filter((b) => b.key).map((b) => (
            <button
              key={b.key}
              type="button"
              className={`stat-card stat-card-button${bucket === b.key ? ' active' : ''}`}
              onClick={() => { setBucket(bucket === b.key ? '' : b.key); setPage(1); }}
            >
              <div>
                <span className="stat-value">{meta?.counts?.[b.key] ?? 0}</span>
                <span className="stat-label">{b.label}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar-actions">
          {BUCKETS.map((b) => (
            <button
              key={b.key || 'all'}
              type="button"
              className={`pill${bucket === b.key ? ' active' : ''}`}
              onClick={() => { setBucket(b.key); setPage(1); }}
            >
              {b.label}
            </button>
          ))}
        </div>
        <form className="toolbar-search" onSubmit={(e) => { e.preventDefault(); setQuery(search); setPage(1); }}>
          <Icon name="search" size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Reference, name or ID" />
        </form>
      </div>

      {firstLoad ? (
        <SkeletonTable rows={8} columns={6} />
      ) : rows.length === 0 ? (
        <div className="table-empty">
          <Icon name="check" size={28} />
          <p>Nothing needs re-verification in this category.</p>
        </div>
      ) : (
        <Refreshing active={refreshing}>
          <div className="table-card table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Household</th>
                  <th>Reference</th>
                  <th className="nowrap">Expires</th>
                  <th className="nowrap">Days</th>
                  <th>State</th>
                  <th className="nowrap">Renewed</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <small>{r.idNumber || 'No ID recorded'}{r.wardNumber ? ` · ${r.wardNumber}` : ''}</small>
                    </td>
                    <td className="nowrap">{r.reference || '—'}</td>
                    <td className="nowrap">{dateZA(r.expiresAt)}</td>
                    <td className={`nowrap${r.daysRemaining < 0 ? ' warn-cell' : ''}`}>
                      {r.daysRemaining == null ? '—'
                        : r.daysRemaining < 0 ? `${Math.abs(r.daysRemaining)} overdue` : r.daysRemaining}
                    </td>
                    <td>
                      <span className={`badge ${TONE[r.currentStatus] || 'badge-neutral'}`}>
                        {BUCKETS.find((b) => b.key === r.currentStatus)?.label || r.currentStatus}
                      </span>
                    </td>
                    <td className="nowrap">{r.renewalCount || 0}×</td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => { setRenewing(r); setNotes(''); }}
                      >
                        <Icon name="refresh" size={14} /> Re-verify
                      </button>
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
          <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="muted">Page {page} of {totalPages}</span>
          <button type="button" className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      ) : null}

      <Modal open={Boolean(renewing)} title={`Re-verify ${renewing?.name || ''}`} onClose={() => setRenewing(null)}>
        <p className="field-hint">
          This extends the existing registration by {meta?.policy?.validMonths || 12} months. It does not create a new
          application, so the household keeps its history.
        </p>
        <div className="form-grid">
          <label className="form-group span-2">
            <span>What did you check?</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Confirmed still unemployed, household size unchanged, SASSA letter seen."
            />
            <small>Recorded against the registration and visible at audit.</small>
          </label>
          <div className="form-actions span-2">
            <button type="button" className="btn btn-ghost" onClick={() => setRenewing(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={renew} disabled={busy || !notes.trim()}>
              {busy ? 'Renewing…' : 'Renew for another year'}
            </button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
