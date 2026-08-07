import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import Icon from '../components/ui/Icon';
import Modal, { ConfirmModal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import LoadError, { loadErrorMessage } from '../components/LoadError';
import { SkeletonPanel, SkeletonStats } from '../components/ui/Skeleton';
import api from '../services/api';
import { friendlyError } from '../utils/apiError';

/**
 * The verification workspace.
 *
 * One screen holding everything an officer needs to decide what to recommend:
 * the declaration, the household, the external checks, the site visits, and —
 * most importantly — the places where those disagree with each other.
 *
 * The design puts the contradictions first. A tidy summary of a form somebody
 * filled in themselves is not verification; the useful output is the short list
 * of things that do not add up.
 */

const CHECK_SOURCES = [
  { value: 'SASSA', label: 'SASSA — grants' },
  { value: 'SARS', label: 'SARS — tax and income' },
  { value: 'UIF', label: 'UIF — employment' },
  { value: 'CREDIT_BUREAU', label: 'Credit bureau' },
  { value: 'DEEDS_OFFICE', label: 'Deeds office — property' },
  { value: 'MUNICIPAL_ACCOUNT', label: 'Municipal account' },
  { value: 'OTHER', label: 'Other' },
];

const VISIT_OUTCOMES = [
  { value: 'VERIFIED', label: 'Verified — household confirmed as declared' },
  { value: 'DETAILS_DISPUTED', label: 'Visited, but details do not match' },
  { value: 'OCCUPANT_ABSENT', label: 'Nobody home' },
  { value: 'NO_ACCESS', label: 'Could not gain access' },
  { value: 'ADDRESS_NOT_FOUND', label: 'Address could not be found' },
];

const OUTCOME_BADGE = {
  VERIFIED: 'badge-approved',
  DETAILS_DISPUTED: 'badge-declined',
  NO_ACCESS: 'badge-declined',
  OCCUPANT_ABSENT: 'badge-draft',
  ADDRESS_NOT_FOUND: 'badge-declined',
  SCHEDULED: 'badge-neutral',
  PASS: 'badge-approved',
  FAIL: 'badge-declined',
  INCONCLUSIVE: 'badge-draft',
  NOT_APPLICABLE: 'badge-neutral',
};

const zar = (n) => (n === null || n === undefined || n === ''
  ? '—'
  : `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`);

const dateZA = (d) => (d ? new Date(d).toLocaleDateString('en-ZA') : '—');

const Fact = ({ label, value, warn }) => (
  <div>
    <dt>{label}</dt>
    <dd className={warn ? 'is-warn' : undefined}>{value ?? '—'}</dd>
  </div>
);

export default function VerificationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [checkForm, setCheckForm] = useState({ source: 'SASSA', outcome: 'PASS', externalRef: '', findings: '', amountFound: '' });
  const [visitForm, setVisitForm] = useState({ outcome: 'VERIFIED', findings: '', scheduledFor: '' });
  const [showCheck, setShowCheck] = useState(false);
  const [showVisit, setShowVisit] = useState(false);
  const [showRecommend, setShowRecommend] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [recommendForm, setRecommendForm] = useState({ recommendation: 'APPROVE', notes: '' });
  const [requestMessage, setRequestMessage] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [locating, setLocating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/verification/applications/${id}`);
      setData(res.data.data);
    } catch (err) {
      setError(loadErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const addCheck = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/verification/applications/${id}/checks`, checkForm);
      toast.success(`${checkForm.source} check recorded.`);
      setShowCheck(false);
      setCheckForm({ source: 'SASSA', outcome: 'PASS', externalRef: '', findings: '', amountFound: '' });
      await load();
    } catch (err) {
      toast.error(friendlyError(err, 'Could not record the check.'));
    } finally {
      setBusy(false);
    }
  };

  const removeCheck = async (check) => {
    try {
      await api.delete(`/verification/checks/${check.id}`);
      toast.success('Check removed.');
      setConfirmRemove(null);
      await load();
    } catch (err) {
      toast.error(friendlyError(err, 'Could not remove the check.'));
    }
  };

  /**
   * Record the visit from where the officer is standing.
   *
   * Optional, and never blocking — but a visit logged with coordinates at the
   * property is a materially stronger record than one typed at a desk.
   */
  const attachLocation = () => {
    if (!navigator.geolocation) return toast.error('This device cannot provide a location.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setVisitForm((f) => ({ ...f, latitude: coords.latitude, longitude: coords.longitude }));
        setLocating(false);
        toast.success('Your location will be recorded with this visit.');
      },
      () => { setLocating(false); toast.error('Could not get a location. The visit can still be recorded.'); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const addVisit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post(`/verification/applications/${id}/visits`, visitForm);
      toast.success(res.data.message);
      setShowVisit(false);
      setVisitForm({ outcome: 'VERIFIED', findings: '', scheduledFor: '' });
      await load();
    } catch (err) {
      toast.error(friendlyError(err, 'Could not record the visit.'));
    } finally {
      setBusy(false);
    }
  };

  const recommend = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post(`/verification/applications/${id}/recommend`, recommendForm);
      toast.success(res.data.message);
      setShowRecommend(false);
      navigate('/verification');
    } catch (err) {
      toast.error(friendlyError(err, 'Could not record the recommendation.'));
    } finally {
      setBusy(false);
    }
  };

  const requestInformation = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post(`/verification/applications/${id}/request-information`, { message: requestMessage });
      toast.success(res.data.message);
      setShowRequest(false);
      setRequestMessage('');
      await load();
    } catch (err) {
      toast.error(friendlyError(err, 'Could not send the request.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Verification">
        <SkeletonStats count={4} />
        <SkeletonPanel height={180} />
        <SkeletonPanel height={220} />
      </AdminLayout>
    );
  }

  if (!data) {
    return <AdminLayout title="Verification"><LoadError message={error || 'Application not found.'} /></AdminLayout>;
  }

  const { assessment, consent, separation, household, siteVisits, checks } = data;
  const name = [data.names, data.surname].filter(Boolean).join(' ') || 'Unnamed applicant';
  const memberIncome = household.reduce((sum, m) => sum + Number(m.monthlyIncome || 0), 0);

  return (
    <AdminLayout
      title={name}
      breadcrumb={<Link to="/verification">Verification queue</Link>}
      description={`${data.reference || 'No reference'} · submitted ${dateZA(data.submittedAt)}`}
      actions={
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowRequest(true)}>
            <Icon name="mail" size={15} /> Ask the applicant
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowRecommend(true)}
            disabled={!data.canVerify}
          >
            <Icon name="check" size={15} /> Recommend
          </button>
        </>
      }
    >
      {/* Blockers first — there is no point reading anything else if the officer
          is not permitted to act on it. */}
      {!separation.ok ? (
        <div className="alert alert-error" role="alert">
          <Icon name="shield" size={16} />
          <span><strong>You cannot verify this application.</strong> {separation.reason}</span>
        </div>
      ) : null}

      {!consent.ok ? (
        <div className="alert alert-warning" role="alert">
          <Icon name="alert" size={16} />
          <span>
            <strong>Verification cannot proceed.</strong> {consent.blockers.join(' ')}{' '}
            These are legal preconditions, not preferences — the applicant must give them before checks can be run.
          </span>
        </div>
      ) : null}

      {data.recommendation ? (
        <div className="alert alert-info" role="status">
          <Icon name="info" size={16} />
          <span>
            <strong>{data.recommendation.toLowerCase()} already recommended</strong> on {dateZA(data.recommendedAt)}.
            {data.recommendationNotes ? ` ${data.recommendationNotes}` : ''} An administrator makes the final decision.
          </span>
        </div>
      ) : null}

      {/* --- What does not add up ------------------------------------------ */}
      <section className="panel">
        <div className="panel-header">
          <h2>What needs attention</h2>
          <p className="field-hint">
            Where the declaration and the evidence disagree. This is the output of verification that matters.
          </p>
        </div>

        {assessment.concerns.length === 0 ? (
          <p className="verify-clean">
            <Icon name="check" size={16} /> Nothing contradicts the declaration on the evidence recorded so far.
          </p>
        ) : (
          <ul className="concern-list">
            {assessment.concerns.map((c) => (
              <li key={c.code} className={`concern is-${c.severity}`}>
                <Icon name={c.severity === 'high' ? 'alert' : 'info'} size={16} />
                <span>{c.message}</span>
              </li>
            ))}
          </ul>
        )}

        {assessment.outstanding.length > 0 ? (
          <div className="insight">
            <Icon name="info" size={14} />
            <span>
              Still to do: {assessment.outstanding.join(' ')} Skipping any of these is allowed, but it should be
              deliberate.
            </span>
          </div>
        ) : null}
      </section>

      {/* --- The declaration ------------------------------------------------ */}
      <section className="panel">
        <div className="panel-header"><h2>The declaration</h2></div>
        <dl className="fact-grid">
          <Fact label="ID number" value={data.idNumber} />
          <Fact label="Cell" value={data.cellNumber} />
          <Fact label="Ward" value={data.wardNumber} />
          <Fact label="Category" value={data.applicantCategory?.replace(/_/g, ' ').toLowerCase()} />
          <Fact label="Tenure" value={data.tenure?.toLowerCase()} warn={data.tenure === 'TENANT'} />
          <Fact label="Municipal account" value={data.municipalAccountNumber} />
          <Fact label="Eskom account" value={data.eskomAccountNumber} />
          <Fact label="People on property" value={data.peopleOnProperty} />
          <Fact label="Declared income" value={zar(data.totalHouseholdIncome)} />
          <Fact label="Per person" value={zar(data.totalIncomePerPerson)} />
          <Fact
            label="Other property"
            value={data.ownsOtherProperty ? (data.otherPropertyDetails || 'Yes') : 'None declared'}
            warn={data.ownsOtherProperty}
          />
          <Fact label="Income excluded" value={data.incomeExclusions} />
        </dl>

        <div className="consent-row">
          {[
            ['Site visit', data.consentSiteVisit],
            ['Data matching', data.consentDataMatching],
            ['Sworn declaration', data.declarationTruthful],
          ].map(([label, given]) => (
            <span key={label} className={`badge ${given ? 'badge-approved' : 'badge-declined'}`}>
              {label}: {given ? 'given' : 'not given'}
            </span>
          ))}
          {data.consentGivenAt ? <span className="field-hint">Given {dateZA(data.consentGivenAt)}</span> : null}
        </div>

        {data.capturedBy ? (
          <p className="field-hint">
            Captured by {[data.capturedBy.firstName, data.capturedBy.lastName].filter(Boolean).join(' ')}
            {data.capturedBy.ward ? ` (${data.capturedBy.ward})` : ''} — not by the applicant.
          </p>
        ) : null}
      </section>

      {/* --- Household ------------------------------------------------------ */}
      <section className="panel">
        <div className="panel-header">
          <h2>Household ({household.length + 1} people)</h2>
          <p className="field-hint">
            Income is assessed per head, so who lives here is half the calculation. The applicant is not listed among
            their own dependants.
          </p>
        </div>

        {household.length === 0 ? (
          <p className="field-hint">Nobody else was listed. Confirm on the site visit whether the applicant lives alone.</p>
        ) : (
          <div className="table-card table-scroll">
            <table className="table-compact">
              <thead>
                <tr><th>Name</th><th>Relationship</th><th>Age</th><th>Own income</th></tr>
              </thead>
              <tbody>
                {household.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.fullName}</strong>{m.idNumber ? <small>{m.idNumber}</small> : null}</td>
                    <td>{m.relationship || '—'}</td>
                    <td>{m.age ?? '—'}</td>
                    <td className="num">{zar(m.monthlyIncome)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3}><strong>Members&rsquo; income</strong></td>
                  <td className="num"><strong>{zar(memberIncome)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- External checks ------------------------------------------------ */}
      <section className="panel">
        <div className="panel-header">
          <h2>External checks</h2>
          <p className="field-hint">
            Run the check on the relevant system, then record what it returned. The integrations themselves belong to
            the municipality&rsquo;s agreements with each body.
          </p>
        </div>

        {checks.length === 0 ? (
          <p className="field-hint">No checks recorded yet.</p>
        ) : (
          <div className="doc-list">
            {checks.map((c) => (
              <div className="doc-row" key={c.id}>
                <div className="doc-row-info">
                  <span className="doc-row-icon"><Icon name="shield" size={16} /></span>
                  <div>
                    <div className="doc-row-title">{c.source.replace(/_/g, ' ')}</div>
                    <div className="doc-row-meta">
                      <span className={`badge ${OUTCOME_BADGE[c.outcome]}`}>{c.outcome}</span>
                      {c.amountFound !== null ? <span>Found {zar(c.amountFound)}</span> : null}
                      {c.externalRef ? <span>Ref {c.externalRef}</span> : null}
                      <span>{c.officerName} · {dateZA(c.checkedAt)}</span>
                    </div>
                    {c.findings ? <p className="field-hint">{c.findings}</p> : null}
                  </div>
                </div>
                <div className="doc-row-actions">
                  <button type="button" className="btn btn-sm btn-danger-outline" onClick={() => setConfirmRemove(c)}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={() => setShowCheck(true)} disabled={!data.canVerify}>
            <Icon name="plus" size={15} /> Record a check
          </button>
        </div>
      </section>

      {/* --- Site visits ---------------------------------------------------- */}
      <section className="panel">
        <div className="panel-header">
          <h2>Site visits</h2>
          <p className="field-hint">
            {assessment.visits.verified
              ? 'The household has been verified at the property.'
              : `${assessment.visits.failed} of ${data.maxVisitAttempts} permitted attempts have failed. `
                + 'A disqualification for non-access has to be defensible, so each attempt is recorded separately.'}
          </p>
        </div>

        {siteVisits.length === 0 ? (
          <p className="field-hint">No visits recorded yet.</p>
        ) : (
          <ol className="visit-list">
            {siteVisits.map((v) => (
              <li key={v.id} className={`visit visit-${v.outcome.toLowerCase()}`}>
                <span className="visit-attempt">{v.attempt}</span>
                <div>
                  <div className="doc-row-meta">
                    <span className={`badge ${OUTCOME_BADGE[v.outcome]}`}>{v.outcome.replace(/_/g, ' ')}</span>
                    <span>{v.visitedAt ? dateZA(v.visitedAt) : `scheduled ${dateZA(v.scheduledFor)}`}</span>
                    <span>{v.officerName}</span>
                    {v.latitude ? (
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${v.latitude}&mlon=${v.longitude}#map=18/${v.latitude}/${v.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Icon name="mapPin" size={13} /> Where the officer stood
                      </a>
                    ) : null}
                  </div>
                  {v.findings ? <p className="field-hint">{v.findings}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowVisit(true)}
            disabled={!data.canVerify || assessment.visits.verified || assessment.visits.exhausted}
          >
            <Icon name="mapPin" size={15} /> Record a visit
          </button>
          {assessment.visits.verified ? <span className="field-hint">Already verified.</span> : null}
          {assessment.visits.exhausted ? <span className="field-hint is-warn">All attempts used.</span> : null}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <Modal open={showCheck} title="Record an external check" onClose={() => setShowCheck(false)}>
        <form onSubmit={addCheck} className="form-grid">
          <label className="form-group"><span>Source</span>
            <select value={checkForm.source} onChange={(e) => setCheckForm((f) => ({ ...f, source: e.target.value }))}>
              {CHECK_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className="form-group"><span>Outcome</span>
            <select value={checkForm.outcome} onChange={(e) => setCheckForm((f) => ({ ...f, outcome: e.target.value }))}>
              <option value="PASS">Pass — consistent with the declaration</option>
              <option value="FAIL">Fail — contradicts the declaration</option>
              <option value="INCONCLUSIVE">Inconclusive</option>
              <option value="NOT_APPLICABLE">Not applicable</option>
            </select>
          </label>
          <label className="form-group"><span>Income found <em className="optional">optional</em></span>
            <input
              type="number" min="0" step="0.01"
              value={checkForm.amountFound}
              onChange={(e) => setCheckForm((f) => ({ ...f, amountFound: e.target.value }))}
            />
            <small>Monthly. Compared against the declaration automatically.</small>
          </label>
          <label className="form-group"><span>Their reference <em className="optional">optional</em></span>
            <input value={checkForm.externalRef} onChange={(e) => setCheckForm((f) => ({ ...f, externalRef: e.target.value }))} />
            <small>So the check can be found again on their system.</small>
          </label>
          <label className="form-group span-2"><span>Findings</span>
            <textarea
              rows={3}
              value={checkForm.findings}
              onChange={(e) => setCheckForm((f) => ({ ...f, findings: e.target.value }))}
              placeholder="What the check returned, in your own words."
            />
          </label>
          <div className="form-actions span-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowCheck(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Record</button>
          </div>
        </form>
      </Modal>

      <Modal open={showVisit} title={`Record site visit ${assessment.visits.nextAttempt}`} onClose={() => setShowVisit(false)}>
        <form onSubmit={addVisit} className="form-grid">
          <label className="form-group span-2"><span>Outcome</span>
            <select value={visitForm.outcome} onChange={(e) => setVisitForm((f) => ({ ...f, outcome: e.target.value }))}>
              {VISIT_OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              <option value="SCHEDULED">Scheduling only — not visited yet</option>
            </select>
          </label>

          {visitForm.outcome === 'SCHEDULED' ? (
            <label className="form-group span-2"><span>Scheduled for</span>
              <input
                type="date"
                value={visitForm.scheduledFor}
                onChange={(e) => setVisitForm((f) => ({ ...f, scheduledFor: e.target.value }))}
              />
            </label>
          ) : null}

          <label className="form-group span-2"><span>Findings</span>
            <textarea
              rows={3}
              value={visitForm.findings}
              onChange={(e) => setVisitForm((f) => ({ ...f, findings: e.target.value }))}
              placeholder="What you saw. For a failed attempt, say what you tried."
            />
          </label>

          <div className="span-2">
            <button type="button" className="btn btn-outline btn-sm" onClick={attachLocation} disabled={locating}>
              <Icon name="mapPin" size={14} /> {locating ? 'Getting location…' : 'Attach my location'}
            </button>
            {visitForm.latitude ? <span className="field-hint">Location attached.</span> : null}
          </div>

          {verificationWarning(visitForm.outcome, assessment, data.maxVisitAttempts)}

          <div className="form-actions span-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowVisit(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Record visit</button>
          </div>
        </form>
      </Modal>

      <Modal open={showRecommend} title="Recommend an outcome" onClose={() => setShowRecommend(false)}>
        <p className="field-hint">
          This is a recommendation, not a decision. It goes to an administrator, who approves or declines. The applicant
          is not told anything at this point.
        </p>
        <form onSubmit={recommend} className="form-grid">
          <label className="form-group span-2"><span>Recommendation</span>
            <select
              value={recommendForm.recommendation}
              onChange={(e) => setRecommendForm((f) => ({ ...f, recommendation: e.target.value }))}
            >
              <option value="APPROVE">Approve — the household qualifies</option>
              <option value="REJECT">Reject — the household does not qualify</option>
              <option value="ESCALATE">Escalate — needs a decision above me</option>
            </select>
          </label>
          <label className="form-group span-2">
            <span>Reasons {recommendForm.recommendation !== 'APPROVE' ? <em>required</em> : <em className="optional">optional</em>}</span>
            <textarea
              rows={4}
              value={recommendForm.notes}
              onChange={(e) => setRecommendForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="What you checked and what you concluded."
            />
          </label>

          {assessment.concerns.some((c) => c.severity === 'high') && recommendForm.recommendation === 'APPROVE' ? (
            <div className="alert alert-warning span-2">
              <Icon name="alert" size={15} />
              <span>
                There are unresolved high-severity concerns on this application. Recommending approval over them is
                permitted, but say in your reasons why they do not disqualify.
              </span>
            </div>
          ) : null}

          <div className="form-actions span-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowRecommend(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Submit recommendation</button>
          </div>
        </form>
      </Modal>

      <Modal open={showRequest} title="Ask the applicant for more" onClose={() => setShowRequest(false)}>
        <form onSubmit={requestInformation} className="form-grid">
          <label className="form-group span-2"><span>What do you need?</span>
            <textarea
              rows={4}
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Plain language — this is shown to the applicant exactly as written."
              required
            />
            <small>They receive this as a notification and are told by SMS to sign in.</small>
          </label>
          <div className="form-actions span-2">
            <button type="button" className="btn btn-ghost" onClick={() => setShowRequest(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Send</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(confirmRemove)}
        title="Remove this check?"
        description="The record of what was checked and what it returned will be deleted. The audit trail keeps a note that it was removed."
        confirmLabel="Remove"
        cancelLabel="Keep"
        variant="danger"
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => removeCheck(confirmRemove)}
      />
    </AdminLayout>
  );
}

/** Warns before an attempt that would exhaust the applicant's chances. */
function verificationWarning(outcome, assessment, maxAttempts) {
  const failing = ['NO_ACCESS', 'OCCUPANT_ABSENT', 'ADDRESS_NOT_FOUND'].includes(outcome);
  if (!failing) return null;

  const wouldBe = assessment.visits.failed + 1;
  if (wouldBe < maxAttempts) {
    return (
      <div className="alert alert-info span-2">
        <Icon name="info" size={15} />
        <span>
          This will be failed attempt {wouldBe} of {maxAttempts}. The applicant is told by SMS, so they have a chance to
          arrange a time.
        </span>
      </div>
    );
  }
  return (
    <div className="alert alert-warning span-2">
      <Icon name="alert" size={15} />
      <span>
        <strong>This is the final permitted attempt.</strong> Recording it exhausts the applicant&rsquo;s chances and
        counts against their application. Only do so if a genuine attempt was made.
      </span>
    </div>
  );
}
