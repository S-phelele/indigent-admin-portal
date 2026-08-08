import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import AdminLayout from '../../components/AdminLayout';
import LoadError, { loadErrorMessage } from '../../components/LoadError';
import Icon from '../../components/ui/Icon';
import { useToast } from '../../components/ui/Toast';

export default function SlaMonitor() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const load = () =>
    api.get('/admin/sla')
      .then((res) => setData(res.data.data))
      .catch((err) => setError(loadErrorMessage(err)))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  /**
   * The sweep normally runs on a timer. This forces it now — useful after
   * changing the target, or to confirm the escalation is working.
   */
  const runCheck = async () => {
    setChecking(true);
    try {
      const res = await api.post('/admin/sla/check');
      const { skipped, announced = [] } = res.data.data || {};
      if (skipped) toast.info('Already running', 'Another instance is doing the check right now.');
      else if (announced.length === 0) toast.success('Check complete', 'Nothing new to escalate.');
      else toast.warning(`${announced.length} escalation(s)`, announced.map((a) => `${a.reference || a.id.slice(0, 8)} — ${a.level.replace('_', ' ').toLowerCase()}`).join(', '));
      await load();
    } catch (err) {
      toast.error('Check failed', err.response?.data?.message || err.message);
    } finally {
      setChecking(false);
    }
  };

  const badge = (status) => {
    const map = {
      ON_TRACK: 'badge-uploaded',
      AT_RISK: 'badge-pending',
      BREACHED: 'badge-declined',
    };
    return <span className={`badge ${map[status] || 'badge-draft'}`}>{status.replace('_', ' ')}</span>;
  };

  return (
    <AdminLayout
      title="SLA Monitor"
      actions={
        <button type="button" className="btn btn-outline btn-sm" onClick={runCheck} disabled={checking}>
          <Icon name="refresh" size={14} />
          {checking ? 'Checking…' : 'Run check now'}
        </button>
      }
    >
      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          <LoadError message={error} />
          <p className="muted" style={{ marginBottom: '1rem' }}>
            Service target: applications are reviewed within{' '}
            <strong>{data?.summary?.slaDays ?? 14} days</strong> of submission. Applications with{' '}
            <strong>{data?.summary?.atRiskWithinDays ?? 3} days</strong> or fewer remaining are flagged as at
            risk. Administrators are notified automatically the first time an application reaches each level.
          </p>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Pending</div>
              <div className="stat-value">{data?.summary?.totalPending ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">On Track</div>
              <div className="stat-value" style={{ color: '#047857' }}>{data?.summary?.onTrack ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">At Risk (≤3 days)</div>
              <div className="stat-value" style={{ color: '#b45309' }}>{data?.summary?.atRisk ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Breached</div>
              <div className="stat-value" style={{ color: '#b91c1c' }}>{data?.summary?.breached ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg. resolution (days)</div>
              <div className="stat-value">{data?.summary?.avgResolutionDays ?? '—'}</div>
            </div>
          </div>

          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Applicant</th>
                  <th>Submitted</th>
                  <th className="num">Age (days)</th>
                  <th className="num">Remaining</th>
                  <th>SLA Status</th>
                  <th>Notified</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {(data?.items || []).length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-400)' }}>
                      No pending applications
                    </td>
                  </tr>
                ) : (
                  (data?.items || []).map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.8125rem' }}>{item.displayId}</td>
                      <td>
                        <div>{item.fullName}</div>
                        <div className="muted" style={{ fontSize: '0.8rem' }}>{item.email}</div>
                      </td>
                      <td className="nowrap">{item.submittedDate}</td>
                      <td className="num">{item.ageDays}</td>
                      <td className="num">{item.remainingDays}</td>
                      <td>{badge(item.slaStatus)}</td>
                      <td>
                        {item.notifiedLevel ? (
                          <span className="badge badge-neutral">
                            {item.notifiedLevel === 'BREACHED' ? 'Target missed' : 'Approaching'}
                          </span>
                        ) : (
                          <span className="muted" style={{ fontSize: '.8125rem' }}>—</span>
                        )}
                      </td>
                      <td>
                        <Link to={`/applications/${item.id}`} className="btn btn-outline btn-sm">View</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
