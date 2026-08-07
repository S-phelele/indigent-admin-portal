import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Icon from './ui/Icon';
import NotificationBell from './ui/NotificationBell';
import { ConfirmModal } from './ui/Modal';

const COLLAPSE_KEY = 'admin_sidebar_collapsed';

/**
 * Application chrome: fixed sidebar, sticky topbar, content well.
 *
 * The sidebar has two independent states — `collapsed` is the desktop rail
 * (persisted, because it is a standing preference) and `open` is the mobile
 * drawer (transient, and closed on every navigation).
 */
export default function AdminLayout({ children, title, description, actions, breadcrumb }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const isNarrow = () => window.matchMedia('(max-width: 900px)').matches;

  const toggleSidebar = useCallback(() => {
    if (isNarrow()) setDrawerOpen((v) => !v);
    else setCollapsed((v) => !v);
  }, []);

  const signOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`admin-shell${collapsed ? ' collapsed' : ''}`}>
      <Sidebar
        open={drawerOpen}
        collapsed={collapsed}
        onNavigate={() => setDrawerOpen(false)}
        onSignOut={() => setConfirmSignOut(true)}
      />

      {drawerOpen ? (
        <div className="sidebar-overlay" onClick={() => setDrawerOpen(false)} role="presentation" />
      ) : null}

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="sidebar-toggle"
              onClick={toggleSidebar}
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              aria-expanded={!collapsed}
            >
              <Icon name={collapsed ? 'chevrons-right' : 'chevrons-left'} size={18} className="hide-narrow" />
            </button>
            <div style={{ minWidth: 0 }}>
              {breadcrumb ? <div className="crumbs">{breadcrumb}</div> : null}
              {title ? <h1 className="topbar-title">{title}</h1> : null}
            </div>
          </div>

          <div className="topbar-actions">
            {actions}
            <NotificationBell />
            <button
              type="button"
              className="icon-btn"
              onClick={() => navigate(0)}
              title="Refresh data"
              aria-label="Refresh data"
            >
              <Icon name="refresh" size={16} />
            </button>
          </div>
        </header>

        <main className="admin-content">
          {description ? (
            <div className="page-head">
              <div>
                <p>{description}</p>
              </div>
            </div>
          ) : null}
          {children}
        </main>
      </div>

      <ConfirmModal
        open={confirmSignOut}
        title="Sign out?"
        description="You will need to sign in again to review applications."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        variant="danger"
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={signOut}
      />
    </div>
  );
}
