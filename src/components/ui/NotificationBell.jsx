import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Icon from './Icon';

/**
 * Notification bell with an unread badge and a dropdown inbox.
 *
 * Polls a dedicated count endpoint rather than fetching the whole list, so the
 * common case (nothing new) is one cheap query. The full list is only loaded
 * when the panel is actually opened.
 *
 * Polling rather than websockets is a deliberate trade: a municipal register does
 * not need sub-second delivery, and this keeps the deployment to a single process.
 */

const POLL_MS = 60000;

const ICON_FOR = {
  APPLICATION_SUBMITTED: 'check-circle',
  APPLICATION_APPROVED: 'check-circle',
  APPLICATION_DECLINED: 'alert-circle',
  APPLICATION_REOPENED: 'refresh',
  APPLICATION_UPDATED: 'edit',
  DOCUMENT_REJECTED: 'alert-triangle',
  DOCUMENT_ACCEPTED: 'check',
  WELCOME: 'user',
  NEW_REGISTRATION: 'user',
  NEW_APPLICATION: 'applications',
  APPLICATION_AWAITING_REVIEW: 'clock',
  APPLICATION_AT_RISK: 'clock',
  APPLICATION_BREACHED: 'alert-triangle',
};

const TONE_FOR = {
  APPLICATION_APPROVED: 'var(--success)',
  DOCUMENT_ACCEPTED: 'var(--success)',
  APPLICATION_DECLINED: 'var(--danger)',
  DOCUMENT_REJECTED: 'var(--warning)',
  APPLICATION_AT_RISK: 'var(--warning)',
  APPLICATION_BREACHED: 'var(--danger)',
};

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  const fetchCount = useCallback(async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      setUnread(res.data.data.unreadCount);
    } catch {
      // A failing badge must never interrupt the page.
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications', { params: { limit: 10 } });
      setItems(res.data.data || []);
      setUnread(res.data.unreadCount ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const timer = setInterval(fetchCount, POLL_MS);
    // Catch up immediately when the operator returns to the tab.
    const onVisible = () => { if (document.visibilityState === 'visible') fetchCount(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [fetchCount]);

  useEffect(() => {
    if (!open) return undefined;
    fetchList();
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, fetchList]);

  const openItem = async (item) => {
    setOpen(false);
    if (!item.readAt) {
      setItems((list) => list.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnread((c) => Math.max(0, c - 1));
      api.patch(`/notifications/${item.id}/read`).catch(() => {});
    }
    if (item.link) navigate(item.link);
  };

  const markAll = async () => {
    setUnread(0);
    setItems((list) => list.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
    try { await api.post('/notifications/read-all'); } catch { fetchList(); }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Icon name="bell" size={17} />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', top: 2, right: 2,
              minWidth: 16, height: 16, padding: '0 4px',
              display: 'grid', placeItems: 'center',
              borderRadius: 999, background: 'var(--brand)', color: '#fff',
              fontSize: '.625rem', fontWeight: 700, lineHeight: 1,
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="menu"
          role="dialog"
          aria-label="Notifications"
          style={{ width: 360, maxWidth: 'calc(100vw - 2rem)', padding: 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem', padding: '.7rem .85rem', borderBottom: '1px solid var(--line)' }}>
            <strong style={{ fontSize: '.875rem' }}>Notifications</strong>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAll}
                style={{ border: 0, background: 'none', color: 'var(--brand)', font: 'inherit', fontSize: '.8125rem', cursor: 'pointer', padding: 0 }}
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {loading ? (
              <div className="loading" style={{ padding: '1.5rem' }}><span className="spinner" /> Loading…</div>
            ) : items.length === 0 ? (
              <p className="muted" style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '.875rem', margin: 0 }}>
                Nothing yet. You will be told here when something changes.
              </p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  style={{
                    display: 'flex', gap: '.65rem', alignItems: 'flex-start',
                    width: '100%', padding: '.75rem .85rem',
                    border: 0, borderBottom: '1px solid var(--slate-100)',
                    background: item.readAt ? 'transparent' : 'var(--brand-soft)',
                    textAlign: 'left', font: 'inherit', cursor: 'pointer',
                  }}
                >
                  <span
                    className="doc-row-icon"
                    style={{ width: 28, height: 28, flex: 'none', color: TONE_FOR[item.type] || 'var(--ink-mute)' }}
                  >
                    <Icon name={ICON_FOR[item.type] || 'info'} size={14} />
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: '.8125rem', fontWeight: item.readAt ? 500 : 600, color: 'var(--ink)' }}>
                      {item.title}
                    </span>
                    {item.body ? (
                      <span style={{ display: 'block', fontSize: '.75rem', color: 'var(--ink-mute)', marginTop: '.15rem' }}>
                        {item.body}
                      </span>
                    ) : null}
                    <span style={{ display: 'block', fontSize: '.6875rem', color: 'var(--slate-400)', marginTop: '.2rem' }}>
                      {timeAgo(item.createdAt)}
                    </span>
                  </span>
                  {!item.readAt ? (
                    <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--brand)', flex: 'none', marginTop: '.35rem' }} />
                  ) : null}
                </button>
              ))
            )}
          </div>

          <div style={{ padding: '.6rem .85rem', borderTop: '1px solid var(--line)' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm btn-block"
              onClick={() => { setOpen(false); navigate('/notifications'); }}
            >
              View all notifications
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
