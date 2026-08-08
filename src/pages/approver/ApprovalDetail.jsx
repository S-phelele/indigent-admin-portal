import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import SignaturePad from '../../components/SignaturePad';
import { useToast } from '../../components/ui/Toast';
import LoadError, { loadErrorMessage } from '../../components/LoadError';
import { SkeletonPanel, SkeletonStats } from '../../components/ui/Skeleton';
import { friendlyError } from '../../utils/apiError';
import { label, TENURE, CATEGORY, EMPLOYMENT, STATUS } from '../../utils/labels';
import api from '../../services/api';

/**
 * The case file, as whoever holds it now sees it.
 *
 * One screen for all three stages. What changes is the panel of work in the
 * middle — verification findings, the means test, or the signature — and what
 * stays the same is everything that makes those judgements possible: the
 * declaration, the household, and the full history of who did what.
 *
 * The history is deliberately not tucked behind a tab. An approver signing off
 * should see, without asking for it, that the income was edited after
 * assessment or that the file has been round twice.
 */

const money = (n) => (n == null || n === '' ? '—' : `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`);
const dateZA = (d) => (d ? new Date(d).toLocaleDateString('en-ZA') : '—');
const dateTimeZA = (d) => (d ? new Date(d).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const Fact = ({ label: name, value, warn }) => (
  <div>
    <dt>{name}</dt>
    <dd className={warn ? 'is-warn' : undefined}>{value ?? '—'}</dd>
  </div>
);

export default function ApprovalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [decision, setDecision] = useState(null);
  const [notes, setNotes] = useState('');
  const [signature, setSignature] = useState(null);
  const [showReturn, setShowReturn] = useState(false);
  const [returnTo, setReturnTo] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [assessment, setAssessment] = useState({ assessmentNotes: '', budgetConfirmed: false, budgetNotes: '' });

  const load = useCallback(async () => {
    try {
      const [detail, hist] = await Promise.all([
        api.get(`/approvals/applications/${id}`),
        api.get(`/approvals/applications/${id}/history`),
      ]);
      setData(detail.data.data);
      setHistory(hist.data.data);
      setAssessment((a) => ({
        ...a,
        assessmentNotes: detail.data.data.assessmentNotes || '',
        budgetConfirmed: detail.data.data.budgetConfirmed ?? false,
        budgetNotes: detail.data.data.budgetNotes || '',
      }));
    } catch (err) {
      setError(loadErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const saveAssessment = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/approvals/applications/${id}/assessment`, assessment);
      toast.success(res.data.message);
      await load();
    } catch (err) {
      toast.error(friendlyError(err, 'Could not save the assessment.'));
    } finally {
      setBusy(false);
    }
  };

  const decide = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/approvals/applications/${id}/decide`, {
        decision,
        notes,
        ...(data.position.requiresSignature ? { signature } : {}),
      });
      toast.success(res.data.message);
      navigate('/approvals');
    } catch (err) {
      toast.error(friendlyError(err, 'Could not complete this stage.'));
    } finally {
      setBusy(false);
    }
  };

  const sendBack = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/approvals/applications/${id}/return`, { toStage: returnTo, reason: returnReason });
      toast.success(res.data.message);
      navigate('/approvals');
    } catch (err) {
      toast.error(friendlyError(err, 'Could not send this back.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Approval">
        <SkeletonStats count={4} />
        <SkeletonPanel height={180} />
        <SkeletonPanel height={240} />
      </AdminLayout>
    );
  }

  if (!data) {
    return <AdminLayout title="Approval"><LoadError message={error || 'Application not found.'} /></AdminLayout>;
  }

  const { position, meansTest: mt, household, signatures } = data;
  const name = [data.names, data.surname].filter(Boolean).join(' ') || 'Unnamed applicant';
  const atAssessment = position.stage === 'ASSESSMENT';
  const atSignoff = position.stage === 'SUPERVISOR_SIGNOFF';
  const canSubmitDecision = decision
    && (decision === 'APPROVE' || notes.trim())
    && (!position.requiresSignature || signature);

  return (
    <AdminLayout
      title={name}
      breadcrumb={<Link to="/approvals">Approvals</Link>}
      description={`${data.reference || 'No reference'} · submitted ${dateZA(data.submittedAt)}`}
      actions={
        <Link className="btn btn-outline btn-sm" to={`/applications/${id}/print`}>
          <Icon name="file" size={15} /> Print
        </Link>
      }
    >
      {/* Where the file is, always visible. */}
      <ol className="stage-track" aria-label="Approval progress">
        {['Verification', 'Assessment', 'Sign-off'].map((stageName, i) => {
          const done = i + 1 < position.stepNumber;
          const now = i + 1 === position.stepNumber;
          return (
            <li key={stageName} className={`stage-step${done ? ' done' : ''}${now ? ' current' : ''}`}>
              <span className="stage-step-num">{done ? <Icon name="check" size={14} /> : i + 1}</span>
              <span>{stageName}</span>
            </li>
          );
        })}
      </ol>

      {!position.canAct ? (
        <div className="alert alert-warning" role="alert">
          <Icon name="shield" size={16} />
          <span><strong>You cannot act on this file.</strong> {position.blockedReason}</span>
        </div>
      ) : null}

      {/* --- The declaration ---------------------------------------------- */}
      <section className="panel">
        <div className="panel-header"><h2>The household</h2></div>
        <dl className="fact-grid">
          <Fact label="ID number" value={data.idNumber} />
          <Fact label="Cell" value={data.cellNumber} />
          <Fact label="Ward" value={data.wardNumber} />
          <Fact label="Category" value={label(CATEGORY, data.applicantCategory)} />
          <Fact label="Ownership" value={label(TENURE, data.tenure)} warn={data.tenure === 'TENANT'} />
          <Fact label="Employment" value={label(EMPLOYMENT, data.employmentStatus)} />
          <Fact label="Municipal account" value={data.municipalAccountNumber} />
          <Fact label="People on property" value={data.peopleOnProperty} />
          <Fact label="Declared income" value={money(data.totalHouseholdIncome)} />
          <Fact
            label="Other property"
            value={data.ownsOtherProperty ? (data.otherPropertyDetails || 'Yes') : 'None declared'}
            warn={data.ownsOtherProperty}
          />
        </dl>

        {household?.length ? (
          <div className="table-card table-scroll" style={{ marginTop: '1rem' }}>
            <table className="table-compact">
              <thead><tr><th>Household member</th><th>Relationship</th><th>Age</th><th>Own income</th></tr></thead>
              <tbody>
                {household.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.fullName}</strong></td>
                    <td>{m.relationship || '—'}</td>
                    <td>{m.age ?? '—'}</td>
                    <td className="num">{money(m.monthlyIncome)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* --- The means test ------------------------------------------------ */}
      <section className="panel">
        <div className="panel-header">
          <h2>Means test</h2>
          <p className="field-hint">
            Computed live from the household as it stands now, using the highest of what was declared, what was
            verified, and what the household members earn.
          </p>
        </div>

        <div className="means-grid">
          <div className={`means-headline is-${mt.result.toLowerCase()}`}>
            <span className="means-result">
              {mt.result === 'QUALIFIES' ? 'Qualifies'
                : mt.result === 'ABOVE_THRESHOLD' ? 'Above the threshold'
                  : 'Not enough information'}
            </span>
            <span className="means-detail">
              {money(mt.assessedIncome)} across {mt.people} {mt.people === 1 ? 'person' : 'people'}
            </span>
          </div>
          <dl className="stat-pairs">
            <div><dt>Declared</dt><dd>{money(mt.declaredIncome)}</dd></div>
            <div><dt>Verified</dt><dd>{mt.verifiedIncome == null ? '—' : money(mt.verifiedIncome)}</dd></div>
            <div><dt>Per person</dt><dd>{money(mt.perPerson)}</dd></div>
            <div><dt>Threshold</dt><dd>{money(mt.threshold)}</dd></div>
          </dl>
        </div>

        {mt.notes.length ? (
          <ul className="concern-list" style={{ marginTop: '1rem' }}>
            {mt.notes.map((n) => (
              <li key={n.code} className={`concern is-${n.severity}`}>
                <Icon name={n.severity === 'high' ? 'alert' : 'info'} size={16} />
                <span>{n.message}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {/* The assessment officer records their working here. */}
        {atAssessment && position.canAct ? (
          <div className="form-grid" style={{ marginTop: '1.25rem' }}>
            <label className="form-group span-2">
              <span>Your assessment</span>
              <textarea
                rows={3}
                value={assessment.assessmentNotes}
                onChange={(e) => setAssessment((a) => ({ ...a, assessmentNotes: e.target.value }))}
                placeholder="What you checked and what you concluded. If you are approving over the threshold, say why."
              />
            </label>
            <label className="form-group consent-check span-2">
              <span style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                <input
                  type="checkbox"
                  checked={assessment.budgetConfirmed}
                  onChange={(e) => setAssessment((a) => ({ ...a, budgetConfirmed: e.target.checked }))}
                />
                The indigent budget can carry this relief
              </span>
            </label>
            <label className="form-group span-2">
              <span>Budget notes <em className="optional">optional</em></span>
              <input
                value={assessment.budgetNotes}
                onChange={(e) => setAssessment((a) => ({ ...a, budgetNotes: e.target.value }))}
                placeholder="e.g. Within the current financial year's allocation"
              />
            </label>
            <div className="form-actions span-2">
              <button type="button" className="btn btn-outline" onClick={saveAssessment} disabled={busy}>
                <Icon name="check" size={15} /> Save assessment
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* --- Signatures already on the file ------------------------------- */}
      {signatures?.length ? (
        <section className="panel">
          <div className="panel-header"><h2>Signed</h2></div>
          {signatures.map((s, i) => (
            <div className="signature-record" key={i}>
              <img src={s.image} alt={`Signature of ${s.name}`} className="signature-image" />
              <div>
                <strong>{s.name}</strong>
                <p className="field-hint">
                  {s.signedAtLabel}{s.ip ? ` · from ${s.ip}` : ''}
                  <br />{s.statement}
                </p>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {/* --- The decision -------------------------------------------------- */}
      {position.canAct ? (
        <section className="panel">
          <div className="panel-header">
            <h2>{position.decides ? 'Sign off' : `Complete ${position.label.toLowerCase()}`}</h2>
            <p className="field-hint">
              {position.decides
                ? 'This is the decision. The applicant is told the outcome as soon as you sign.'
                : `This is a recommendation. It moves the file to ${
                  position.nextStage === 'ASSESSMENT' ? 'assessment' : 'sign-off'}, where somebody else looks at it.`}
            </p>
          </div>

          <div className="decision-choice">
            {[
              { value: 'APPROVE', label: position.decides ? 'Approve' : 'Recommend approval', tone: 'good' },
              { value: 'REJECT', label: position.decides ? 'Decline' : 'Recommend refusal', tone: 'bad' },
            ].map((option) => (
              <label key={option.value} className={`decision-option is-${option.tone}${decision === option.value ? ' selected' : ''}`}>
                <input
                  type="radio"
                  name="decision"
                  checked={decision === option.value}
                  onChange={() => setDecision(option.value)}
                />
                <Icon name={option.value === 'APPROVE' ? 'check' : 'close'} size={18} />
                <span>{option.label}</span>
              </label>
            ))}
          </div>

          <label className="form-group" style={{ marginTop: '1rem' }}>
            <span className="field-label">
              Reasons {decision === 'REJECT' ? <em>required</em> : <em className="optional">optional</em>}
            </span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Recorded on the file and visible to everyone who handles it afterwards."
            />
          </label>

          {atSignoff ? (
            <div style={{ marginTop: '1.25rem' }}>
              <SignaturePad onChange={setSignature} label="Sign to confirm this decision" />
            </div>
          ) : null}

          {mt.notes.some((n) => n.severity === 'high') && decision === 'APPROVE' ? (
            <div className="alert alert-warning" style={{ marginTop: '1rem' }}>
              <Icon name="alert" size={15} />
              <span>
                There are unresolved concerns on this file. Approving over them is allowed, but say in your reasons
                why they do not disqualify the household.
              </span>
            </div>
          ) : null}

          <div className="form-actions">
            {position.returnableTo.length ? (
              <button type="button" className="btn btn-outline" onClick={() => setShowReturn(true)} disabled={busy}>
                <Icon name="arrow-left" size={15} /> Send back
              </button>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={decide} disabled={busy || !canSubmitDecision}>
              <Icon name={position.decides ? 'key' : 'check'} size={15} />
              {busy ? 'Saving…' : position.decides ? 'Sign and record the decision' : 'Complete and pass on'}
            </button>
          </div>
          {!canSubmitDecision && decision ? (
            <p className="field-hint">
              {decision === 'REJECT' && !notes.trim()
                ? 'Please give your reasons before continuing.'
                : position.requiresSignature && !signature
                  ? 'Please sign in the box above before recording the decision.'
                  : ''}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* --- Who has touched this file ------------------------------------ */}
      <section className="panel">
        <div className="panel-header">
          <h2>Case history</h2>
          <p className="field-hint">
            Every action and every change, with a name and a time against it. This is what the municipality shows at
            audit.
          </p>
        </div>

        {history?.timeline?.length ? (
          <ol className="case-timeline">
            {history.timeline.map((entry, i) => (
              <li key={i} className={`case-entry is-${entry.kind}${entry.sensitive ? ' is-sensitive' : ''}`}>
                <span className="case-dot" aria-hidden="true" />
                <div>
                  <div className="case-head">
                    <strong>{entry.summary}</strong>
                    <span className="field-hint">{dateTimeZA(entry.at)}</span>
                  </div>
                  <p className="field-hint">
                    {entry.who || 'Unknown'}{entry.role ? ` · ${entry.role.replace(/_/g, ' ').toLowerCase()}` : ''}
                    {entry.detail ? ` — ${entry.detail}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="field-hint">Nothing has happened to this file yet.</p>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <Modal open={showReturn} title="Send this file back" onClose={() => setShowReturn(false)}>
        <p className="field-hint">
          Returning creates a new step. Nothing already recorded is erased, and whoever works the stage you send it to
          will be told it has arrived.
        </p>
        <div className="form-grid">
          <label className="form-group span-2">
            <span>Send back to</span>
            <select value={returnTo} onChange={(e) => setReturnTo(e.target.value)}>
              <option value="">Choose a stage</option>
              {position.returnableTo.map((s) => (
                <option key={s} value={s}>{s === 'VERIFICATION' ? 'Verification' : 'Assessment'}</option>
              ))}
            </select>
          </label>
          <label className="form-group span-2">
            <span>What needs to be corrected?</span>
            <textarea
              rows={3}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Be specific — this is the instruction the next officer works from."
            />
          </label>
          <div className="form-actions span-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowReturn(false)}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={sendBack}
              disabled={busy || !returnTo || !returnReason.trim()}
            >
              Send back
            </button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}
