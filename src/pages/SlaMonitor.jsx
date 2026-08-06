import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import AdminLayout from '../components/AdminLayout';

export default function SlaMonitor() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/sla')
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const badge = (status) => {
    const map = {
      ON_TRACK: 'badge-uploaded',
      AT_RISK: 'badge-pending',
      BREACHED: 'badge-declined',
    };
    return <span className={`badge ${map[status] || 'badge-draft'}`}>{status.replace('_', ' ')}</span>;
  };

  return (
    <AdminLayout title="SLA Monitor">
      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: '1rem' }}>
            Target: review applications within <strong>{data?.summary?.slaDays ?? 14}</strong> days of submission.
            Configure via backend <code>SLA_DAYS</code> environment variable.
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
                  <th>Applicant</th>
                  <th>Submitted</th>
                  <th>Age (days)</th>
                  <th>Remaining</th>
                  <th>SLA Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(data?.items || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)' }}>
                      No pending applications
                    </td>
                  </tr>
                ) : (
                  (data?.items || []).map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div>{item.fullName}</div>
                        <div className="muted" style={{ fontSize: '0.8rem' }}>{item.email}</div>
                      </td>
                      <td>{item.submittedDate}</td>
                      <td>{item.ageDays}</td>
                      <td>{item.remainingDays}</td>
                      <td>{badge(item.slaStatus)}</td>
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
