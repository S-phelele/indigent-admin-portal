import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import AdminLayout from '../components/AdminLayout';

const TABS = ['All Applications', 'Pending', 'Approved', 'Declined'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('All Applications');
  const [apps, setApps] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1, limit: 10 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(null);

  const fetchApps = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const statusMap = {
        'All Applications': 'ALL',
        Pending: 'PENDING',
        Approved: 'APPROVED',
        Declined: 'DECLINED',
      };
      const res = await api.get('/admin/applications', {
        params: {
          status: statusMap[tab],
          search: search || undefined,
          page,
          limit: 10,
        },
      });
      setApps(res.data.data || []);
      setPagination(res.data.pagination || { page: 1, total: 0, totalPages: 1, limit: 10 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => {
    fetchApps(1);
  }, [fetchApps]);

  const statusBadge = (status) => {
    const map = {
      PENDING: 'badge-pending',
      APPROVED: 'badge-approved',
      DECLINED: 'badge-declined',
    };
    return (
      <span className={`badge ${map[status] || 'badge-draft'}`}>
        ● {status.charAt(0) + status.slice(1).toLowerCase()}
      </span>
    );
  };

  return (
    <AdminLayout title="Applications">
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--gray-200)' }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.75rem 0',
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? 'var(--red)' : 'var(--gray-500)',
                borderBottom: tab === t ? '2px solid var(--red)' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Search + Filter */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="search"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchApps(1)}
              style={{
                width: '100%',
                padding: '0.65rem 1rem 0.65rem 2.5rem',
                border: '1px solid var(--gray-300)',
                borderRadius: 'var(--radius)',
              }}
            />
            <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }}>🔍</span>
          </div>
          <select style={{ padding: '0.65rem 1rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', minWidth: 140 }}>
            <option>Filter by</option>
            <option>Employment Status</option>
            <option>Date Applied</option>
          </select>
        </div>

        {/* Table */}
        <div className="table-card">
          {loading ? (
            <div className="loading">Loading applications...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Full Name ↕</th>
                  <th>Cell Number ↕</th>
                  <th>Employment Status ↕</th>
                  <th>Total Income ↕</th>
                  <th>Date Applied ↕</th>
                  <th>Status ↕</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {apps.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-400)' }}>
                      No applications found
                    </td>
                  </tr>
                ) : (
                  apps.map((app, idx) => (
                    <tr key={app.id}>
                      <td style={{ color: 'var(--red)', fontWeight: 500 }}>{(pagination.page - 1) * pagination.limit + idx + 1}</td>
                      <td>{app.fullName}</td>
                      <td>{app.cellNumber}</td>
                      <td>{app.employmentStatus}</td>
                      <td>{app.totalIncome}</td>
                      <td>{app.dateApplied}</td>
                      <td>{statusBadge(app.status)}</td>
                      <td style={{ position: 'relative' }}>
                        <button
                          className="header-link"
                          onClick={() => setMenuOpen(menuOpen === app.id ? null : app.id)}
                          style={{ fontSize: '1.2rem', padding: '0 0.5rem' }}
                        >
                          ⋮
                        </button>
                        {menuOpen === app.id && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              background: 'white',
                              border: '1px solid var(--gray-200)',
                              borderRadius: 'var(--radius)',
                              boxShadow: 'var(--shadow-lg)',
                              zIndex: 10,
                              minWidth: 160,
                            }}
                          >
                            <button
                              className="header-link"
                              style={{ display: 'block', width: '100%', padding: '0.65rem 1rem', textAlign: 'left' }}
                              onClick={() => { setMenuOpen(null); navigate(`/applications/${app.id}`); }}
                            >
                              📄 View Details
                            </button>
                            <button
                              className="header-link"
                              style={{ display: 'block', width: '100%', padding: '0.65rem 1rem', textAlign: 'left' }}
                              onClick={() => { setMenuOpen(null); navigate(`/applications/${app.id}`); }}
                            >
                              📎 View Documents
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid var(--gray-100)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--gray-500)' }}>
              Items per page
              <select
                value={pagination.limit}
                onChange={() => {}}
                style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--gray-300)', borderRadius: 4 }}
              >
                <option>10</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--gray-500)' }}>
                {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </span>
              <button className="btn btn-outline btn-sm" disabled={pagination.page <= 1} onClick={() => fetchApps(1)}>|&lt;</button>
              <button className="btn btn-outline btn-sm" disabled={pagination.page <= 1} onClick={() => fetchApps(pagination.page - 1)}>&lt;</button>
              <button className="btn btn-outline btn-sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchApps(pagination.page + 1)}>&gt;</button>
              <button className="btn btn-outline btn-sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchApps(pagination.totalPages)}>&gt;|</button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
