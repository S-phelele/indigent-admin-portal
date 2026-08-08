import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import Icon from '../../components/ui/Icon';
import LoadError, { loadErrorMessage } from '../../components/LoadError';
import api from '../../services/api';

/**
 * Everything this councillor has captured.
 *
 * Scoped by the server to their own work — one councillor cannot see another
 * ward's households. The status column is the point: a councillor is asked
 * "what happened to my application?" in the street, and needs to be able to
 * answer without phoning the municipality.
 */

const STATUS = {
  DRAFT: { label: 'Not submitted', tone: 'draft' },
  PENDING: { label: 'With a reviewer', tone: 'neutral' },
  APPROVED: { label: 'Approved', tone: 'approved' },
  DECLINED: { label: 'Not approved', tone: 'declined' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Unfinished' },
  { key: 'pending', label: 'With a reviewer' },
  { key: 'approved', label: 'Approved' },
  { key: 'declined', label: 'Not approved' },
];

export default function MyCaptures() {
  const [captures, setCaptures] = useState([]);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/fieldwork/captures', { params: { status, search } })
      .then((res) => setCaptures(res.data.data))
      .catch((err) => setError(loadErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  return (
    <AdminLayout
      title="My captures"
      description="Households you have registered, and where each one stands."
      actions={
        <Link className="btn btn-primary" to="/capture">
          <Icon name="userPlus" size={16} /> Register a household
        </Link>
      }
    >
      <LoadError message={error} />

      <div className="toolbar">
        <div className="toolbar-actions">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`pill${status === f.key ? ' active' : ''}`}
              onClick={() => setStatus(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <form
          className="toolbar-search"
          onSubmit={(e) => { e.preventDefault(); load(); }}
        >
          <Icon name="search" size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, ID number or reference"
            aria-label="Search your captures"
          />
        </form>
      </div>

      {loading ? (
        <div className="loading"><span className="spinner" /> Loading…</div>
      ) : captures.length === 0 ? (
        <div className="table-empty">
          <Icon name="applications" size={28} />
          <p>
            {status === 'all'
              ? 'You have not captured any households yet.'
              : 'Nothing in this category.'}
          </p>
          {status === 'all' ? (
            <Link className="btn btn-primary" to="/capture">Register your first household</Link>
          ) : null}
        </div>
      ) : (
        <div className="table-card table-scroll">
          <table>
            <thead>
              <tr>
                <th>Household</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Documents</th>
                <th>Captured</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {captures.map((c) => {
                const tone = STATUS[c.status] || { label: c.status, tone: 'neutral' };
                return (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <small className="muted">{c.idNumber || 'No ID recorded'}</small>
                    </td>
                    <td>{c.reference || <span className="muted">Not yet issued</span>}</td>
                    <td><span className={`badge badge-${tone.tone}`}>{tone.label}</span></td>
                    <td>
                      <div className="progress-mini" title={c.outstanding || 'All documents supplied'}>
                        <span style={{ width: `${c.documentProgress?.percent ?? 0}%` }} />
                      </div>
                      <small className="muted">
                        {c.documentProgress?.done ?? 0} of {c.documentProgress?.total ?? 0}
                      </small>
                    </td>
                    <td>{c.capturedAt ? new Date(c.capturedAt).toLocaleDateString('en-ZA') : '—'}</td>
                    <td className="text-right">
                      {c.status === 'DRAFT' ? (
                        <Link className="btn btn-sm btn-primary" to={`/applications/${c.id}/capture`}>
                          <Icon name="edit" size={14} /> Continue
                        </Link>
                      ) : (
                        <span className="field-hint">Submitted</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
