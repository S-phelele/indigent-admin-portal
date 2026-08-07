import { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import Icon from '../components/ui/Icon';
import Modal, { ConfirmModal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import LoadError, { loadErrorMessage } from '../components/LoadError';
import api from '../services/api';
import { friendlyError } from '../utils/apiError';
import { label, ROLE } from '../utils/labels';

/**
 * Managing ward councillors.
 *
 * Councillors are created here and nowhere else. The ability to create resident
 * accounts and capture applications has to be granted deliberately by somebody
 * accountable, so there is no self-registration path into this role.
 *
 * Deactivation is offered before deletion throughout. A councillor's name is the
 * accountability trail on every household they signed up; removing the account
 * would strip that from applications the municipality may later have to defend.
 */

const ROLES = [
  { value: 'COUNCILLOR', label: 'Ward Councillor', hint: 'Captures applications door to door in a ward.' },
  { value: 'CAPTURE_OFFICER', label: 'Capture Officer', hint: 'Captures walk-in applications at the front desk.' },
  { value: 'VERIFICATION_OFFICER', label: 'Verification Officer', hint: 'Checks captured applications and recommends an outcome.' },
];

const blank = { firstName: '', lastName: '', email: '', cellNumber: '', ward: '', idNumber: '', role: 'COUNCILLOR' };

export default function Staff() {
  const toast = useToast();
  const [councillors, setCouncillors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const [credentials, setCredentials] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/admin/staff', { params: { status: statusFilter, role: roleFilter || undefined } })
      .then((res) => setCouncillors(res.data.data))
      .catch((err) => setError(loadErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [statusFilter, roleFilter]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const res = await api.post('/admin/staff', form);
      setShowForm(false);
      setForm(blank);
      setCredentials({ ...res.data.credentials, name: res.data.data.name, message: res.data.message });
      load();
    } catch (err) {
      setFormError(friendlyError(err, 'The staff member could not be created.'));
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/admin/staff/${editing.id}`, {
        firstName: editing.firstName,
        lastName: editing.lastName,
        cellNumber: editing.cellNumber,
        ward: editing.ward,
        email: editing.email,
      });
      toast.success('Staff member updated.');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(friendlyError(err, 'Could not update.'));
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (councillor, isActive) => {
    try {
      await api.patch(`/admin/staff/${councillor.id}`, { isActive });
      toast.success(isActive ? `${councillor.name} can sign in again.` : `${councillor.name} has been deactivated.`);
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(friendlyError(err, 'Could not change access.'));
    }
  };

  const resetPassword = async (councillor) => {
    try {
      const res = await api.post(`/admin/staff/${councillor.id}/reset-password`);
      setConfirm(null);
      setCredentials({ ...res.data.credentials, name: councillor.name, message: res.data.message });
    } catch (err) {
      toast.error(friendlyError(err, 'Could not reset the password.'));
    }
  };

  const remove = async (councillor) => {
    try {
      await api.delete(`/admin/staff/${councillor.id}`);
      toast.success('Staff member removed.');
      setConfirm(null);
      load();
    } catch (err) {
      const data = err.response?.data;
      setConfirm(null);
      // The server refuses to delete anybody who has captured work, and explains
      // why. Surface that reasoning rather than a generic failure.
      toast.error(data?.message || 'Could not remove them.');
    }
  };

  return (
    <AdminLayout
      title="Municipal staff"
      description="Councillors, capture officers and verification officers. Administrators are not created here."
      actions={
        <button type="button" className="btn btn-primary" onClick={() => { setForm(blank); setFormError(''); setShowForm(true); }}>
          <Icon name="userPlus" size={16} /> Add a staff member
        </button>
      }
    >
      <LoadError message={error} />

      <div className="toolbar">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="toolbar-select"
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <div className="toolbar-actions">
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'inactive', label: 'Deactivated' },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              className={`pill${statusFilter === f.key ? ' active' : ''}`}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading"><span className="spinner" /> Loading…</div>
      ) : councillors.length === 0 ? (
        <div className="table-empty">
          <Icon name="userCheck" size={28} />
          <p>No staff yet. Add a councillor or a capture officer so applications can be registered.</p>
        </div>
      ) : (
        <div className="table-card table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Ward</th>
                <th>Cell</th>
                <th>Captured</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {councillors.map((c) => (
                <tr key={c.id} className={c.isActive ? '' : 'row-muted'}>
                  <td>
                    <strong>{c.name}</strong>
                    <small className="muted">{c.email}</small>
                  </td>
                  <td>{c.roleLabel || label(ROLE, c.role)}</td>
                  <td>{c.ward || <span className="muted">Not set</span>}</td>
                  <td>{c.cellNumber || '—'}</td>
                  <td>
                    <strong>{c.capturedTotal}</strong>
                    <small className="muted">{c.capturedSubmitted} submitted</small>
                  </td>
                  <td>
                    {c.isActive
                      ? <span className="badge badge-approved">Active</span>
                      : <span className="badge badge-neutral">Deactivated</span>}
                    {c.mustChangePassword
                      ? <span className="badge badge-draft" title="Has not yet replaced the password sent to them">Not signed in</span>
                      : null}
                  </td>
                  <td className="text-right">
                    <div className="row-actions">
                      <button type="button" className="btn btn-sm" onClick={() => setEditing({ ...c })}>
                        <Icon name="edit" size={14} /> Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setConfirm({ kind: 'reset', councillor: c })}
                      >
                        <Icon name="key" size={14} /> New password
                      </button>
                      {c.isActive ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger-ghost"
                          onClick={() => setConfirm({ kind: 'deactivate', councillor: c })}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <>
                          <button type="button" className="btn btn-sm" onClick={() => setActive(c, true)}>
                            Reactivate
                          </button>
                          {c.capturedTotal === 0 ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-danger-ghost"
                              onClick={() => setConfirm({ kind: 'delete', councillor: c })}
                            >
                              <Icon name="trash" size={14} /> Delete
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      <Modal open={showForm} title="Add a staff member" onClose={() => setShowForm(false)}>
        <form onSubmit={create} className="form-grid">
          {formError ? <div className="alert alert-error span-2">{formError}</div> : null}

          <label className="form-group span-2"><span>Role <em>required</em></span>
            <select value={form.role} onChange={set('role')} required>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <small>{ROLES.find((r) => r.value === form.role)?.hint}</small>
          </label>

          <label className="form-group"><span>First name <em>required</em></span>
            <input value={form.firstName} onChange={set('firstName')} required />
          </label>
          <label className="form-group"><span>Surname <em>required</em></span>
            <input value={form.lastName} onChange={set('lastName')} required />
          </label>
          <label className="form-group span-2"><span>Email address <em>required</em></span>
            <input type="email" value={form.email} onChange={set('email')} required />
            <small>This is the username they will sign in with.</small>
          </label>
          <label className="form-group"><span>Cell number <em>required</em></span>
            <input value={form.cellNumber} onChange={set('cellNumber')} required inputMode="tel" />
            <small>Their sign-in details are sent here by SMS.</small>
          </label>
          <label className="form-group"><span>Ward <em className="optional">optional</em></span>
            <input
              value={form.ward}
              onChange={set('ward')}
              placeholder="e.g. Ward 12"
              disabled={form.role !== 'COUNCILLOR'}
            />
            <small>
              {form.role === 'COUNCILLOR'
                ? 'Recorded on every household they capture.'
                : 'Wards apply to councillors only.'}
            </small>
          </label>
          <label className="form-group span-2"><span>ID number <em className="optional">optional</em></span>
            <input value={form.idNumber} onChange={set('idNumber')} inputMode="numeric" maxLength={13} />
          </label>

          <div className="form-actions span-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create and send sign-in details'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(editing)} title="Edit staff member" onClose={() => setEditing(null)}>
        {editing ? (
          <form onSubmit={saveEdit} className="form-grid">
            <label className="form-group"><span>First name</span>
              <input value={editing.firstName || ''} onChange={(e) => setEditing((c) => ({ ...c, firstName: e.target.value }))} />
            </label>
            <label className="form-group"><span>Surname</span>
              <input value={editing.lastName || ''} onChange={(e) => setEditing((c) => ({ ...c, lastName: e.target.value }))} />
            </label>
            <label className="form-group span-2"><span>Email address</span>
              <input type="email" value={editing.email || ''} onChange={(e) => setEditing((c) => ({ ...c, email: e.target.value }))} />
            </label>
            <label className="form-group"><span>Cell number</span>
              <input value={editing.cellNumber || ''} onChange={(e) => setEditing((c) => ({ ...c, cellNumber: e.target.value }))} />
            </label>
            <label className="form-group"><span>Ward</span>
              <input value={editing.ward || ''} onChange={(e) => setEditing((c) => ({ ...c, ward: e.target.value }))} />
            </label>
            <div className="form-actions span-2">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>Save changes</button>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* Sign-in details, shown once. */}
      <Modal open={Boolean(credentials)} title="Sign-in details" onClose={() => setCredentials(null)} size="sm">
        {credentials ? (
          <>
            <p>{credentials.message}</p>
            <div className="credential-box">
              <div>
                <span className="credential-label">Username</span>
                <code>{credentials.username}</code>
              </div>
              <div>
                <span className="credential-label">Temporary password</span>
                <code className="credential-password">{credentials.temporaryPassword}</code>
              </div>
            </div>
            <p className="field-hint">
              Shown once and never retrievable. {credentials.name} will be asked to choose their own password the first
              time they sign in.
            </p>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={() => setCredentials(null)}>Done</button>
            </div>
          </>
        ) : null}
      </Modal>

      <ConfirmModal
        open={confirm?.kind === 'deactivate'}
        title={`Deactivate ${confirm?.councillor?.name}?`}
        description="They will not be able to sign in. Everything they have captured is kept, along with the record of who captured it. You can reactivate them at any time."
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        variant="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={() => setActive(confirm.councillor, false)}
      />

      <ConfirmModal
        open={confirm?.kind === 'reset'}
        title={`Issue a new password to ${confirm?.councillor?.name}?`}
        description="Their current password stops working immediately. A new one is sent to their cell number, and shown to you once."
        confirmLabel="Issue new password"
        cancelLabel="Cancel"
        onCancel={() => setConfirm(null)}
        onConfirm={() => resetPassword(confirm.councillor)}
      />

      <ConfirmModal
        open={confirm?.kind === 'delete'}
        title={`Delete ${confirm?.councillor?.name}?`}
        description="This account has captured nothing, so nothing is lost. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={() => remove(confirm.councillor)}
      />
    </AdminLayout>
  );
}
