import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import AdminLayout from '../components/AdminLayout';
import { exportToExcel, exportToPdf } from '../utils/export';

export default function Applicants() {
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([
        api.get('/admin/stats/applicants'),
        api.get('/admin/applicants', { params: { search: search || undefined, page, limit: 20 } }),
      ]);
      setStats(s.data.data);
      setRows(list.data.data || []);
      setPagination(list.data.pagination || { page: 1, total: 0, totalPages: 1 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load(1);
  }, [load]);

  const handleExport = async (type) => {
    try {
      const res = await api.get('/admin/export/applicants');
      const data = res.data.data || [];
      if (type === 'excel') exportToExcel(data, 'applicants.csv');
      else exportToPdf(data, 'Registered Applicants', 'applicants');
    } catch (err) {
      alert(err.response?.data?.message || 'Export failed');
    }
  };

  return (
    <AdminLayout title="Applicants">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Registered</div>
          <div className="stat-value">{stats?.total ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Verified</div>
          <div className="stat-value">{stats?.verified ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Last 7 Days</div>
          <div className="stat-value">{stats?.last7Days ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Growth Trend</div>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>{stats?.growthLabel ?? '—'}</div>
        </div>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search applicants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(1)}
          className="toolbar-search"
        />
        <div className="toolbar-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => handleExport('excel')}>
            Export Excel
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => handleExport('pdf')}>
            Export PDF
          </button>
        </div>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Cell</th>
                <th>ID Number</th>
                <th>Applications</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)' }}>No applicants found</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.fullName}</td>
                    <td>{r.email}</td>
                    <td>{r.cellNumber}</td>
                    <td>{r.idNumber}</td>
                    <td>{r.applicationsCount}</td>
                    <td>{r.registeredDate}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
        <div className="pager">
          <span>
            Page {pagination.page} of {pagination.totalPages || 1} · {pagination.total} total
          </span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button type="button" className="btn btn-outline btn-sm" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Prev</button>
            <button type="button" className="btn btn-outline btn-sm" disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}>Next</button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
