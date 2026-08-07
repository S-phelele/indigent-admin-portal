import { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import Icon from '../components/ui/Icon';
import LoadError, { loadErrorMessage } from '../components/LoadError';
import api from '../services/api';
import { label, SMS_PURPOSE, SMS_STATUS } from '../utils/labels';

/**
 * Every SMS the register has tried to send.
 *
 * Answers the question that comes up at the counter more than any other: "nobody
 * ever told me". It also makes the whole notification design testable without a
 * gateway account — with the console provider the messages are written here and
 * can be read, so a full application can be walked through end to end.
 *
 * Temporary passwords are redacted before storage, so nothing on this page is a
 * live credential.
 */

const PURPOSE_LABELS = {
  WELCOME: 'Welcome',
  WELCOME_CREDENTIALS: 'Sign-in details',
  PASSWORD_RESET_STAFF: 'Staff password reset',
  APPLICATION_SUBMITTED: 'Application submitted',
  CAPTURED_BY_COUNCILLOR: 'Captured in the field',
  APPLICATION_APPROVED: 'Approved',
  APPLICATION_DECLINED: 'Declined',
  APPLICATION_REOPENED: 'Reopened',
  DOCUMENT_REJECTED: 'Document rejected',
  OTP: 'Verification code',
  PASSWORD_RESET: 'Password reset',
};

const STATUS_TONE = { SENT: 'approved', FAILED: 'declined', QUEUED: 'draft' };

export default function SmsOutbox() {
  const [messages, setMessages] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [purpose, setPurpose] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/admin/sms', { params: { page, purpose, status, search: query, pageSize: 25 } })
      .then((res) => {
        setMessages(res.data.data);
        setMeta(res.data);
      })
      .catch((err) => setError(loadErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [page, purpose, status, query]);

  const totalPages = meta?.pagination?.totalPages || 1;

  return (
    <AdminLayout
      title="SMS outbox"
      description="Every message sent to residents and staff, with what became of it."
    >
      <LoadError message={error} />

      {meta?.notice ? (
        <div className="alert alert-info" role="status">
          <Icon name="info" size={16} />
          <span>{meta.notice}</span>
        </div>
      ) : null}

      <div className="stats-grid">
        {['SENT', 'FAILED', 'QUEUED'].map((key) => (
          <div key={key} className="stat-card">
            <span className={`stat-icon is-${STATUS_TONE[key]}`}>
              <Icon name={key === 'FAILED' ? 'alert' : key === 'SENT' ? 'check' : 'clock'} size={18} />
            </span>
            <div>
              <span className="stat-value">{meta?.filters?.statuses?.[key] ?? 0}</span>
              <span className="stat-label">{label(SMS_STATUS, key)}</span>
            </div>
          </div>
        ))}
        <div className="stat-card">
          <span className="stat-icon"><Icon name="message" size={18} /></span>
          <div>
            <span className="stat-value">{meta?.provider || '—'}</span>
            <span className="stat-label">Provider</span>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-actions">
          {[
            { key: 'all', label: 'All' },
            { key: 'SENT', label: 'Sent' },
            { key: 'FAILED', label: 'Failed' },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              className={`pill${status === f.key ? ' active' : ''}`}
              onClick={() => { setStatus(f.key); setPage(1); }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select
          value={purpose}
          onChange={(e) => { setPurpose(e.target.value); setPage(1); }}
          aria-label="Filter by message type"
        >
          <option value="all">All message types</option>
          {(meta?.filters?.purposes || []).map((p) => (
            <option key={p.value} value={p.value}>
              {label(SMS_PURPOSE, p.value)} ({p.count})
            </option>
          ))}
        </select>

        <form className="toolbar-search" onSubmit={(e) => { e.preventDefault(); setQuery(search); setPage(1); }}>
          <Icon name="search" size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Number or message text"
            aria-label="Search messages"
          />
        </form>
      </div>

      {loading ? (
        <div className="loading"><span className="spinner" /> Loading…</div>
      ) : messages.length === 0 ? (
        <div className="table-empty">
          <Icon name="message" size={28} />
          <p>No messages match this filter.</p>
        </div>
      ) : (
        <>
          <ul className="sms-list">
            {messages.map((m) => (
              <li key={m.id} className={`sms-item ${m.status === 'FAILED' ? 'failed' : ''}`}>
                <div className="sms-meta">
                  <span className={`badge badge-${STATUS_TONE[m.status]}`}>{label(SMS_STATUS, m.status)}</span>
                  <span className="sms-purpose">{label(SMS_PURPOSE, m.purpose)}</span>
                  <span className="muted">{m.toNumber}</span>
                  <span className="field-hint">
                    {new Date(m.createdAt).toLocaleString('en-ZA')}
                    {m.segments > 1 ? ` · ${m.segments} segments` : ''}
                  </span>
                </div>
                <pre className="sms-body">{m.body}</pre>
                {m.error ? <p className="sms-error"><Icon name="alert" size={14} /> {m.error}</p> : null}
              </li>
            ))}
          </ul>

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
        </>
      )}
    </AdminLayout>
  );
}
