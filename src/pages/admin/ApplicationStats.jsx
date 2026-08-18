import { useState, useEffect } from 'react';
import api from '../../services/api';
import AdminLayout from '../../components/AdminLayout';
import { exportToExcel, exportToPdf } from '../../utils/export';
import LoadError, { loadErrorMessage } from '../../components/LoadError';
import Icon from '../../components/ui/Icon';
import { useToast } from '../../components/ui/Toast';
import { label, EMPLOYMENT } from '../../utils/labels';

export default function ApplicationStats() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wards, setWards] = useState([]);
  const [ward, setWard] = useState('');

  useEffect(() => {
    api.get('/export/report-options')
      .then((res) => setWards(res.data.data?.wards || []))
      .catch(() => setWards([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get('/admin/stats/applications', { params: ward ? { ward } : {} })
      .then((res) => setStats(res.data.data))
      .catch((err) => setError(loadErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [ward]);

  const handleExport = async (type) => {
    try {
      const res = await api.get('/admin/export/applications', { params: ward ? { ward } : {} });
      const data = res.data.data || [];
      if (!data.length) {
        toast.warning('Nothing to export', 'There are no applications to include.');
        return;
      }
      if (type === 'excel') exportToExcel(data, 'applications.csv');
      else exportToPdf(data, 'Applications Report', 'applications');
      toast.success('Export ready', `${data.length} application record(s). This export is recorded in the audit log.`);
    } catch (err) {
      toast.error('Export failed', err.response?.data?.message || err.message);
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
      <LoadError message={error} />
      <div className="toolbar" style={{ marginBottom: '1.25rem' }}>
        <select
          value={ward}
          onChange={(e) => setWard(e.target.value)}
          className="toolbar-select"
          aria-label="Filter by ward"
        >
          <option value="">All wards</option>
          {wards.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <div className="toolbar-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => handleExport('excel')}>
            <Icon name="download" size={14} /> Export CSV
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => handleExport('pdf')}>
            <Icon name="file" size={14} /> Export PDF
          </button>
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
                <span className="bar-label">{label(EMPLOYMENT, e.status)}</span>
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
