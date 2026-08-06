import { useState, useEffect } from 'react';
import api from '../services/api';
import AdminLayout from '../components/AdminLayout';
import { exportToExcel, exportToPdf } from '../utils/export';

export default function ApplicationStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats/applications')
      .then((res) => setStats(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async (type) => {
    try {
      const res = await api.get('/admin/export/applications');
      const data = res.data.data || [];
      if (type === 'excel') exportToExcel(data, 'applications.csv');
      else exportToPdf(data, 'Applications Report', 'applications');
    } catch (err) {
      alert(err.response?.data?.message || 'Export failed');
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Application Stats">
        <div className="loading">Loading...</div>
      </AdminLayout>
    );
  }

  const maxEmp = Math.max(1, ...(stats?.byEmployment || []).map((e) => e.count));

  return (
    <AdminLayout title="Application Stats">
      <div className="toolbar" style={{ marginBottom: '1.25rem' }}>
        <div />
        <div className="toolbar-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => handleExport('excel')}>Export Excel</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => handleExport('pdf')}>Export PDF</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Total</div><div className="stat-value">{stats?.total ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Draft</div><div className="stat-value">{stats?.draft ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Pending</div><div className="stat-value" style={{ color: '#b45309' }}>{stats?.pending ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Approved</div><div className="stat-value" style={{ color: '#047857' }}>{stats?.approved ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Declined</div><div className="stat-value" style={{ color: '#b91c1c' }}>{stats?.declined ?? 0}</div></div>
        <div className="stat-card"><div className="stat-label">Approval Rate</div><div className="stat-value">{stats?.approvalRate ?? 0}%</div></div>
      </div>

      <div className="panel">
        <h3 className="panel-title">By Employment Status</h3>
        {(stats?.byEmployment || []).length === 0 ? (
          <p className="muted">No data</p>
        ) : (
          <div className="bar-list">
            {stats.byEmployment.map((e) => (
              <div key={e.status} className="bar-row">
                <span className="bar-label">{e.status}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(e.count / maxEmp) * 100}%` }} />
                </div>
                <span className="bar-count">{e.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h3 className="panel-title">Daily activity (last 30 days)</h3>
        <div className="table-card">
          <table>
            <thead>
              <tr><th>Date</th><th>Created</th><th>Submitted</th></tr>
            </thead>
            <tbody>
              {(stats?.dailyActivity || []).filter((d) => d.created || d.submitted).slice(-14).map((d) => (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td>{d.created}</td>
                  <td>{d.submitted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
