import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Applications', icon: '📋', end: true },
  { to: '/applicants', label: 'Applicants', icon: '👥' },
  { to: '/application-stats', label: 'Application Stats', icon: '📊' },
  { to: '/analytics', label: 'Analytics', icon: '📈' },
  { to: '/sla', label: 'SLA Monitor', icon: '⏱️' },
  { to: '/audit-logs', label: 'Audit Logs', icon: '📝' },
];

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} role="presentation" />}
      <aside className={`admin-sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-title">Indigent Register</span>
          <span className="sidebar-brand-sub">Admin Portal</span>
        </div>
        <nav className="sidebar-nav">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <span className="sidebar-icon">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
