import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import Icon from '../components/ui/Icon';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { friendlyError } from '../utils/apiError';

/**
 * Registering a household at the door.
 *
 * This is used standing at a gate, on a phone, often in the sun, by somebody who
 * is talking to a resident at the same time. Every decision here follows from
 * that: one thing on screen at a time, large targets, and no step that cannot be
 * completed with the person in front of you.
 *
 * The flow is deliberately three steps and no more:
 *
 *   1. Check — has this household already been registered? Councillors walk the
 *      same streets as their predecessors and residents forget they applied.
 *      Skipping this is how a register ends up with two records per household.
 *   2. Register — name, ID, cell. The account and the draft application are
 *      created together by a single call, so a dropped signal cannot leave an
 *      account with no application.
 *   3. Hand over — show the sign-in details once, because the SMS may not have
 *      arrived before the councillor walks away.
 *
 * Capturing the rest of the form happens afterwards in the ordinary application
 * screens, which are the same ones the resident would have used.
 */
export default function Capture() {
  const navigate = useNavigate();
  const toast = useToast();
  const { isCouncillor, user } = useAuth();

  const [step, setStep] = useState('check');
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState({ idNumber: '', cellNumber: '' });
  const [found, setFound] = useState(null);
  const [searched, setSearched] = useState(false);

  const [form, setForm] = useState({ firstName: '', lastName: '', idNumber: '', cellNumber: '', email: '' });
  const [error, setError] = useState('');
  const [handover, setHandover] = useState(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // -------------------------------------------------------------------------
  // Step 1 — check for an existing household
  // -------------------------------------------------------------------------
  const runLookup = async (e) => {
    e?.preventDefault();
    if (!search.idNumber.trim() && !search.cellNumber.trim()) {
      setError('Enter an ID number or a cell number to check.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.get('/fieldwork/residents/lookup', { params: search });
      setFound(res.data.data ? { ...res.data.data, message: res.data.message } : null);
      setSearched(true);
      if (!res.data.data) {
        // Carry what was typed into the form — it is the same information.
        setForm((f) => ({ ...f, idNumber: search.idNumber.trim(), cellNumber: search.cellNumber.trim() }));
      }
    } catch (err) {
      setError(friendlyError(err, 'The check could not be completed.'));
    } finally {
      setBusy(false);
    }
  };

  const continueExisting = async () => {
    if (found.hasDraft) {
      navigate(`/applications/${found.draftId}/capture`);
      return;
    }
    setBusy(true);
    try {
      const res = await api.post(`/fieldwork/residents/${found.id}/applications`);
      toast.success('Application started for this household.');
      navigate(`/applications/${res.data.data.id}/capture`);
    } catch (err) {
      toast.error(friendlyError(err, 'Could not start an application.'));
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // Step 2 — register
  // -------------------------------------------------------------------------
  const register = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/fieldwork/households', form);
      setHandover({
        ...res.data.credentials,
        name: `${form.firstName} ${form.lastName}`.trim(),
        cellNumber: form.cellNumber,
        applicationId: res.data.data.application.id,
      });
      setStep('handover');
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'ALREADY_REGISTERED') {
        // Send them back to the check rather than leaving them stuck on a form
        // that cannot succeed.
        setError(data.message);
        setStep('check');
        setSearch({ idNumber: form.idNumber, cellNumber: form.cellNumber });
      } else {
        setError(data?.message || 'The household could not be registered.');
      }
    } finally {
      setBusy(false);
    }
  };

  const startCapturing = () => navigate(`/applications/${handover.applicationId}/capture`);

  return (
    <AdminLayout
      title="Register a household"
      description={
        isCouncillor
          ? `Capturing for ${user?.ward || 'your ward'}. Create the resident's account, then complete their application with them.`
          : 'Create a resident account and capture their application on their behalf.'
      }
      breadcrumb={<span>Fieldwork</span>}
    >
      <ol className="capture-steps" aria-label="Progress">
        {[
          { key: 'check', label: 'Check' },
          { key: 'register', label: 'Register' },
          { key: 'handover', label: 'Hand over' },
        ].map((s, i) => (
          <li
            key={s.key}
            className={`capture-step${step === s.key ? ' current' : ''}${
              ['check', 'register', 'handover'].indexOf(step) > i ? ' done' : ''
            }`}
          >
            <span className="capture-step-num">{i + 1}</span>
            <span>{s.label}</span>
          </li>
        ))}
      </ol>

      {error ? (
        <div className="alert alert-error" role="alert">
          <Icon name="alert" size={16} /> {error}
        </div>
      ) : null}

      {/* --------------------------------------------------------------- */}
      {step === 'check' ? (
        <div className="panel">
          <div className="panel-header">
            <h2>Has this household applied before?</h2>
            <p className="muted">
              Check first. Residents often forget they have applied, and a second record splits their history in two.
            </p>
          </div>

          <form onSubmit={runLookup} className="form-grid">
            <label className="form-group">
              <span>ID number</span>
              <input
                inputMode="numeric"
                autoComplete="off"
                value={search.idNumber}
                onChange={(e) => setSearch((s) => ({ ...s, idNumber: e.target.value }))}
                placeholder="13 digits"
              />
            </label>
            <label className="form-group">
              <span>or cell number</span>
              <input
                inputMode="tel"
                autoComplete="off"
                value={search.cellNumber}
                onChange={(e) => setSearch((s) => ({ ...s, cellNumber: e.target.value }))}
                placeholder="082 123 4567"
              />
            </label>
            <div className="form-actions span-2">
              <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
                <Icon name="search" size={16} /> {busy ? 'Checking…' : 'Check the register'}
              </button>
            </div>
          </form>

          {searched && found ? (
            <div className="capture-result found">
              <div className="capture-result-head">
                <Icon name="userCheck" size={18} />
                <div>
                  <strong>{found.name}</strong>
                  <p className="muted">{found.message}</p>
                </div>
              </div>
              <dl className="mini-facts">
                <div><dt>ID number</dt><dd>{found.idNumber || '—'}</dd></div>
                <div><dt>Cell</dt><dd>{found.cellNumber || '—'}</dd></div>
                <div><dt>Applications</dt><dd>{found.applications?.length || 0}</dd></div>
              </dl>
              <div className="form-actions">
                {found.hasPending ? (
                  <p className="muted">
                    Nothing to do here — their application is already with a reviewer. Give them their reference number.
                  </p>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={continueExisting} disabled={busy}>
                    <Icon name="applications" size={16} />
                    {found.hasDraft ? 'Continue their application' : 'Start a new application'}
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {searched && !found ? (
            <div className="capture-result clear">
              <div className="capture-result-head">
                <Icon name="check" size={18} />
                <div>
                  <strong>Not on the register</strong>
                  <p className="muted">You can register this household now.</p>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-primary btn-lg" onClick={() => setStep('register')}>
                  <Icon name="userPlus" size={16} /> Register this household
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* --------------------------------------------------------------- */}
      {step === 'register' ? (
        <div className="panel">
          <div className="panel-header">
            <h2>The resident&rsquo;s details</h2>
            <p className="muted">
              Take these from their ID book. The cell number matters most — it is how they receive their reference
              number and their sign-in details.
            </p>
          </div>

          <form onSubmit={register} className="form-grid">
            <label className="form-group">
              <span>First name <em>required</em></span>
              <input value={form.firstName} onChange={set('firstName')} required autoComplete="off" />
            </label>
            <label className="form-group">
              <span>Surname <em>required</em></span>
              <input value={form.lastName} onChange={set('lastName')} required autoComplete="off" />
            </label>
            <label className="form-group">
              <span>ID number <em>required</em></span>
              <input
                value={form.idNumber}
                onChange={set('idNumber')}
                required
                inputMode="numeric"
                maxLength={13}
                autoComplete="off"
              />
              <small>13 digits, exactly as printed in the ID book.</small>
            </label>
            <label className="form-group">
              <span>Cell number <em>required</em></span>
              <input value={form.cellNumber} onChange={set('cellNumber')} required inputMode="tel" autoComplete="off" />
              <small>Their own number if possible. Everything the municipality sends goes here.</small>
            </label>
            <label className="form-group span-2">
              <span>Email address <em className="optional">optional</em></span>
              <input type="email" value={form.email} onChange={set('email')} autoComplete="off" />
              <small>
                Leave blank if they do not have one — most residents will not. They will sign in with their cell number
                instead.
              </small>
            </label>

            <div className="form-actions span-2">
              <button type="button" className="btn btn-ghost" onClick={() => setStep('check')} disabled={busy}>
                Back
              </button>
              <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
                <Icon name="userPlus" size={16} /> {busy ? 'Registering…' : 'Register and send sign-in details'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* --------------------------------------------------------------- */}
      <Modal
        open={step === 'handover' && Boolean(handover)}
        title="Give these details to the resident"
        onClose={startCapturing}
        size="sm"
      >
        {handover ? (
          <>
            <p>
              <strong>{handover.name}</strong> now has an account.
              {handover.smsDelivered
                ? ` An SMS with these details was sent to ${handover.cellNumber}.`
                : ' The SMS could not be sent, so write these down for them before you leave.'}
            </p>

            <div className="credential-box">
              <div>
                <span className="credential-label">Username</span>
                <code>{handover.username}</code>
              </div>
              <div>
                <span className="credential-label">Temporary password</span>
                <code className="credential-password">{handover.temporaryPassword}</code>
              </div>
            </div>

            <p className="field-hint">
              This password is shown once and cannot be retrieved again. The resident will be asked to choose their own
              the first time they sign in.
            </p>

            <div className="form-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={startCapturing}>
                <Icon name="applications" size={16} /> Capture their application
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </AdminLayout>
  );
}
