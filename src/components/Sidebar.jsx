import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from './ui/Icon';

/**
 * Navigation is grouped so destinations read as jobs rather than as one
 * undifferentiated list.
 *
 * Each section carries the roles it belongs to. A ward councillor sees three
 * links — register a household, their own captures, their profile — because
 * everything else in this portal is either work they may not do or somebody
 * else's households. Hiding it is not only tidier: a councillor holding a phone
 * at a gate should not have to find the one button that matters.
 *
 * The server enforces the same boundary. This list decides what is offered, not
 * what is permitted.
 */
const ADMIN = ['ADMIN'];
const FIELD = ['COUNCILLOR', 'CAPTURE_OFFICER'];
const VERIFIER = ['VERIFICATION_OFFICER'];
const ASSESSOR = ['ASSESSMENT_OFFICER'];
const SUPERVISOR = ['SUPERVISOR'];
const STAFF = ['ADMIN', 'COUNCILLOR', 'CAPTURE_OFFICER', 'VERIFICATION_OFFICER', 'ASSESSMENT_OFFICER', 'SUPERVISOR'];

const SECTIONS = [
  {
    label: 'Fieldwork',
    roles: FIELD,
    links: [
      { to: '/', label: 'My work', icon: 'dashboard', end: true },
      { to: '/capture', label: 'Register a household', icon: 'userPlus' },
      { to: '/captures', label: 'My captures', icon: 'applications' },
    ],
  },
  {
    label: 'Casework',
    roles: ADMIN,
    links: [
      { to: '/', label: 'Overview', icon: 'dashboard', end: true },
      { to: '/applications', label: 'Applications', icon: 'applications' },
      { to: '/applicants', label: 'Applicants', icon: 'users' },
      { to: '/capture', label: 'Register a household', icon: 'userPlus' },
    ],
  },
  {
    label: 'Reporting',
    roles: ADMIN,
    links: [
      { to: '/application-stats', label: 'Application Stats', icon: 'chart' },
      { to: '/analytics', label: 'Analytics', icon: 'trending' },
    ],
  },
  {
    label: 'Verification',
    roles: VERIFIER,
    links: [
      { to: '/', label: 'My queue', icon: 'shield', end: true },
      { to: '/verification', label: 'Site visits and checks', icon: 'mapPin' },
    ],
  },
  {
    label: 'Assessment',
    roles: ASSESSOR,
    links: [
      { to: '/', label: 'My queue', icon: 'shield', end: true },
      { to: '/renewals', label: 'Re-verification', icon: 'refresh' },
    ],
  },
  {
    label: 'Sign-off',
    roles: SUPERVISOR,
    links: [
      { to: '/', label: 'Awaiting my signature', icon: 'key', end: true },
      { to: '/renewals', label: 'Re-verification', icon: 'refresh' },
    ],
  },
  {
    label: 'Oversight',
    roles: ADMIN,
    links: [
      { to: '/approvals', label: 'Approvals', icon: 'shield' },
      { to: '/verification', label: 'Site visits', icon: 'mapPin' },
      { to: '/renewals', label: 'Re-verification', icon: 'refresh' },
      { to: '/sla', label: 'SLA Monitor', icon: 'clock' },
      { to: '/staff', label: 'Staff', icon: 'userCheck' },
      { to: '/sms', label: 'SMS Outbox', icon: 'message' },
      { to: '/audit-logs', label: 'Audit Logs', icon: 'audit' },
    ],
  },
  {
    label: 'Account',
    roles: STAFF,
    links: [
      { to: '/notifications', label: 'Notifications', icon: 'bell' },
      { to: '/profile', label: 'My profile', icon: 'user' },
    ],
  },
];

const ROLE_LABELS = {
  ADMIN: 'Administrator',
  COUNCILLOR: 'Ward Councillor',
  CAPTURE_OFFICER: 'Capture Officer',
  VERIFICATION_OFFICER: 'Verification Officer',
  ASSESSMENT_OFFICER: 'Assessment Officer',
  SUPERVISOR: 'Supervisor',
};

const initials = (user) => {
  const from = [user?.firstName, user?.lastName].filter(Boolean);
  if (from.length) return from.map((s) => s[0]).join('').toUpperCase();
  return (user?.email || 'A').slice(0, 2).toUpperCase();
};

export default function Sidebar({ open, collapsed, onNavigate, onSignOut, counts = {} }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navRef = useRef(null);

  const sections = SECTIONS.filter((s) => s.roles.includes(user?.role));

  /**
   * Keep the current page visible in the navigation.
   *
   * An administrator has enough destinations that the list scrolls, so opening
   * the Audit Log — the last item — could leave the sidebar showing Overview at
   * the top with nothing highlighted. `block: 'nearest'` scrolls only when the
   * item is actually out of view, so a link already on screen does not cause the
   * list to jump under the pointer.
   */
  useEffect(() => {
    const active = navRef.current?.querySelector('.sidebar-link.active');
    if (!active) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    active.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [pathname, collapsed]);

  return (
    <aside className={`admin-sidebar${open ? ' open' : ''}`} aria-label="Main navigation">
      <div className="sidebar-brand">
        <span className="sidebar-mark" aria-hidden="true">IR</span>
        <span className="sidebar-brand-text">
          <span className="sidebar-brand-title">Indigent Register</span>
          <span className="sidebar-brand-sub">
            {user?.role === 'COUNCILLOR' ? (user.ward || 'Ward Councillor') : (ROLE_LABELS[user?.role] || 'Administration')}
          </span>
        </span>
      </div>

      <nav className="sidebar-nav" ref={navRef}>
        {sections.map((section) => (
          <div key={section.label}>
            <div className="sidebar-section">{section.label}</div>
            {section.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={onNavigate}
                title={collapsed ? link.label : undefined}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              >
                <span className="sidebar-icon">
                  <Icon name={link.icon} size={17} />
                </span>
                <span className="sidebar-link-label">{link.label}</span>
                {counts[link.to] ? <span className="sidebar-count">{counts[link.to]}</span> : null}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-user">
          <span className="avatar" aria-hidden="true">{initials(user)}</span>
          <span className="sidebar-user-text">
            <span className="sidebar-user-name">
              {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Administrator'}
            </span>
            <span className="sidebar-user-role">{ROLE_LABELS[user?.role] || user?.role}</span>
          </span>
          <button type="button" className="sidebar-signout" onClick={onSignOut} title="Sign out" aria-label="Sign out">
            <Icon name="logout" size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
