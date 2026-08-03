import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

function isImage(mime, fileName) {
  if (mime && mime.startsWith('image/')) return true;
  const ext = (fileName || '').toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some((e) => ext.endsWith(e));
}

function isPdf(mime, fileName) {
  if (mime === 'application/pdf') return true;
  return (fileName || '').toLowerCase().endsWith('.pdf');
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [viewer, setViewer] = useState(null); // { url, name, mime, docId }
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState('');

  useEffect(() => {
    api.get(`/admin/applications/${id}`)
      .then((res) => {
        setApp(res.data.data);
        setNotes(res.data.data.reviewNotes || '');
      })
      .catch(() => setMessage('Failed to load application'))
      .finally(() => setLoading(false));
  }, [id]);

  // Cleanup object URLs when viewer closes / unmounts
  useEffect(() => {
    return () => {
      if (viewer?.url) URL.revokeObjectURL(viewer.url);
    };
  }, [viewer]);

  const updateStatus = async (status) => {
    setActionLoading(true);
    setMessage('');
    try {
      const res = await api.patch(`/admin/applications/${id}/status`, { status, reviewNotes: notes });
      setApp(res.data.data);
      setMessage(`Application ${status.toLowerCase()} successfully`);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const openDocument = async (doc, asDownload = false) => {
    setViewerError('');
    setViewerLoading(true);
    try {
      const res = await api.get(`/documents/file/${doc.id}`, {
        params: asDownload ? { download: '1' } : {},
        responseType: 'blob',
      });

      const mime = doc.mimeType || res.data.type || 'application/octet-stream';
      const blob = new Blob([res.data], { type: mime });
      const url = URL.createObjectURL(blob);

      if (asDownload) {
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.fileName || doc.name || 'document';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setViewerLoading(false);
        return;
      }

      // Revoke previous viewer URL if any
      setViewer((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return {
          url,
          name: doc.fileName || doc.name,
          mime,
          docId: doc.id,
          canPreview: isImage(mime, doc.fileName) || isPdf(mime, doc.fileName),
        };
      });
    } catch (err) {
      console.error(err);
      setViewerError(err.response?.data?.message || 'Could not open document. File may be missing.');
    } finally {
      setViewerLoading(false);
    }
  };

  const closeViewer = () => {
    setViewer((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    setViewerError('');
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!app) return <div className="loading">Application not found</div>;

  const yesNo = (v) => (v === true ? 'Yes' : v === false ? 'No' : '—');
  const money = (v) => (v != null ? `R ${Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '—');

  return (
    <div className="app-page">
      <header className="app-header">
        <h1>Indigent Register</h1>
        <div className="header-actions">
          <Link to="/" className="header-link">🏠 Home</Link>
          <span className="header-link">👤 {user?.firstName || 'Admin'}</span>
          <button className="header-link" type="button" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>
        <button type="button" className="back-link" onClick={() => navigate('/')}>← Back to applications</button>

        {message && (
          <div className={`alert ${message.includes('success') ? 'alert-success' : 'alert-error'}`}>
            {message}
          </div>
        )}
        {viewerError && <div className="alert alert-error">{viewerError}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem' }}>
              {[app.names, app.surname].filter(Boolean).join(' ') || 'Application'}
            </h2>
            <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>
              ID: {app.id.slice(0, 8)}… · Status:{' '}
              <span className={`badge badge-${app.status?.toLowerCase()}`}>{app.status}</span>
            </p>
          </div>
          {app.status === 'PENDING' && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-primary" disabled={actionLoading} onClick={() => updateStatus('APPROVED')}>
                Approve
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                disabled={actionLoading}
                onClick={() => updateStatus('DECLINED')}
              >
                Decline
              </button>
            </div>
          )}
        </div>

        <div className="form-card" style={{ maxWidth: '100%', marginBottom: '1.5rem' }}>
          <h3 className="form-section-title">Applicant Particulars</h3>
          <div className="form-row">
            <div className="form-group"><label>Marital Status</label><p>{app.maritalStatus || '—'}</p></div>
            <div className="form-group"><label>Employment Status</label><p>{app.employmentStatus || '—'}</p></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>ID Number</label><p>{app.idNumber || '—'}</p></div>
            <div className="form-group"><label>Cell Number</label><p>{app.cellNumber || '—'} {app.cellVerified ? '✓' : ''}</p></div>
          </div>
          <div className="form-group"><label>Residential Address</label><p>{app.residentialAddress || '—'}</p></div>
          <div className="form-group"><label>Employer</label><p>{app.employerName || '—'} · {app.employerAddress || ''}</p></div>
        </div>

        <div className="form-card" style={{ maxWidth: '100%', marginBottom: '1.5rem' }}>
          <h3 className="form-section-title">Property & Household</h3>
          <div className="form-row">
            <div className="form-group"><label>People on property</label><p>{app.peopleOnProperty ?? '—'}</p></div>
            <div className="form-group"><label>Children under 18</label><p>{app.childrenUnder18 ?? '—'}</p></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Adults</label><p>{app.adults ?? '—'}</p></div>
            <div className="form-group"><label>Pensioners over 60</label><p>{app.pensionersOver60 ?? '—'}</p></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Water Meter</label><p>{app.waterMeterNumber || '—'}</p></div>
            <div className="form-group"><label>Electricity Meter</label><p>{app.electricityMeterNumber || '—'}</p></div>
          </div>
        </div>

        <div className="form-card" style={{ maxWidth: '100%', marginBottom: '1.5rem' }}>
          <h3 className="form-section-title">Household Income</h3>
          <div className="form-row">
            <div className="form-group"><label>Salary</label><p>{money(app.salary)}</p></div>
            <div className="form-group"><label>Old Age Pension</label><p>{money(app.oldAgePension)}</p></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Disability Pension</label><p>{money(app.disabilityPension)}</p></div>
            <div className="form-group"><label>Business Income</label><p>{money(app.businessIncome)}</p></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Renting Income</label><p>{money(app.rentingIncome)}</p></div>
            <div className="form-group"><label>Total Household Income</label><p><strong>{money(app.totalHouseholdIncome)}</strong></p></div>
          </div>
        </div>

        <div className="form-card" style={{ maxWidth: '100%', marginBottom: '1.5rem' }}>
          <h3 className="form-section-title">General Information</h3>
          <div className="form-group"><label>Owns immovable property?</label><p>{yesNo(app.ownsImmovableProperty)}</p></div>
          <div className="form-group"><label>Full-time occupant?</label><p>{yesNo(app.isFullTimeOccupant)}</p></div>
          <div className="form-group"><label>Income ≤ R4 200?</label><p>{yesNo(app.incomeBelowThreshold)}</p></div>
          <div className="form-group"><label>Municipal arrears?</label><p>{yesNo(app.hasMunicipalArrears)}</p></div>
          <div className="form-group"><label>Arrears arrangement?</label><p>{yesNo(app.hasArrearsArrangement)}</p></div>
        </div>

                {/* Documents with View / Download */}
        <div className="form-card" style={{ maxWidth: '100%', marginBottom: '1.5rem' }}>
          <h3 className="form-section-title">Documents</h3>

          {(app.documents || []).length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '1rem 0' }}>No documents</p>
          ) : (
            <div className="doc-list">
              {(app.documents || []).map((doc) => (
                <div className="doc-row" key={doc.id}>
                  <div className="doc-row-info">
                    <div className="doc-row-title">{doc.name}</div>
                    <div className="doc-row-meta">
                      <span>{doc.type}</span>
                      <span className={`badge ${doc.importance === 'REQUIRED' ? 'badge-required' : 'badge-optional'}`}>
                        {doc.importance}
                      </span>
                      <span className={`badge ${doc.status === 'Uploaded' ? 'badge-uploaded' : 'badge-pending'}`}>
                        {doc.status}
                      </span>
                      {doc.fileName && (
                        <span>
                          {doc.fileName}
                          {doc.fileSize ? ` · ${(doc.fileSize / 1024).toFixed(0)} KB` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="doc-row-actions">
                    {doc.status === 'Uploaded' ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={viewerLoading}
                          onClick={() => openDocument(doc, false)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={viewerLoading}
                          onClick={() => openDocument(doc, true)}
                        >
                          Download
                        </button>
                      </>
                    ) : (
                      <span style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>Not uploaded</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewerLoading && (
            <p style={{ marginTop: '0.75rem', color: 'var(--gray-500)', fontSize: '0.9rem' }}>
              Loading document…
            </p>
          )}
        </div>

        <div className="form-card" style={{ maxWidth: '100%' }}>
          <h3 className="form-section-title">Review Notes</h3>
          <div className="form-group">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add review notes..."
              style={{ width: '100%', padding: '0.65rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)' }}
            />
          </div>
          {app.status === 'PENDING' && (
            <div className="form-actions">
              <button type="button" className="btn btn-primary" disabled={actionLoading} onClick={() => updateStatus('APPROVED')}>
                Approve Application
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                disabled={actionLoading}
                onClick={() => updateStatus('DECLINED')}
              >
                Decline Application
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Document viewer modal */}
      {viewer && (
        <div className="modal-overlay" onClick={closeViewer} role="presentation">
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            style={{
              maxWidth: '90vw',
              width: '900px',
              maxHeight: '90vh',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--gray-200)',
                gap: '1rem',
              }}
            >
              <h2 style={{ color: 'var(--gray-800)', fontSize: '1rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {viewer.name}
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <a
                  href={viewer.url}
                  download={viewer.name}
                  className="btn btn-outline btn-sm"
                >
                  Download
                </a>
                <button type="button" className="btn btn-outline btn-sm" onClick={closeViewer}>
                  Close
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', background: 'var(--gray-100)', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              {viewer.canPreview && isImage(viewer.mime, viewer.name) && (
                <img
                  src={viewer.url}
                  alt={viewer.name}
                  style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 4 }}
                />
              )}
              {viewer.canPreview && isPdf(viewer.mime, viewer.name) && (
                <iframe
                  title={viewer.name}
                  src={viewer.url}
                  style={{ width: '100%', height: '70vh', border: 'none', background: 'white' }}
                />
              )}
              {!viewer.canPreview && (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <p style={{ marginBottom: '1rem', color: 'var(--gray-600)' }}>
                    Preview is not available for this file type.
                  </p>
                  <a href={viewer.url} download={viewer.name} className="btn btn-primary">
                    Download file
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
