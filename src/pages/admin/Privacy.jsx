import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '../../components/AdminLayout';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import LoadError, { loadErrorMessage } from '../../components/LoadError';
import { SkeletonTable, SkeletonStats, Refreshing } from '../../components/ui/Skeleton';
import { friendlyError } from '../../utils/apiError';
import api from '../../services/api';

/**
 * POPIA governance: subject requests, retention, and the breach register.
 *
 * Three tabs rather than three sidebar links. They are the same job — being able
 * to answer for what the register holds — and an administrator comes here because
 * something is due, not to browse. Splitting them would put three rarely-visited
 * links in a navigation list that already has to stay readable on a phone.
 *
 * The retention tab is the only screen in this portal that can destroy data, so it
 * is built to make that obvious: the survey is the default and the only thing a
 * page load performs, and applying it needs a typed confirmation.
 */

const TABS = [
  { key: 'requests', label: 'Requests from people', icon: 'mail' },
  { key: 'retention', label: 'Retention', icon: 'clock' },
  { key: 'breaches', label: 'Breach register', icon: 'alert-triangle' },
];

const REQUEST_STATES = [
  { key: '', label: 'All' },
  { key: 'RECEIVED', label: 'New' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'COMPLETED', label: 'Answered' },
  { key: 'REFUSED', label: 'Refused' },
];

const REQUEST_TONE = {
  RECEIVED: 'badge-draft',
  IN_PROGRESS: 'badge-pending',
  COMPLETED: 'badge-approved',
  REFUSED: 'badge-declined',
};

const TYPE_LABEL = {
  ACCESS: 'Wants a copy of their information',
  CORRECTION: 'Wants something corrected',
  DELETION: 'Wants their information deleted',
  OBJECTION: 'Objects to how we use it',
};

const SEVERITY_TONE = {
  LOW: 'badge-neutral',
  MEDIUM: 'badge-draft',
  HIGH: 'badge-declined',
  CRITICAL: 'badge-declined',
};

const BREACH_STATES = ['DETECTED', 'INVESTIGATING', 'CONTAINED', 'NOTIFIED', 'CLOSED'];

const dateZA = (d) => (d ? new Date(d).toLocaleDateString('en-ZA') : '—');
const sentence = (s) => (s ? s.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) : '');

