import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import AdminLayout from '../components/AdminLayout';
import Icon from '../components/ui/Icon';
import { ConfirmModal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import LoadError, { loadErrorMessage } from '../components/LoadError';

const STATUS_CLASS = {
  DRAFT: 'badge-draft', PENDING: 'badge-pending', APPROVED: 'badge-approved', DECLINED: 'badge-declined',
};

const money = (v) => (v != null ? `R ${Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '—');

export default function ApplicantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [applicant, setApplicant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', cellNumber: '', idNumber: '', isVerified: false });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [creatingApp, setCreatingApp] = useState(false);

  const load = async () => {
    try {
      const res = await api.get(`/admin/applicants/${id}`);
      setApplicant(res.data.data);
      setForm({
        firstName: res.data.data.firstName || '',
        lastName: res.data.data.lastName || '',
        email: res.data.data.email || '',
        cellNumber: res.data.data.cellNumber || '',
        idNumber: res.data.data.idNumber || '',
        isVerified: Boolean(res.data.data.isVerified),
      });
    } catch (err) {
      setError(loadErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/admin/applicants/${id}`, form);
      await load();
      toast.success('Applicant updated', 'The change is recorded in the audit log.');
    } catch (err) {
      toast.error('Could not save', err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleteBusy(true);
    try {
      const res = await api.delete(`/admin/applicants/${id}`);
      toast.success(
        'Applicant deleted',
        `${res.data.data?.applicationsDeleted ?? 0} application(s) and ${res.data.data?.filesRemoved ?? 0} file(s) removed.`
      );
      navigate('/applicants');
    } catch (err) {
      toast.error('Could not delete', err.response?.data?.message || err.message);
      setDeleteBusy(false);
      setConfirmDelete(false);
    }
  };

  const startApplication = async () => {
    setCreatingApp(true);
    try {
      const res = await api.post('/admin/applications', { userId: id });
      toast.success('Application started', 'You can now capture their details.');
      navigate(`/applications/${res.data.data.id}?edit=1`);
    } catch (err) {
      toast.error('Could not start an application', err.response?.data?.message || err.message);
    } finally {
      setCreatingApp(false);
    }
  };

  if (loading) {
    return <AdminLayout title="Applicant"><div className="loading"><span className="spinner" /> Loading applicant…</div></AdminLayout>;
  }
  if (!applicant) {
    return (
      <AdminLayout title="Applicant">
        <LoadError message={error || 'Applicant not found.'} />
        <Link to="/applicants" className="btn btn-outline"><Icon name="arrow-left" size={15} /> Back to applicants</Link>
      </AdminLayout>
    );
  }

  const hasDraft = applicant.applications.some((a) => a.status === 'DRAFT');

  return (
    <AdminLayout
      title={applicant.fullName || applicant.email}
      breadcrumb={<><Link to="/applicants">Applicants</Link><span className="sep">/</span><span>{applicant.fullName || applicant.email}</span></>}
      actions={
        <button type="button" className="btn btn-primary btn-sm" onClick={startApplication} disabled={creatingApp || hasDraft}
                title={hasDraft ? 'This applicant already has a draft' : undefined}>
          <Icon name="plus" size={14} /> New application
        </button>
      }
    >
      <LoadError message={error} />

      <button type="button" className="back-link" onClick={() => navigate('/applicants')}>
        <Icon name="arrow-left" size={15} /> Back to applicants
      </button>

      <div className="page-head">
        <div>
          <h1>{applicant.fullName || '—'}</h1>
          <p>{applicant.email} · Registered {new Date(applicant.createdAt).toLocaleDateString('en-ZA')}</p>
        </div>
        <span className={`badge ${applicant.isVerified ? 'badge-approved' : 'badge-pending'}`}>
          {applicant.isVerified ? 'Cell verified' : 'Not verified'}
        </span>
      </div>

      <section className="panel">
        <h3 className="panel-title">Details</h3>
        <form onSubmit={save}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First name</label>
              <input id="firstName" value={form.firstName} onChange={set('firstName')} />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Surname</label>
              <input id="lastName" value={form.lastName} onChange={set('lastName')} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" value={form.email} onChange={set('email')} />
            </div>
            <div className="form-group">
              <label htmlFor="cellNumber">Cell number</label>
              <input id="cellNumber" value={form.cellNumber} onChange={set('cellNumber')} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="idNumber">ID number</label>
              <input id="idNumber" value={form.idNumber} onChange={set('idNumber')} inputMode="numeric" />
              <div className="field-hint">Validated against the SA ID format and check digit.</div>
            </div>
            <div className="form-group">
              <label htmlFor="isVerified">Cell verification</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 400, minHeight: 38 }}>
                <input id="isVerified" type="checkbox" checked={form.isVerified} onChange={set('isVerified')} style={{ width: 'auto', minHeight: 0 }} />
                <span>Mark this cell number as verified</span>
              </label>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-danger-outline" onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" size={15} /> Delete applicant
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Applications ({applicant.applications.length})</h3>
        </div>
        {applicant.applications.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            This applicant has no applications yet.
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Status</th>
                  <th className="num">Household income</th>
                  <th>Created</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {applicant.applications.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.8125rem' }}>{a.displayId}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}>
                        <span className={`badge ${STATUS_CLASS[a.status]}`}>
                          {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                        </span>
                        {a.eligibility?.requiresReview ? (
                          <Icon name="alert-triangle" size={14} style={{ color: 'var(--warning)' }}
                                title={a.eligibility.flags.map((f) => f.message).join(' ')} />
                        ) : null}
                      </span>
                    </td>
                    <td className="num">{money(a.totalHouseholdIncome)}</td>
                    <td className="nowrap">{new Date(a.createdAt).toLocaleDateString('en-ZA')}</td>
                    <td className="text-right">
                      <Link to={`/applications/${a.id}`} className="btn btn-outline btn-sm">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmModal
        open={confirmDelete}
        variant="danger"
        title="Delete this applicant?"
        description={`${applicant.email} will be permanently removed, along with ${applicant.applications.length} application(s) and every document they uploaded.`}
        confirmLabel="Delete permanently"
        busy={deleteBusy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
      >
        <div className="alert alert-warning" style={{ marginBottom: 0 }}>
          <Icon name="alert-triangle" size={16} />
          <span>
            This erases their ID copies and bank statements from the server. The deletion is audited,
            but nothing can be recovered.
          </span>
        </div>
      </ConfirmModal>
    </AdminLayout>
  );
}
