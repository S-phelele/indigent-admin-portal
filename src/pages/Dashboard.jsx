import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import AdminLayout from '../components/AdminLayout';
import Icon from '../components/ui/Icon';
import LoadError, { loadErrorMessage } from '../components/LoadError';
import { ConfirmModal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

const TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'DECLINED', label: 'Declined' },
];

const STATUS_CLASS = {
  PENDING: 'badge-pending',
  APPROVED: 'badge-approved',
  DECLINED: 'badge-declined',
};

const titleCase = (s) => s.charAt(0) + s.slice(1).toLowerCase();

export default function Dashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('ALL');
  const [apps, setApps] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1, limit: 10 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menuFor, setMenuFor] = useState(null);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const menuRef = useRef(null);
  const toast = useToast();

  const onDelete = (app) => setDeleting(app);

  const confirmDelete = async () => {
    setDeleteBusy(true);
    try {
      const res = await api.delete(`/admin/applications/${deleting.id}`);
      toast.success('Application deleted', `${deleting.displayId} and ${res.data.data?.filesRemoved ?? 0} file(s) removed.`);
      setDeleting(null);
      fetchApps(pagination.page);
    } catch (err) {
      toast.error('Could not delete', err.response?.data?.message || err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  // Must match the server-side whitelist in routes/admin.js.
  const SORTABLE = {
    surname: 'Full name',
    totalHouseholdIncome: 'Household income',
    submittedAt: 'Date applied',
    status: 'Status',
  };

  const toggleSort = (field) => {
    if (sortBy === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(field); setSortOrder('asc'); }
  };

  const SortHeader = ({ field, children, className }) => (
    <th className={className}>
      <button
        type="button"
        onClick={() => toggleSort(field)}
        aria-label={`Sort by ${SORTABLE[field]}${sortBy === field ? (sortOrder === 'asc' ? ', currently ascending' : ', currently descending') : ''}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '.3rem',
          border: 0, background: 'none', font: 'inherit', cursor: 'pointer',
          color: sortBy === field ? 'var(--ink)' : 'inherit',
          textTransform: 'inherit', letterSpacing: 'inherit', padding: 0,
        }}
      >
        {children}
        <Icon
          name={sortBy === field ? (sortOrder === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevron-down'}
          size={13}
          style={{ opacity: sortBy === field ? 1 : 0.3 }}
        />
      </button>
    </th>
  );

  const fetchApps = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/admin/applications', {
          params: { status: tab, search: search || undefined, page, limit, sortBy, sortOrder },
        });
        setApps(res.data.data || []);
        setPagination(res.data.pagination || { page: 1, total: 0, totalPages: 1, limit });
      } catch (err) {
        setError(loadErrorMessage(err));
        setApps([]);
      } finally {
        setLoading(false);
      }
    },
    [tab, search, limit, sortBy, sortOrder]
  );

  useEffect(() => { fetchApps(1); }, [fetchApps]);

  // Close the row menu on any outside click.
  useEffect(() => {
    if (!menuFor) return undefined;
    const onDown = (e) => { if (!menuRef.current?.contains(e.target)) setMenuFor(null); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuFor]);

  const from = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <AdminLayout
      title="Applications"
      breadcrumb={<><span>Casework</span><span className="sep">/</span><span>Applications</span></>}
    >
      <LoadError message={error} />

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="search-field">
          <Icon name="search" size={15} />
          <input
            type="search"
            placeholder="Search name, ID number, cell or email"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput.trim()); }}
            aria-label="Search applications"
          />
        </div>
        <div className="toolbar-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setSearch(searchInput.trim())}>
            <Icon name="search" size={14} />
            Search
          </button>
          {search ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { setSearchInput(''); setSearch(''); }}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="loading"><span className="spinner" /> Loading applications…</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <SortHeader field="surname">Full name</SortHeader>
                  <th>Cell number</th>
                  <th>Employment</th>
                  <SortHeader field="totalHouseholdIncome" className="num">Household income</SortHeader>
                  <SortHeader field="submittedAt">Date applied</SortHeader>
                  <SortHeader field="status">Status</SortHeader>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {apps.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="table-empty">
                      {search ? `No applications match “${search}”.` : 'No applications in this view.'}
                    </td>
                  </tr>
                ) : (
                  apps.map((app) => (
                    <tr key={app.id}>
                      <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.8125rem' }}>{app.displayId}</td>
                      <td style={{ fontWeight: 600, color: 'var(--ink)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}>
                          {app.fullName}
                          {/* Surfaces an income contradiction before the reviewer opens the row. */}
                          {app.eligibility?.requiresReview ? (
                            <Icon
                              name="alert-triangle"
                              size={14}
                              title={app.eligibility.flags.map((f) => f.message).join(' ')}
                              style={{ color: 'var(--warning)' }}
                            />
                          ) : null}
                        </span>
                      </td>
                      <td>{app.cellNumber}</td>
                      <td>{app.employmentStatus === 'N/A' ? <span className="muted">—</span> : titleCase(app.employmentStatus.replace('_', ' '))}</td>
                      <td className="num">{app.totalIncome}</td>
                      <td className="nowrap">{app.dateApplied}</td>
                      <td>
                        <span className={`badge ${STATUS_CLASS[app.status] || 'badge-draft'}`}>
                          {titleCase(app.status)}
                        </span>
                      </td>
                      <td style={{ position: 'relative', width: 130 }}>
                        <div style={{ display: 'flex', gap: '.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {/* Reviewing an application is the primary job here, so
                              it gets a real button rather than living in a menu. */}
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => navigate(`/applications/${app.id}`)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`More actions for ${app.fullName}`}
                            aria-haspopup="menu"
                            onClick={() => setMenuFor(menuFor === app.id ? null : app.id)}
                          >
                            <Icon name="more" size={16} />
                          </button>
                        </div>
                        {menuFor === app.id ? (
                          <div className="menu" role="menu" ref={menuRef}>
                            <button type="button" role="menuitem" className="menu-item"
                              onClick={() => { setMenuFor(null); navigate(`/applications/${app.id}`); }}>
                              <Icon name="eye" size={15} /> View details
                            </button>
                            <button type="button" role="menuitem" className="menu-item"
                              onClick={() => { setMenuFor(null); navigate(`/applications/${app.id}#documents`); }}>
                              <Icon name="file" size={15} /> View documents
                            </button>
                            <button type="button" role="menuitem" className="menu-item"
                              onClick={() => { setMenuFor(null); navigate(`/applications/${app.id}?edit=1`); }}>
                              <Icon name="edit" size={15} /> Edit application
                            </button>
                            {app.user?.id ? (
                              <button type="button" role="menuitem" className="menu-item"
                                onClick={() => { setMenuFor(null); navigate(`/applicants/${app.user.id}`); }}>
                                <Icon name="user" size={15} /> View applicant
                              </button>
                            ) : null}
                            <button type="button" role="menuitem" className="menu-item is-danger"
                              onClick={() => { setMenuFor(null); onDelete(app); }}>
                              <Icon name="trash" size={15} /> Delete application
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="pager">
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <span>Rows</span>
            <select
              className="toolbar-select"
              style={{ minWidth: 72, minHeight: 30, padding: '.2rem .5rem' }}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>{from}–{to} of {pagination.total}</span>
          </div>
          <div className="pager-actions">
            <button type="button" className="btn btn-outline btn-sm" disabled={pagination.page <= 1} onClick={() => fetchApps(1)} aria-label="First page">
              <Icon name="chevrons-left" size={14} />
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={pagination.page <= 1} onClick={() => fetchApps(pagination.page - 1)} aria-label="Previous page">
              <Icon name="chevron-left" size={14} />
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchApps(pagination.page + 1)} aria-label="Next page">
              <Icon name="chevron-right" size={14} />
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchApps(pagination.totalPages)} aria-label="Last page">
              <Icon name="chevrons-right" size={14} />
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deleting)}
        variant="danger"
        title="Delete this application?"
        description={
          deleting
            ? `${deleting.displayId} for ${deleting.fullName} will be permanently removed, along with every uploaded document. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete permanently"
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      >
        <div className="alert alert-warning" style={{ marginBottom: 0 }}>
          <Icon name="alert-triangle" size={16} />
          <span>The deletion is recorded in the audit log, but the application itself cannot be recovered.</span>
        </div>
      </ConfirmModal>
    </AdminLayout>
  );
}
