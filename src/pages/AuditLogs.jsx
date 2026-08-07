import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import AdminLayout from '../components/AdminLayout';
import LoadError, { loadErrorMessage } from '../components/LoadError';
import { label, AUDIT_ACTION, ROLE } from '../utils/labels';

const ACTIONS = [
  'ALL',
  'LOGIN',
  'REGISTER',
  'VIEW_APPLICATION',
  'APPROVE_APPLICATION',
  'DECLINE_APPLICATION',
  'RECOMMEND_APPLICATION',
  'SITE_VISIT',
  'VERIFICATION_CHECK',
  'FIELD_REGISTER_RESIDENT',
  'FIELD_SUBMIT_APPLICATION',
  'CREATE_COUNCILLOR',
  'RESET_STAFF_PASSWORD',
  'EXPORT_APPLICANTS',
  'EXPORT_APPLICATIONS',
];

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [action, setAction] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/audit-logs', {
        params: {
          page,
          limit: 50,
          action: action === 'ALL' ? undefined : action,
          search: search || undefined,
        },
      });
      setLogs(res.data.data || []);
      setPagination(res.data.pagination || { page: 1, total: 0, totalPages: 1 });
    } catch (err) {
      setError(loadErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [action, search]);

  useEffect(() => {
    load(1);
  }, [load]);

  return (
    <AdminLayout title="Audit Logs">
      <LoadError message={error} />
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search email, action, details..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(1)}
          className="toolbar-search"
        />
        <select value={action} onChange={(e) => setAction(e.target.value)} className="toolbar-select">
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{a === 'ALL' ? 'All actions' : label(AUDIT_ACTION, a)}</option>
          ))}
        </select>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-400)' }}>
                    No audit events yet
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td>{log.userEmail || '—'}</td>
                    <td>{label(ROLE, log.userRole)}</td>
                    <td><span className="badge badge-draft">{label(AUDIT_ACTION, log.action)}</span></td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {log.entityType || '—'}
                      {log.entityId ? ` · ${String(log.entityId).slice(0, 8)}…` : ''}
                    </td>
                    <td style={{ fontSize: '0.8rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.details || '—'}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{log.ipAddress || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
        <div className="pager">
          <span>
            Page {pagination.page} of {pagination.totalPages || 1} · {pagination.total} events
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
