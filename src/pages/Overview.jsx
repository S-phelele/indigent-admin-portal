import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import AdminLayout from '../components/AdminLayout';
import Icon from '../components/ui/Icon';
import LoadError, { loadErrorMessage } from '../components/LoadError';
import { useAuth } from '../context/AuthContext';

const ACTION_LABELS = {
  LOGIN: 'signed in',
  REGISTER: 'registered',
  VIEW_APPLICATION: 'viewed an application',
  APPROVE_APPLICATION: 'approved an application',
  DECLINE_APPLICATION: 'declined an application',
  EXPORT_APPLICANTS: 'exported applicants',
  EXPORT_APPLICATIONS: 'exported applications',
};

const SLA_TONE = {
  BREACHED: 'badge-declined',
  AT_RISK: 'badge-pending',
  ON_TRACK: 'badge-approved',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

export default function Overview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [sla, setSla] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, l, a] = await Promise.all([
          api.get('/admin/stats'),
          api.get('/admin/sla'),
          api.get('/admin/audit-logs', { params: { limit: 8 } }),
        ]);
        if (cancelled) return;
        setStats(s.data.data);
        setSla(l.data.data);
        setActivity(a.data.data || []);
      } catch (err) {
        if (!cancelled) setError(loadErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const queue = (sla?.items || []).slice(0, 6);

  return (
    <AdminLayout
      title="Overview"
      actions={
        <Link to="/applications" className="btn btn-primary btn-sm">
          <Icon name="applications" size={15} />
          Review applications
        </Link>
      }
    >
      <LoadError message={error} />

      <div className="page-head">
        <div>
          <h1>
            {greeting()}
            {user?.firstName ? `, ${user.firstName}` : ''}
          </h1>
          <p>
            {stats?.pending
              ? `${stats.pending} application${stats.pending === 1 ? '' : 's'} awaiting review.`
              : 'No applications are waiting for review.'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="loading"><span className="spinner" /> Loading overview…</div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Awaiting review</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats?.pending ?? 0}</div>
              <div className="stat-foot">Submitted, not yet decided</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Approved</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>{stats?.approved ?? 0}</div>
              <div className="stat-foot">Receiving support</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Declined</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats?.declined ?? 0}</div>
              <div className="stat-foot">Did not qualify</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">SLA breached</div>
              <div className="stat-value" style={{ color: sla?.summary?.breached ? 'var(--danger)' : undefined }}>
                {sla?.summary?.breached ?? 0}
              </div>
              <div className="stat-foot">
                Target {sla?.summary?.slaDays ?? 14} days
                {sla?.summary?.avgResolutionDays != null
                  ? ` · avg ${sla.summary.avgResolutionDays}d`
                  : ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: '1.25rem' }} className="overview-grid">
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-header">
                <h3 className="panel-title">Oldest awaiting review</h3>
                <Link to="/sla" className="btn btn-outline btn-sm">
                  SLA Monitor
                  <Icon name="chevron-right" size={14} />
                </Link>
              </div>

              {queue.length === 0 ? (
                <p className="muted" style={{ padding: '1.5rem 0', textAlign: 'center' }}>
                  Nothing is waiting. The review queue is clear.
                </p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Applicant</th>
                        <th className="num">Age</th>
                        <th>SLA</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => navigate(`/applications/${item.id}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{item.fullName}</div>
                            <div className="muted" style={{ fontSize: '.75rem' }}>{item.email}</div>
                          </td>
                          <td className="num">{item.ageDays}d</td>
                          <td>
                            <span className={`badge ${SLA_TONE[item.slaStatus] || 'badge-neutral'}`}>
                              {item.slaStatus.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="text-right">
                            <Icon name="chevron-right" size={15} className="muted" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-header">
                <h3 className="panel-title">Recent activity</h3>
                <Link to="/audit-logs" className="btn btn-outline btn-sm">
                  Audit log
                  <Icon name="chevron-right" size={14} />
                </Link>
              </div>

              {activity.length === 0 ? (
                <p className="muted" style={{ padding: '1.5rem 0', textAlign: 'center' }}>No recorded activity yet.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '.85rem' }}>
                  {activity.map((log) => (
                    <li key={log.id} style={{ display: 'flex', gap: '.65rem', alignItems: 'flex-start' }}>
                      <span className="doc-row-icon" style={{ width: 28, height: 28 }}>
                        <Icon
                          name={
                            log.action === 'APPROVE_APPLICATION' ? 'check'
                            : log.action === 'DECLINE_APPLICATION' ? 'close'
                            : log.action.startsWith('EXPORT') ? 'download'
                            : log.action === 'REGISTER' ? 'user'
                            : log.action === 'VIEW_APPLICATION' ? 'eye'
                            : 'logout'
                          }
                          size={14}
                        />
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '.8125rem', color: 'var(--ink)' }}>
                          <strong style={{ fontWeight: 600 }}>{log.userEmail || 'Someone'}</strong>{' '}
                          {ACTION_LABELS[log.action] || log.action.toLowerCase().replace(/_/g, ' ')}
                        </div>
                        <div className="muted" style={{ fontSize: '.75rem' }}>{timeAgo(log.createdAt)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
