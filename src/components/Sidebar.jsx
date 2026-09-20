import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from './ui/Icon';

/**
 * Navigation is grouped so destinations read as jobs rather than as one
 * undifferentiated list.
 *
 * SUPERUSER gets its own section layout (below) so Verification / Assessment /
 * Sign-off are not three copies of "My queue" pointing at the same home route.
 */

const ADMIN = ['ADMIN'];
const FIELD = ['COUNCILLOR', 'CAPTURE_OFFICER'];
const VERIFIER = ['VERIFICATION_OFFICER'];
const ASSESSOR = ['ASSESSMENT_OFFICER'];
const SUPERVISOR = ['SUPERVISOR'];
const STAFF = ['ADMIN', 'SUPERUSER', 'COUNCILLOR', 'CAPTURE_OFFICER', 'VERIFICATION_OFFICER', 'ASSESSMENT_OFFICER', 'SUPERVISOR'];

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
      { to: '/history', label: 'History', icon: 'clock' },
    ],
  },
  {
    label: 'Assessment',
    roles: ASSESSOR,
    links: [
      { to: '/', label: 'My queue', icon: 'shield', end: true },
      { to: '/renewals', label: 'Re-verification', icon: 'refresh' },
      { to: '/history', label: 'History', icon: 'clock' },
    ],
  },
  {
    label: 'Sign-off',
    roles: SUPERVISOR,
    links: [
      { to: '/', label: 'Awaiting my signature', icon: 'key', end: true },
      { to: '/renewals', label: 'Re-verification', icon: 'refresh' },
      { to: '/history', label: 'History', icon: 'clock' },
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
      { to: '/privacy', label: 'Privacy', icon: 'key' },
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

/**
 * Superuser navigation — one clear path through the chain.
 *
 * Queues open the shared approvals board locked to a stage. Histories open the
 * personal history list filtered to that stage (API scopes to actorId = me).
 */
const SUPERUSER_SECTIONS = [
  {
    label: 'Fieldwork',
    links: [
      { to: '/capture', label: 'Register a household', icon: 'userPlus' },
      { to: '/captures', label: 'My captures', icon: 'applications' },
    ],
  },
  {
    label: 'Casework',
    links: [
      { to: '/', label: 'Overview', icon: 'dashboard', end: true },
      { to: '/applications', label: 'Applications', icon: 'applications' },
      { to: '/applicants', label: 'Applicants', icon: 'users' },
    ],
  },
  {
    label: 'Verification',
    links: [
      { to: '/approvals?stage=VERIFICATION', label: 'Verification queue', icon: 'shield' },
      { to: '/verification', label: 'Site visits and checks', icon: 'mapPin' },
      { to: '/history?stage=VERIFICATION', label: 'Verification history', icon: 'clock' },
    ],
  },
  {
    label: 'Assessment',
    links: [
      { to: '/approvals?stage=ASSESSMENT', label: 'Assessment queue', icon: 'shield' },
      { to: '/history?stage=ASSESSMENT', label: 'Assessed history', icon: 'clock' },
    ],
  },
  {
    label: 'Sign-off',
    links: [
      { to: '/approvals?stage=SUPERVISOR_SIGNOFF', label: 'Awaiting my signature', icon: 'key' },
      { to: '/history?stage=SUPERVISOR_SIGNOFF', label: 'Signed history', icon: 'clock' },
    ],
  },
  {
    label: 'Reporting',
    links: [
      { to: '/application-stats', label: 'Application Stats', icon: 'chart' },
      { to: '/analytics', label: 'Analytics', icon: 'trending' },
    ],
  },
  {
    label: 'Oversight',
    links: [
      { to: '/renewals', label: 'Re-verification', icon: 'refresh' },
      { to: '/sla', label: 'SLA Monitor', icon: 'clock' },
      { to: '/staff', label: 'Staff', icon: 'userCheck' },
      { to: '/sms', label: 'SMS Outbox', icon: 'message' },
      { to: '/audit-logs', label: 'Audit Logs', icon: 'audit' },
      { to: '/privacy', label: 'Privacy', icon: 'key' },
    ],
  },
  {
    label: 'Account',
    links: [
      { to: '/notifications', label: 'Notifications', icon: 'bell' },
      { to: '/profile', label: 'My profile', icon: 'user' },
    ],
  },
];

const ROLE_LABELS = {
  SUPERUSER: 'Super Administrator',
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

/** Match path + optional query so stage-specific links highlight correctly. */
function linkIsActive(pathname, search, to, end) {
  const [path, query] = to.split('?');
  if (end) {
    if (pathname !== path) return false;
  } else if (path === '/') {
    if (pathname !== '/') return false;
  } else if (pathname !== path && !pathname.startsWith(`${path}/`)) {
    return false;
  }
  if (!query) {
    // Plain /approvals or /history should not stay active when a stage query is set.
    if ((path === '/approvals' || path === '/history') && new URLSearchParams(search).get('stage')) {
      return false;
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  }
  const want = new URLSearchParams(query);
  const have = new URLSearchParams(search);
  for (const [k, v] of want.entries()) {
    if (have.get(k) !== v) return false;
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function Sidebar({ open, collapsed, onNavigate, onSignOut, counts = {} }) {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  const navRef = useRef(null);

  const sections = user?.role === 'SUPERUSER'
    ? SUPERUSER_SECTIONS
    : SECTIONS.filter((s) => s.roles.includes(user?.role));

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector('.sidebar-link.active');
    if (!nav || !active) return;

    const top = active.offsetTop;
    const bottom = top + active.offsetHeight;
    const viewTop = nav.scrollTop;
    const viewBottom = viewTop + nav.clientHeight;
    const margin = 8;
    if (top >= viewTop + margin && bottom <= viewBottom - margin) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    nav.scrollTo({
      top: Math.max(0, top - nav.clientHeight / 2 + active.offsetHeight / 2),
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, [pathname, search, collapsed]);

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
                className={() =>
                  `sidebar-link${linkIsActive(pathname, search, link.to, link.end) ? ' active' : ''}`
                }
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
