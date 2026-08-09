import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../../services/api';
import AdminLayout from '../../components/AdminLayout';
import Icon from '../../components/ui/Icon';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import LoadError, { loadErrorMessage } from '../../components/LoadError';
import ApprovalTrail from '../../components/ApprovalTrail';
import { friendlyError } from '../../utils/apiError';

const isImage = (mime, fileName) =>
  (mime && mime.startsWith('image/')) ||
  ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some((e) => (fileName || '').toLowerCase().endsWith(e));

const isPdf = (mime, fileName) =>
  mime === 'application/pdf' || (fileName || '').toLowerCase().endsWith('.pdf');

const yesNo = (v) => (v === true ? 'Yes' : v === false ? 'No' : '—');
const money = (v) => (v != null ? `R ${Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '—');

const STATUS_CLASS = { PENDING: 'badge-pending', APPROVED: 'badge-approved', DECLINED: 'badge-declined', DRAFT: 'badge-draft' };

function Field({ label, children }) {
  return (
    <div className="form-group">
      <span className="field-label">{label}</span>
      <p>{children}</p>
    </div>
  );
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [decision, setDecision] = useState(null); // 'APPROVED' | 'DECLINED'
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [docDecision, setDocDecision] = useState(null); // { doc, status }
  const [docBusy, setDocBusy] = useState(null);
  const [docReason, setDocReason] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editBusy, setEditBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const EDIT_FIELDS = [
    { group: 'Applicant', fields: [
      ['names', 'Names', 'text'], ['surname', 'Surname', 'text'],
      ['idNumber', 'ID number', 'text'], ['cellNumber', 'Cell number', 'text'],
      ['maritalStatus', 'Marital status', 'select', ['', 'SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED']],
      ['employmentStatus', 'Employment status', 'select', ['', 'EMPLOYED', 'UNEMPLOYED', 'SELF_EMPLOYED', 'PENSIONER', 'OTHER']],
      ['residentialAddress', 'Residential address', 'text'], ['postalAddress', 'Postal address', 'text'],
    ]},
    { group: 'Property', fields: [
      ['peopleOnProperty', 'People on property', 'number'], ['childrenUnder18', 'Children under 18', 'number'],
      ['adults', 'Adults', 'number'], ['pensionersOver60', 'Pensioners over 60', 'number'],
      ['waterMeterNumber', 'Water meter', 'text'], ['electricityMeterNumber', 'Electricity meter', 'text'],
    ]},
    { group: 'Income', fields: [
      ['salary', 'Salary', 'money'], ['oldAgePension', 'Old age pension', 'money'],
      ['disabilityPension', 'Disability pension', 'money'], ['businessIncome', 'Business income', 'money'],
      ['rentingIncome', 'Renting income', 'money'],
    ]},
    { group: 'General', fields: [
      ['ownsImmovableProperty', 'Owns immovable property', 'bool'],
      ['isFullTimeOccupant', 'Full-time occupant', 'bool'],
      ['incomeBelowThreshold', 'Declared income at or below threshold', 'bool'],
      ['hasMunicipalArrears', 'Municipal arrears', 'bool'],
      ['hasArrearsArrangement', 'Arrangement to pay arrears', 'bool'],
    ]},
  ];

  const openEdit = () => {
    const seed = {};
    EDIT_FIELDS.forEach((g) => g.fields.forEach(([k, , type]) => {
      const v = app[k];
      seed[k] = type === 'bool' ? (v === true ? 'Yes' : v === false ? 'No' : '') : v ?? '';
    }));
    setEditForm(seed);
    setEditing(true);
  };

  const saveEdit = async () => {
    setEditBusy(true);
    try {
      const res = await api.patch(`/admin/applications/${id}`, editForm);
      setApp(res.data.data);
      setEditing(false);
      searchParams.delete('edit');
      setSearchParams(searchParams, { replace: true });
      toast.success('Application updated', res.data.message);
    } catch (err) {
      toast.error('Could not save', err.response?.data?.message || err.message);
    } finally {
      setEditBusy(false);
    }
  };

  const removeApplication = async () => {
    setDeleteBusy(true);
    try {
      const res = await api.delete(`/admin/applications/${id}`);
      toast.success('Application deleted', `${res.data.data?.filesRemoved ?? 0} file(s) removed.`);
      navigate('/applications');
    } catch (err) {
      toast.error('Could not delete', err.response?.data?.message || err.message);
      setDeleteBusy(false);
      setConfirmDelete(false);
    }
  };

  useEffect(() => {
    api.get(`/admin/applications/${id}`)
      .then((res) => {
        setApp(res.data.data);
        setNotes(res.data.data.reviewNotes || '');
      })
      .catch((err) => setError(loadErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => () => { if (viewer?.url) URL.revokeObjectURL(viewer.url); }, [viewer]);

  // Opened straight into edit mode from the applications list menu.
  useEffect(() => {
    if (app && searchParams.get('edit') === '1' && !editing) openEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app]);

  const submitDecision = async () => {
    setBusy(true);
    try {
      const res = await api.patch(`/admin/applications/${id}/status`, { status: decision, reviewNotes: notes });
      setApp(res.data.data);
      setDecision(null);
      toast.success(
        decision === 'APPROVED' ? 'Application approved' : 'Application declined',
        `${[res.data.data.names, res.data.data.surname].filter(Boolean).join(' ')} has been notified in the register.`
      );
    } catch (err) {
      toast.error('Could not record the decision', err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const openDocument = async (doc, asDownload = false) => {
    setViewerLoading(true);
    try {
      const res = await api.get(`/documents/file/${doc.id}`, {
        params: asDownload ? { download: '1' } : {},
        responseType: 'blob',
      });
      const mime = doc.mimeType || res.data.type || 'application/octet-stream';
      const url = URL.createObjectURL(new Blob([res.data], { type: mime }));

      if (asDownload) {
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.fileName || doc.name || 'document';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success('Download started', doc.fileName || doc.name);
        return;
      }

      setViewer((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return {
          url,
          name: doc.fileName || doc.name,
          mime,
          canPreview: isImage(mime, doc.fileName) || isPdf(mime, doc.fileName),
        };
      });
    } catch (err) {
      toast.error('Could not open document', friendlyError(err, 'The file may be missing on the server.'));
    } finally {
      setViewerLoading(false);
    }
  };

  const closeViewer = () => setViewer((prev) => { if (prev?.url) URL.revokeObjectURL(prev.url); return null; });

  const submitDocDecision = async () => {
    const { doc, status } = docDecision;
    setDocBusy(doc.id);
    try {
      await api.patch(`/admin/documents/${doc.id}/status`, { status, reason: docReason || undefined });
      const refreshed = await api.get(`/admin/applications/${id}`);
      setApp(refreshed.data.data);
      toast.success(
        status === 'Rejected' ? 'Document rejected' : 'Document accepted',
        `${doc.name}. The applicant is not notified automatically yet.`
      );
      setDocDecision(null);
      setDocReason('');
    } catch (err) {
      toast.error('Could not update the document', err.response?.data?.message || err.message);
    } finally {
      setDocBusy(null);
    }
  };

  if (loading) {
    return <AdminLayout title="Application"><div className="loading"><span className="spinner" /> Loading application…</div></AdminLayout>;
  }
  if (!app) {
    return (
      <AdminLayout title="Application">
        <LoadError message={error || 'Application not found.'} />
        <button type="button" className="btn btn-outline" onClick={() => navigate('/applications')}>
          <Icon name="arrow-left" size={15} /> Back to applications
        </button>
      </AdminLayout>
    );
  }

  const applicantName = [app.names, app.surname].filter(Boolean).join(' ') || 'Application';
  const requiredOutstanding = (app.documents || []).filter((d) => d.importance === 'REQUIRED' && d.status !== 'Uploaded');

  return (
    <AdminLayout
      title={applicantName}
      breadcrumb={
        <>
          <Link to="/applications">Applications</Link>
          <span className="sep">/</span>
          <span>{app.reference || app.id.slice(0, 8)}</span>
        </>
      }
      actions={
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={openEdit}>
            <Icon name="edit" size={14} /> Edit
          </button>
          {app.status === 'PENDING' ? (
            <>
              <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setDecision('DECLINED')}>
                <Icon name="close" size={14} /> Decline
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setDecision('APPROVED')}>
                <Icon name="check" size={14} /> Approve
              </button>
            </>
          ) : null}
        </>
      }
    >
      <LoadError message={error} />

      <button type="button" className="back-link" onClick={() => navigate('/applications')}>
        <Icon name="arrow-left" size={15} /> Back to applications
      </button>

      <div className="page-head">
        <div>
          <h1>{applicantName}</h1>
          <p>
            Reference{' '}
            <strong style={{ fontFamily: 'ui-monospace, monospace' }}>
              {app.reference || app.id.slice(0, 8)}
            </strong>{' '}
            · Submitted {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString('en-ZA') : '—'}
          </p>
        </div>
        <span className={`badge ${STATUS_CLASS[app.status] || 'badge-draft'}`} style={{ fontSize: '.8125rem', padding: '.3rem .7rem' }}>
          {app.status.charAt(0) + app.status.slice(1).toLowerCase()}
        </span>
      </div>

      {app.status === 'PENDING' && requiredOutstanding.length > 0 ? (
        <div className="alert alert-warning">
          <Icon name="alert-triangle" size={16} />
          <span>
            {requiredOutstanding.length} required document
            {requiredOutstanding.length === 1 ? ' is' : 's are'} still outstanding:{' '}
            {requiredOutstanding.map((d) => d.name).join(', ')}.
          </span>
        </div>
      ) : null}

      {/* Eligibility conflicts. The system never blocks on these — the judgement
          is the official's — but they must be impossible to miss. */}
      {(app.eligibility?.flags || []).map((flag) => (
        <div
          key={flag.code}
          className={`alert ${flag.severity === 'WARNING' ? 'alert-warning' : 'alert-info'}`}
          role={flag.severity === 'WARNING' ? 'alert' : undefined}
        >
          <Icon name={flag.severity === 'WARNING' ? 'alert-triangle' : 'info'} size={16} />
          <span>{flag.message}</span>
        </div>
      ))}

      <section className="panel">
        <h3 className="panel-title">Applicant particulars</h3>
        <div className="form-row">
          <Field label="Marital status">{app.maritalStatus || '—'}</Field>
          <Field label="Employment status">{app.employmentStatus || '—'}</Field>
        </div>
        <div className="form-row">
          <Field label="ID number">{app.idNumber || '—'}</Field>
          <Field label="Cell number">
            {app.cellNumber || '—'}{' '}
            {app.cellVerified ? (
              <span className="badge badge-approved" style={{ marginLeft: '.35rem' }}>Verified</span>
            ) : null}
          </Field>
        </div>
        <Field label="Residential address">{app.residentialAddress || '—'}</Field>

        {/* A pinned location lets a reviewer confirm the property is in the
            municipal area without a site visit. Most applications will not have
            one, and its absence says nothing about eligibility. */}
        {app.addressLatitude != null && app.addressLongitude != null ? (
          <div
            style={{
              marginTop: '-.5rem', marginBottom: '1rem', padding: '.75rem .85rem',
              background: 'var(--success-soft)', border: '1px solid var(--success-line)',
              borderRadius: 'var(--radius)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.6rem', flexWrap: 'wrap' }}>
              <Icon name="map-pin" size={16} style={{ color: 'var(--success)', marginTop: '.15rem' }} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: '.8125rem', fontWeight: 600, color: 'var(--success)' }}>
                  Location pinned
                  {app.addressSource === 'DEVICE' ? " from the applicant's device"
                    : app.addressSource === 'SEARCH' ? ' from an address lookup'
                    : ''}
                </div>
                {app.addressFormatted && app.addressFormatted !== app.residentialAddress ? (
                  <div className="muted" style={{ fontSize: '.8125rem', marginTop: '.2rem' }}>
                    Resolved as: {app.addressFormatted}
                  </div>
                ) : null}
                <div className="muted" style={{ fontSize: '.75rem', marginTop: '.2rem', fontVariantNumeric: 'tabular-nums' }}>
                  {Number(app.addressLatitude).toFixed(6)}, {Number(app.addressLongitude).toFixed(6)}
                  {app.addressAccuracyM ? ` · ±${app.addressAccuracyM} m` : ''}
                  {app.addressVerifiedAt ? ` · captured ${new Date(app.addressVerifiedAt).toLocaleDateString('en-ZA')}` : ''}
                </div>
                {/* A network fix can be kilometres out; say so rather than let a
                    reviewer read it as a precise pin. */}
                {app.addressAccuracyM > 500 ? (
                  <div style={{ fontSize: '.75rem', color: 'var(--warning)', marginTop: '.25rem' }}>
                    Low accuracy — this looks like a network fix rather than GPS.
                  </div>
                ) : null}
              </div>
              <a
                className="btn btn-outline btn-sm"
                href={`https://www.openstreetmap.org/?mlat=${app.addressLatitude}&mlon=${app.addressLongitude}#map=17/${app.addressLatitude}/${app.addressLongitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="external" size={14} /> Open map
              </a>
            </div>
          </div>
        ) : (
          <p className="muted" style={{ fontSize: '.8125rem', marginTop: '-.5rem', marginBottom: '1rem' }}>
            No location pinned — the applicant did not share one. This does not affect eligibility.
          </p>
        )}

        <Field label="Postal address">{app.postalAddress || '—'}</Field>
        <div className="form-row">
          <Field label="Employer">{app.employerName || '—'}</Field>
          <Field label="Employer address">{app.employerAddress || '—'}</Field>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">Property and household</h3>
        <div className="form-row">
          <Field label="People on property">{app.peopleOnProperty ?? '—'}</Field>
          <Field label="Children under 18">{app.childrenUnder18 ?? '—'}</Field>
        </div>
        <div className="form-row">
          <Field label="Adults">{app.adults ?? '—'}</Field>
          <Field label="Pensioners over 60">{app.pensionersOver60 ?? '—'}</Field>
        </div>
        <div className="form-row">
          <Field label="Water meter">{app.waterMeterNumber || '—'}</Field>
          <Field label="Electricity meter">{app.electricityMeterNumber || '—'}</Field>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">Household income</h3>
        <div className="form-row">
          <Field label="Salary">{money(app.salary)}</Field>
          <Field label="Old age pension">{money(app.oldAgePension)}</Field>
        </div>
        <div className="form-row">
          <Field label="Disability pension">{money(app.disabilityPension)}</Field>
          <Field label="Business income">{money(app.businessIncome)}</Field>
        </div>
        <div className="form-row">
          <Field label="Renting income">{money(app.rentingIncome)}</Field>
          <Field label="Income per person">{money(app.totalIncomePerPerson)}</Field>
        </div>
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: '.5rem', padding: '.85rem 1rem',
            background: 'var(--slate-50)', border: '1px solid var(--line)', borderRadius: 'var(--radius)',
          }}
        >
          <span style={{ fontWeight: 600 }}>Total household income</span>
          <span style={{ fontSize: '1.125rem', fontWeight: 650 }}>{money(app.totalHouseholdIncome)}</span>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">General information</h3>
        <Field label="Owns immovable property?">{yesNo(app.ownsImmovableProperty)}</Field>
        <Field label="Full-time occupant?">{yesNo(app.isFullTimeOccupant)}</Field>
        <Field label="Declared income R4 200 or less?">{yesNo(app.incomeBelowThreshold)}</Field>
        <Field label="Municipal arrears?">{yesNo(app.hasMunicipalArrears)}</Field>
        <Field label="Arrangement to pay arrears?">{yesNo(app.hasArrearsArrangement)}</Field>
      </section>

      <section className="panel" id="documents">
        <h3 className="panel-title">Supporting documents</h3>
        {(app.documents || []).length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: '1rem 0' }}>No documents.</p>
        ) : (
          <div className="doc-list">
            {app.documents.map((doc) => (
              <div className={`doc-row${doc.status === 'Uploaded' ? ' is-uploaded' : ''}`} key={doc.id}>
                <div className="doc-row-info">
                  <span
                    className="doc-row-icon"
                    style={doc.status === 'Rejected' ? { background: 'var(--danger-soft)', color: 'var(--danger)' } : undefined}
                  >
                    <Icon name={doc.status === 'Uploaded' ? 'check' : doc.status === 'Rejected' ? 'close' : 'file'} size={16} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="doc-row-title">{doc.name}</div>
                    <div className="doc-row-meta">
                      <span className={`badge ${doc.importance === 'REQUIRED' ? 'badge-required' : 'badge-optional'}`}>
                        {doc.importance === 'REQUIRED' ? 'Required' : 'Optional'}
                      </span>
                      <span
                        className={`badge ${
                          doc.status === 'Uploaded' ? 'badge-uploaded'
                          : doc.status === 'Rejected' ? 'badge-declined'
                          : 'badge-pending'
                        }`}
                      >
                        {doc.status}
                      </span>
                      {doc.fileName ? (
                        <span>{doc.fileName}{doc.fileSize ? ` · ${(doc.fileSize / 1024).toFixed(0)} KB` : ''}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="doc-row-actions">
                  {doc.filePath || doc.status === 'Uploaded' || doc.status === 'Rejected' ? (
                    <>
                      <button type="button" className="btn btn-outline btn-sm" disabled={viewerLoading} onClick={() => openDocument(doc)}>
                        <Icon name="eye" size={14} /> View
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={viewerLoading} onClick={() => openDocument(doc, true)}>
                        <Icon name="download" size={14} />
                      </button>
                      {/* Rejecting one document leaves the application in the queue,
                          instead of forcing a decline over a single bad scan. */}
                      {doc.status === 'Rejected' ? (
                        <button type="button" className="btn btn-ghost btn-sm" disabled={docBusy === doc.id} onClick={() => setDocDecision({ doc, status: 'Uploaded' })}>
                          <Icon name="check" size={14} /> Accept
                        </button>
                      ) : (
                        <button type="button" className="btn btn-danger-outline btn-sm" disabled={docBusy === doc.id} onClick={() => setDocDecision({ doc, status: 'Rejected' })}>
                          <Icon name="close" size={14} /> Reject
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="muted" style={{ fontSize: '.8125rem' }}>Not uploaded</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/*
        The approval chain.
        This screen previously showed the household's answers and nothing about
        how the application had been decided — no stages, no officers, no
        reasons, no signature. That is the half of the record an audit asks for
        first, so it now sits directly above the review notes.
      */}
      <ApprovalTrail trail={app.trail} signatures={app.signatures} />

      <section className="panel">
        <h3 className="panel-title">Review notes</h3>
        <div className="form-group">
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Record the reasoning behind this decision. Notes are stored with the application."
            aria-label="Review notes"
          />
          <div className="field-hint">Included in the audit trail alongside the decision.</div>
        </div>
        {app.status === 'PENDING' ? (
          <div className="form-actions">
            <button type="button" className="btn btn-danger-outline" onClick={() => setDecision('DECLINED')}>
              <Icon name="close" size={15} /> Decline application
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setDecision('APPROVED')}>
              <Icon name="check" size={15} /> Approve application
            </button>
          </div>
        ) : (
          <div className="alert alert-info" style={{ marginBottom: 0 }}>
            <Icon name="info" size={16} />
            <span>
              Decided on {app.reviewedAt ? new Date(app.reviewedAt).toLocaleString('en-ZA') : '—'}. Reopen from the
              applications list if this needs to change.
            </span>
          </div>
        )}
      </section>

      <section className="panel" style={{ borderColor: 'var(--danger-line)' }}>
        <h3 className="panel-title" style={{ color: 'var(--danger)' }}>Danger zone</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <p className="muted" style={{ margin: 0, maxWidth: '52ch', fontSize: '.875rem' }}>
            Deleting removes this application and every document uploaded against it, including the files
            on the server. Use this for duplicates and test records, not for declined applications.
          </p>
          <button type="button" className="btn btn-danger-outline" onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" size={15} /> Delete application
          </button>
        </div>
      </section>

      <ConfirmModal
        open={Boolean(decision)}
        variant={decision === 'DECLINED' ? 'danger' : 'success'}
        title={decision === 'DECLINED' ? 'Decline this application?' : 'Approve this application?'}
        description={
          decision === 'DECLINED'
            ? `${applicantName} will be recorded as not qualifying for indigent support.`
            : `${applicantName} will be recorded as qualifying, and the discount applied to their municipal account.`
        }
        confirmLabel={decision === 'DECLINED' ? 'Decline application' : 'Approve application'}
        busy={busy}
        onCancel={() => setDecision(null)}
        onConfirm={submitDecision}
      >
        {decision === 'APPROVED' && requiredOutstanding.length > 0 ? (
          <div className="alert alert-warning">
            <Icon name="alert-triangle" size={16} />
            <span>{requiredOutstanding.length} required document(s) have not been uploaded.</span>
          </div>
        ) : null}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="confirm-notes">Review notes</label>
          <textarea
            id="confirm-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional, but strongly recommended for declines."
          />
        </div>
      </ConfirmModal>

      <Modal
        open={editing}
        onClose={editBusy ? undefined : () => setEditing(false)}
        size="lg"
        title="Edit application"
        description="Corrections are recorded field by field in the audit trail. Income totals are recalculated automatically."
        icon="edit"
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setEditing(false)} disabled={editBusy}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={editBusy}>
              {editBusy ? 'Saving…' : 'Save changes'}
            </button>
          </>
        }
      >
        {app.status !== 'DRAFT' ? (
          <div className="alert alert-warning">
            <Icon name="alert-triangle" size={16} />
            <span>
              This application has been {app.status.toLowerCase()}. Editing it changes the record a
              decision was based on.
            </span>
          </div>
        ) : null}

        {EDIT_FIELDS.map((group) => (
          <section key={group.group} style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '.8125rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink-mute)', marginBottom: '.75rem' }}>
              {group.group}
            </h3>
            <div className="form-row">
              {group.fields.map(([key, label, type, options]) => (
                <div className="form-group" key={key}>
                  <label htmlFor={`edit-${key}`}>{label}</label>
                  {type === 'select' || type === 'bool' ? (
                    <select
                      id={`edit-${key}`}
                      value={editForm[key] ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    >
                      {(type === 'bool' ? ['', 'Yes', 'No'] : options).map((o) => (
                        <option key={o} value={o}>{o === '' ? 'Not answered' : o.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`edit-${key}`}
                      type={type === 'number' || type === 'money' ? 'number' : 'text'}
                      step={type === 'money' ? '0.01' : undefined}
                      min={type === 'number' || type === 'money' ? '0' : undefined}
                      value={editForm[key] ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </Modal>

      <ConfirmModal
        open={confirmDelete}
        variant="danger"
        title="Delete this application?"
        description={`${app.reference || app.id.slice(0, 8)} for ${applicantName} will be permanently removed, along with every uploaded document.`}
        confirmLabel="Delete permanently"
        busy={deleteBusy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={removeApplication}
      >
        <div className="alert alert-warning" style={{ marginBottom: 0 }}>
          <Icon name="alert-triangle" size={16} />
          <span>The deletion is audited, but the application cannot be recovered.</span>
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={Boolean(docDecision)}
        variant={docDecision?.status === 'Rejected' ? 'danger' : 'success'}
        title={docDecision?.status === 'Rejected' ? 'Reject this document?' : 'Accept this document?'}
        description={
          docDecision?.status === 'Rejected'
            ? `${docDecision?.doc?.name} will be marked as rejected. The application stays in the queue.`
            : `${docDecision?.doc?.name} will be marked as acceptable again.`
        }
        confirmLabel={docDecision?.status === 'Rejected' ? 'Reject document' : 'Accept document'}
        busy={docBusy === docDecision?.doc?.id}
        onCancel={() => { setDocDecision(null); setDocReason(''); }}
        onConfirm={submitDocDecision}
      >
        {docDecision?.status === 'Rejected' ? (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="doc-reason">Reason</label>
            <input
              id="doc-reason"
              value={docReason}
              onChange={(e) => setDocReason(e.target.value)}
              placeholder="e.g. Statement is illegible"
            />
            <div className="field-hint">Recorded in the audit trail alongside the rejection.</div>
          </div>
        ) : null}
      </ConfirmModal>

      <Modal
        open={Boolean(viewer)}
        onClose={closeViewer}
        size="lg"
        title={viewer?.name}
        flushBody
        footer={
          <>
            <a href={viewer?.url} download={viewer?.name} className="btn btn-outline">
              <Icon name="download" size={15} /> Download
            </a>
            <button type="button" className="btn btn-primary" onClick={closeViewer}>Close</button>
          </>
        }
      >
        <div style={{ background: 'var(--slate-100)', minHeight: 360, display: 'grid', placeItems: 'center', padding: '1rem' }}>
          {viewer?.canPreview && isImage(viewer.mime, viewer.name) ? (
            <img src={viewer.url} alt={viewer.name} style={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain', borderRadius: 4 }} />
          ) : null}
          {viewer?.canPreview && isPdf(viewer.mime, viewer.name) ? (
            <iframe title={viewer.name} src={viewer.url} style={{ width: '100%', height: '68vh', border: 0, background: '#fff' }} />
          ) : null}
          {viewer && !viewer.canPreview ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Icon name="file" size={28} className="muted" style={{ margin: '0 auto .75rem' }} />
              <p className="muted">Preview is not available for this file type.</p>
            </div>
          ) : null}
        </div>
      </Modal>
    </AdminLayout>
  );
}
