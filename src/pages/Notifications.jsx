import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import AdminLayout from '../components/AdminLayout';
import Icon from '../components/ui/Icon';
import LoadError, { loadErrorMessage } from '../components/LoadError';
import { useToast } from '../components/ui/Toast';

const ICON_FOR = {
  APPLICATION_SUBMITTED: 'check-circle', APPLICATION_APPROVED: 'check-circle',
  APPLICATION_DECLINED: 'alert-circle', APPLICATION_REOPENED: 'refresh',
  APPLICATION_UPDATED: 'edit', DOCUMENT_REJECTED: 'alert-triangle',
  DOCUMENT_ACCEPTED: 'check', WELCOME: 'user',
  NEW_REGISTRATION: 'user', NEW_APPLICATION: 'applications',
  APPLICATION_AWAITING_REVIEW: 'clock',
  APPLICATION_AT_RISK: 'clock',
  APPLICATION_BREACHED: 'alert-triangle',
};

const LABEL_FOR = {
  APPLICATION_SUBMITTED: 'Submitted', APPLICATION_APPROVED: 'Approved',
  APPLICATION_DECLINED: 'Declined', APPLICATION_REOPENED: 'Reopened',
  APPLICATION_UPDATED: 'Updated', DOCUMENT_REJECTED: 'Document rejected',
  DOCUMENT_ACCEPTED: 'Document accepted', WELCOME: 'Welcome',
  NEW_REGISTRATION: 'New applicant', NEW_APPLICATION: 'New application',
  APPLICATION_AWAITING_REVIEW: 'Awaiting review',
  APPLICATION_AT_RISK: 'Approaching target',
  APPLICATION_BREACHED: 'Target missed',
};

export default function Notifications() {
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [unread, setUnread] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/notifications', { params: { page, limit: 25, unreadOnly: unreadOnly || undefined } });
      setItems(res.data.data || []);
      setUnread(res.data.unreadCount ?? 0);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(loadErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => { load(1); }, [load]);

  const open = async (item) => {
    if (!item.readAt) await api.patch(`/notifications/${item.id}/read`).catch(() => {});
    if (item.link) navigate(item.link);
    else load(pagination.page);
  };

  const markAll = async () => {
    try {
      const res = await api.post('/notifications/read-all');
      toast.success('All caught up', `${res.data.data.updated} notification(s) marked as read.`);
      load(pagination.page);
    } catch (err) {
      toast.error('Could not update', err.response?.data?.message || err.message);
    }
  };

  const remove = async (item, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${item.id}`);
      load(pagination.page);
    } catch (err) {
      toast.error('Could not remove', err.response?.data?.message || err.message);
    }
  };

  return (
    <AdminLayout
      title="Notifications"
      actions={unread > 0 ? (
        <button type="button" className="btn btn-outline btn-sm" onClick={markAll}>
          <Icon name="check" size={14} /> Mark all read
        </button>
      ) : null}
    >
      <LoadError message={error} />

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={!unreadOnly}
                className={`tab${!unreadOnly ? ' active' : ''}`} onClick={() => setUnreadOnly(false)}>
          All
        </button>
        <button type="button" role="tab" aria-selected={unreadOnly}
                className={`tab${unreadOnly ? ' active' : ''}`} onClick={() => setUnreadOnly(true)}>
          Unread{unread > 0 ? ` (${unread})` : ''}
        </button>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="loading"><span className="spinner" /> Loading notifications…</div>
        ) : items.length === 0 ? (
          <div className="table-empty">
            {unreadOnly ? 'Nothing unread.' : 'No notifications yet.'}
          </div>
        ) : (
          <div>
            {items.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => open(item)}
                onKeyDown={(e) => { if (e.key === 'Enter') open(item); }}
                style={{
                  display: 'flex', gap: '.85rem', alignItems: 'flex-start',
                  padding: '1rem 1.1rem', borderBottom: '1px solid var(--slate-100)',
                  background: item.readAt ? 'transparent' : 'var(--brand-soft)',
                  cursor: item.link ? 'pointer' : 'default',
                }}
              >
                <span className="doc-row-icon" style={{ flex: 'none' }}>
                  <Icon name={ICON_FOR[item.type] || 'info'} size={16} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: item.readAt ? 500 : 600, color: 'var(--ink)' }}>{item.title}</span>
                    <span className="badge badge-neutral">{LABEL_FOR[item.type] || item.type}</span>
                  </div>
                  {item.body ? (
                    <p className="muted" style={{ margin: '.25rem 0 0', fontSize: '.875rem' }}>{item.body}</p>
                  ) : null}
                  <p className="muted" style={{ margin: '.3rem 0 0', fontSize: '.75rem' }}>
                    {new Date(item.createdAt).toLocaleString('en-ZA')}
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={(e) => remove(item, e)}
                  aria-label="Remove notification"
                >
                  <Icon name="close" size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="pager">
          <span>Page {pagination.page} of {pagination.totalPages || 1} · {pagination.total} total</span>
          <div className="pager-actions">
            <button type="button" className="btn btn-outline btn-sm" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Prev</button>
            <button type="button" className="btn btn-outline btn-sm" disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}>Next</button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