export default function Privacy() {
  const toast = useToast();
  const [tab, setTab] = useState('requests');
  const [readiness, setReadiness] = useState(null);

  // Loaded once, because it is a configuration fact rather than a queue.
  useEffect(() => {
    api.get('/privacy/readiness')
      .then((res) => setReadiness(res.data.data))
      .catch(() => setReadiness(null));
  }, []);

  return (
    <AdminLayout
      title="Privacy and retention"
      description="What the register holds, who has asked about it, and how long it is kept. Required under POPIA."
    >
      {/**
        * Surfaced at the top of the page rather than buried in settings. An
        * unrecorded Information Officer is not a cosmetic gap — it is the address
        * a data subject's request is supposed to go to, and until it is set the
        * privacy notice tells the public so.
        */}
      {readiness && !readiness.ready ? (
        <div className="callout callout-warn">
          <Icon name="alert-triangle" size={18} />
          <div>
            <strong>This municipality is not ready to answer a privacy request.</strong>
            <ul className="tight-list">
              {readiness.gaps.map((gap) => <li key={gap}>{gap}</li>)}
            </ul>
            <small>
              Set these in the server environment. Until then the public privacy notice states that no Information
              Officer has been recorded, which is accurate but not compliant.
            </small>
          </div>
        </div>
      ) : null}

      <div className="toolbar">
        <div className="toolbar-actions">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`pill${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <Icon name={t.icon} size={14} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'requests' ? <Requests toast={toast} /> : null}
      {tab === 'retention' ? <Retention toast={toast} /> : null}
      {tab === 'breaches' ? <Breaches toast={toast} /> : null}
    </AdminLayout>
  );
}

// ---------------------------------------------------------------------------
// Requests from data subjects
// ---------------------------------------------------------------------------

function Requests({ toast }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [answering, setAnswering] = useState(null);
  const [form, setForm] = useState({ status: 'IN_PROGRESS', responseNotes: '', refusalGround: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const res = await api.get('/privacy/requests', { params: { ...(status ? { status } : {}), page, pageSize: 25 } });
      setRows(res.data.data);
      setMeta(res.data);
    } catch (err) {
      setError(loadErrorMessage(err));
    } finally {
      setFirstLoad(false);
      setRefreshing(false);
    }
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.patch(`/privacy/requests/${answering.id}`, form);
      toast.success(res.data.message);
      setAnswering(null);
      await load();
    } catch (err) {
      toast.error(friendlyError(err, 'Could not update that request.'));
    } finally {
      setBusy(false);
    }
  };

  const totalPages = meta?.pagination?.totalPages || 1;
  const needsGround = form.status === 'REFUSED';
  const needsNotes = form.status === 'COMPLETED';
  const canSubmit = needsGround ? form.refusalGround.trim() : needsNotes ? form.responseNotes.trim() : true;

  return (
    <>
      <LoadError message={error} />

      {firstLoad ? <SkeletonStats count={4} /> : (
        <div className="stats-grid">
          {REQUEST_STATES.filter((s) => s.key).map((s) => (
            <button
              key={s.key}
              type="button"
              className={`stat-card stat-card-button${status === s.key ? ' active' : ''}`}
              onClick={() => { setStatus(status === s.key ? '' : s.key); setPage(1); }}
            >
              <div>
                <span className="stat-value">{meta?.counts?.[s.key] ?? 0}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar-actions">
          {REQUEST_STATES.map((s) => (
            <button
              key={s.key || 'all'}
              type="button"
              className={`pill${status === s.key ? ' active' : ''}`}
              onClick={() => { setStatus(s.key); setPage(1); }}
            >
              {s.label}
            </button>
          ))}
        </div>
        {meta?.responseDays ? (
          <span className="muted">Answer within {meta.responseDays} days</span>
        ) : null}
      </div>

      {firstLoad ? (
        <SkeletonTable rows={6} columns={6} />
      ) : rows.length === 0 ? (
        <div className="table-empty">
          <Icon name="check" size={28} />
          <p>Nobody has asked us anything in this category.</p>
          <small>An empty list is the normal state. It is not evidence that requests are being missed.</small>
        </div>
      ) : (
        <Refreshing active={refreshing}>
          <div className="table-card table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Who asked</th>
                  <th>What they want</th>
                  <th className="nowrap">Received</th>
                  <th className="nowrap">Due</th>
                  <th>State</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.overdue ? 'row-warn' : undefined}>
                    <td>
                      <strong>{r.subjectName || r.subjectEmail || 'Unknown'}</strong>
                      <small>{r.subjectEmail}</small>
                    </td>
                    <td>
                      <strong>{TYPE_LABEL[r.type] || r.type}</strong>
                      <small className="clamp-2">{r.request}</small>
                    </td>
                    <td className="nowrap">{dateZA(r.receivedAt)}</td>
                    <td className={`nowrap${r.overdue ? ' warn-cell' : ''}`}>
                      {r.completedAt ? 'Answered'
                        : r.overdue ? `${Math.abs(r.daysRemaining)} days late`
                          : r.daysRemaining != null ? `${r.daysRemaining} days` : '—'}
                    </td>
                    <td>
                      <span className={`badge ${REQUEST_TONE[r.status] || 'badge-neutral'}`}>
                        {REQUEST_STATES.find((s) => s.key === r.status)?.label || r.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setAnswering(r);
                          setForm({
                            status: r.status === 'RECEIVED' ? 'IN_PROGRESS' : r.status,
                            responseNotes: r.responseNotes || '',
                            refusalGround: r.refusalGround || '',
                          });
                        }}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Refreshing>
      )}

      {totalPages > 1 ? (
        <div className="pagination">
          <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="muted">Page {page} of {totalPages}</span>
          <button type="button" className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      ) : null}

      <Modal open={Boolean(answering)} title="Answer this request" onClose={() => setAnswering(null)}>
        {answering ? (
          <>
            <div className="detail-block">
              <span className="detail-label">{TYPE_LABEL[answering.type] || answering.type}</span>
              <p>{answering.request}</p>
              {answering.correctionDetail ? (
                <>
                  <span className="detail-label">What they say it should be</span>
                  <p>{answering.correctionDetail}</p>
                </>
              ) : null}
            </div>

            <div className="form-grid">
              <label className="form-group span-2">
                <span>Move it to</span>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="IN_PROGRESS">In progress — we are working on it</option>
                  <option value="COMPLETED">Answered — we did what they asked</option>
                  <option value="REFUSED">Refused — we cannot do it</option>
                </select>
              </label>

              {needsNotes || form.status === 'IN_PROGRESS' ? (
                <label className="form-group span-2">
                  <span>What did you do?{needsNotes ? '' : ' (optional)'}</span>
                  <textarea
                    rows={3}
                    value={form.responseNotes}
                    onChange={(e) => setForm({ ...form, responseNotes: e.target.value })}
                    placeholder="e.g. Corrected the cell number on application IND-2026-0114 and sent them a copy."
                  />
                  <small>This is sent to the person, so write it for them rather than for the file.</small>
                </label>
              ) : null}

              {needsGround ? (
                <label className="form-group span-2">
                  <span>On what lawful ground?</span>
                  <textarea
                    rows={3}
                    value={form.refusalGround}
                    onChange={(e) => setForm({ ...form, refusalGround: e.target.value })}
                    placeholder="e.g. The approved application must remain auditable under the MFMA, so it cannot be deleted yet."
                  />
                  {/**
                    * POPIA permits refusing in defined circumstances. It does not
                    * permit refusing without saying which one applies, so the
                    * server rejects a refusal with no ground and this says why
                    * before the officer hits a validation error.
                    */}
                  <small>
                    A refusal must rest on a ground POPIA actually allows. The person is told this wording, together
                    with their right to complain to the Information Regulator.
                  </small>
                </label>
              ) : null}

              <div className="form-actions span-2">
                <button type="button" className="btn btn-ghost" onClick={() => setAnswering(null)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || !canSubmit}>
                  {busy ? 'Saving…' : 'Save and tell them'}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Retention
// ---------------------------------------------------------------------------

function Retention({ toast }) {
  const [survey, setSurvey] = useState(null);
  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const res = await api.get('/privacy/retention/survey');
      setSurvey(res.data);
    } catch (err) {
      setError(loadErrorMessage(err));
    } finally {
      setFirstLoad(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const apply = async () => {
    setBusy(true);
    try {
      const res = await api.post('/privacy/retention/apply', { confirm: true });
      toast.success(res.data.message);
      if (res.data.data?.failures?.length) {
        toast.error('Some rules could not be applied. Check the server log.');
      }
      setConfirming(false);
      setTyped('');
      await load();
    } catch (err) {
      toast.error(friendlyError(err, 'Could not apply the retention policy.'));
    } finally {
      setBusy(false);
    }
  };

  const due = survey?.data?.totalDue ?? 0;

  return (
    <>
      <LoadError message={error} />

      <div className="callout callout-info">
        <Icon name="info" size={18} />
        <div>
          <strong>Nothing on this page has changed anything.</strong>
          <p>
            POPIA section 14 says personal information may not be kept longer than the purpose it was collected for
            requires. This is what has passed that point. Removing it is a separate, deliberate action.
          </p>
          <small>
            Declined applications and lapsed registrations are <em>anonymised</em> rather than deleted — the ward-level
            demand history survives, the person does not. Approved applications are never swept, because they spent
            public money and must stay auditable.
          </small>
        </div>
      </div>

      {firstLoad ? <SkeletonTable rows={7} columns={5} /> : (
        <Refreshing active={refreshing}>
          <div className="table-card table-scroll">
            <table>
              <thead>
                <tr>
                  <th>What</th>
                  <th className="nowrap">Kept for</th>
                  <th>Then</th>
                  <th className="nowrap">Past that point</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {(survey?.data?.findings || []).map((f) => (
                  <tr key={f.key}>
                    <td><strong>{f.label}</strong></td>
                    <td className="nowrap">{f.period}</td>
                    <td>
                      <span className={`badge ${f.action === 'KEEP' ? 'badge-approved' : f.action === 'DELETE' ? 'badge-declined' : 'badge-draft'}`}>
                        {f.action === 'KEEP' ? 'Kept' : f.action === 'DELETE' ? 'Deleted' : 'Anonymised'}
                      </span>
                    </td>
                    <td className={`nowrap${f.due > 0 ? ' warn-cell' : ''}`}>
                      {f.action === 'KEEP' ? '—' : f.due}
                    </td>
                    <td><small>{f.basis}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Refreshing>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-outline" onClick={load} disabled={refreshing}>
          <Icon name="refresh" size={15} /> Survey again
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => { setConfirming(true); setTyped(''); }}
          disabled={due === 0}
        >
          <Icon name="trash" size={15} /> {due === 0 ? 'Nothing is due' : `Apply to ${due} record(s)`}
        </button>
      </div>

      <Modal open={confirming} title="Apply the retention policy" onClose={() => setConfirming(false)}>
        <div className="callout callout-warn">
          <Icon name="alert-triangle" size={18} />
          <div>
            <strong>This cannot be undone.</strong>
            <p>
              {due} record(s) will be deleted or stripped of the name, ID number, address and coordinates they carry.
              Anonymisation is irreversible by design — that is what takes the row outside POPIA rather than merely
              making it compliant.
            </p>
          </div>
        </div>
        {/**
          * A typed confirmation rather than just a second button. The server also
          * requires `confirm: true`, so this is the second of two deliberate acts
          * rather than the only guard.
          */}
        <div className="form-grid">
          <label className="form-group span-2">
            <span>Type <code>APPLY</code> to confirm</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="APPLY" autoComplete="off" />
          </label>
          <div className="form-actions span-2">
            <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
            <button type="button" className="btn btn-danger" onClick={apply} disabled={busy || typed !== 'APPLY'}>
              {busy ? 'Applying…' : 'Apply the policy'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Breach register
// ---------------------------------------------------------------------------

function Breaches({ toast }) {
  const [rows, setRows] = useState([]);
  const [guidance, setGuidance] = useState('');
  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [recording, setRecording] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', severity: 'MEDIUM', dataAffected: '', peopleAffected: '' });
  const [patch, setPatch] = useState({ status: '', remediation: '', regulatorNotified: false, subjectsNotified: false });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const res = await api.get('/privacy/breaches');
      setRows(res.data.data);
      setGuidance(res.data.guidance || '');
    } catch (err) {
      setError(loadErrorMessage(err));
    } finally {
      setFirstLoad(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const record = async () => {
    setBusy(true);
    try {
      const res = await api.post('/privacy/breaches', form);
      toast.success(res.data.message);
      setRecording(false);
      setForm({ title: '', description: '', severity: 'MEDIUM', dataAffected: '', peopleAffected: '' });
      await load();
    } catch (err) {
      toast.error(friendlyError(err, 'Could not record that incident.'));
    } finally {
      setBusy(false);
    }
  };

  const update = async () => {
    setBusy(true);
    try {
      const res = await api.patch(`/privacy/breaches/${updating.id}`, patch);
      toast.success(res.data.message);
      setUpdating(null);
      await load();
    } catch (err) {
      toast.error(friendlyError(err, 'Could not update that incident.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <LoadError message={error} />

      <div className="callout callout-info">
        <Icon name="info" size={18} />
        <div>
          <strong>An empty register is the correct state.</strong>
          <p>
            Having one is not an admission that anything has gone wrong. It is what makes a section 22 notification
            possible inside the deadline if it ever does.
          </p>
          {guidance ? <small>{guidance}</small> : null}
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={() => setRecording(true)}>
          <Icon name="plus" size={15} /> Record an incident
        </button>
      </div>

      {firstLoad ? (
        <SkeletonTable rows={4} columns={6} />
      ) : rows.length === 0 ? (
        <div className="table-empty">
          <Icon name="shield" size={28} />
          <p>No incidents have been recorded.</p>
        </div>
      ) : (
        <Refreshing active={refreshing}>
          <div className="table-card table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Incident</th>
                  <th>Severity</th>
                  <th className="nowrap">Detected</th>
                  <th className="nowrap">People</th>
                  <th>State</th>
                  <th className="nowrap">Notified</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.title}</strong>
                      <small className="clamp-2">{b.description}</small>
                    </td>
                    <td><span className={`badge ${SEVERITY_TONE[b.severity]}`}>{sentence(b.severity)}</span></td>
                    <td className="nowrap">{dateZA(b.detectedAt)}</td>
                    <td className="nowrap">{b.peopleAffected ?? '—'}</td>
                    <td><span className="badge badge-neutral">{sentence(b.status)}</span></td>
                    <td className="nowrap">
                      <small>
                        {b.regulatorNotifiedAt ? 'Regulator ✓' : 'Regulator —'}<br />
                        {b.subjectsNotifiedAt ? 'People ✓' : 'People —'}
                      </small>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          setUpdating(b);
                          setPatch({
                            status: b.status,
                            remediation: b.remediation || '',
                            regulatorNotified: Boolean(b.regulatorNotifiedAt),
                            subjectsNotified: Boolean(b.subjectsNotifiedAt),
                          });
                        }}
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Refreshing>
      )}

      <Modal open={recording} title="Record an incident" onClose={() => setRecording(false)}>
        <div className="form-grid">
          <label className="form-group span-2">
            <span>What happened?</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Exported applicant list emailed to the wrong address" />
          </label>
          <label className="form-group span-2">
            <span>Describe it</span>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What was disclosed, how it was discovered, and what has been done so far." />
          </label>
          <label className="form-group">
            <span>How serious?</span>
            <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              <option value="LOW">Low — no personal information left the municipality</option>
              <option value="MEDIUM">Medium — limited disclosure, contained</option>
              <option value="HIGH">High — identifying information disclosed</option>
              <option value="CRITICAL">Critical — ID numbers or bank details disclosed at scale</option>
            </select>
          </label>
          <label className="form-group">
            <span>How many people, if known?</span>
            <input type="number" min="0" value={form.peopleAffected}
              onChange={(e) => setForm({ ...form, peopleAffected: e.target.value })} placeholder="Leave blank if unknown" />
          </label>
          <label className="form-group span-2">
            <span>What information was involved?</span>
            <input value={form.dataAffected} onChange={(e) => setForm({ ...form, dataAffected: e.target.value })}
              placeholder="e.g. Names, ID numbers and addresses of 40 households" />
          </label>
          <div className="form-actions span-2">
            <button type="button" className="btn btn-ghost" onClick={() => setRecording(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={record}
              disabled={busy || !form.title.trim() || !form.description.trim()}>
              {busy ? 'Recording…' : 'Record it'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(updating)} title={updating?.title || 'Update incident'} onClose={() => setUpdating(null)}>
        <div className="form-grid">
          <label className="form-group span-2">
            <span>Where is it now?</span>
            <select value={patch.status} onChange={(e) => setPatch({ ...patch, status: e.target.value })}>
              {BREACH_STATES.map((s) => <option key={s} value={s}>{sentence(s)}</option>)}
            </select>
          </label>
          <label className="form-group span-2">
            <span>What was done, and what changed so it does not recur?</span>
            <textarea rows={3} value={patch.remediation}
              onChange={(e) => setPatch({ ...patch, remediation: e.target.value })} />
            <small>Required before an incident can be closed.</small>
          </label>
          <label className="checkbox span-2">
            <input type="checkbox" checked={patch.regulatorNotified}
              onChange={(e) => setPatch({ ...patch, regulatorNotified: e.target.checked })} />
            <span>The Information Regulator has been notified</span>
          </label>
          <label className="checkbox span-2">
            <input type="checkbox" checked={patch.subjectsNotified}
              onChange={(e) => setPatch({ ...patch, subjectsNotified: e.target.checked })} />
            <span>The affected people have been notified</span>
          </label>
          <div className="form-actions span-2">
            <button type="button" className="btn btn-ghost" onClick={() => setUpdating(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={update} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
