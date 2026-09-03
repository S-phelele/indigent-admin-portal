import { useEffect, useState } from 'react';
import api from '../services/api';
import { friendlyError } from '../utils/apiError';
import Icon from './ui/Icon';

/**
 * Where the household's money comes from.
 *
 * This replaced "are you employed?" followed by five fixed amount boxes. That
 * shape assumed the answer was a job and made everything else an exception to
 * it, which is backwards here: most households applying to an indigent register
 * are not employed. They hold a child grant, an old age grant, a room let out,
 * piece work. Asking about employment first collects a "no" and then has to
 * claw the real answer back out.
 *
 * It also could not hold two grants, or two lodgers — five columns, five kinds
 * of income, and nowhere to put the sixth.
 *
 * ## The types are not defined here
 *
 * They come from `GET /applications/income-types`, along with the follow-up
 * questions each one asks. Three screens render this questionnaire — this one,
 * the mobile app, and the councillor's capture form — and three hardcoded
 * copies would drift apart, with the form used by the person least able to
 * check the result drifting furthest.
 */

const money = (v) => `R ${Number(v || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

const FIELD_LABELS = {
  jobDescription: 'What is the work?',
  employerName: 'Who do you work for?',
  businessName: 'What is the business called?',
  businessType: 'What does the business do?',
  registrationNumber: 'Business registration number',
  otherDetail: 'What is this income?',
};

const FIELD_PLACEHOLDERS = {
  jobDescription: 'Street vendor, domestic worker, security guard…',
  employerName: 'Name of your employer',
  businessName: 'Name of the business',
  businessType: 'Spaza shop, hair salon, taxi…',
  registrationNumber: 'From the CIPC registration certificate',
  otherDetail: 'Say where this money comes from',
};

export default function IncomeSources({ applicationId, people, onChange, disabled = false }) {
  const [types, setTypes] = useState([]);
  const [sources, setSources] = useState([]);
  const [declaredNone, setDeclaredNone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // The row being added or edited. Null when the form is closed.
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    api.get('/applications/income-types')
      .then((res) => setTypes(res.data.data))
      .catch(() => setTypes([]));
  }, []);

  const load = () => {
    if (!applicationId) { setLoading(false); return; }
    setLoading(true);
    api.get(`/applications/${applicationId}/income`)
      .then((res) => {
        setSources(res.data.data);
        setDeclaredNone(Boolean(res.data.declaredNoIncome));
      })
      .catch((err) => setError(friendlyError(err, 'We could not load your income details.')))
      .finally(() => setLoading(false));
  };

  useEffect(load, [applicationId]);

  const definition = (value) => types.find((t) => t.value === value) || null;

  const total = sources.reduce((sum, s) => sum + Number(s.monthlyAmount || 0), 0);
  const headcount = Number(people) || 0;

  /** Tell the wizard the figures moved, so step 4's threshold question is current. */
  const announce = (application) => { if (onChange) onChange(application); };

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      const payload = { ...draft };
      const res = draft.id
        ? await api.patch(`/applications/${applicationId}/income/${draft.id}`, payload)
        : await api.post(`/applications/${applicationId}/income`, payload);
      setDraft(null);
      setDeclaredNone(false);
      load();
      announce(res.data.application);
    } catch (err) {
      // The server's wording names the missing follow-up in the applicant's own
      // terms — "say what the work is" rather than "jobDescription required".
      setError(friendlyError(err, 'We could not save that.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    setBusy(true);
    try {
      const res = await api.delete(`/applications/${applicationId}/income/${id}`);
      load();
      announce(res.data.application);
    } catch (err) {
      setError(friendlyError(err, 'We could not remove that.'));
    } finally {
      setBusy(false);
    }
  };

  const declareNone = async (declared) => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/applications/${applicationId}/income/none`, { declared });
      setDeclaredNone(declared);
      load();
      announce(res.data.application);
    } catch (err) {
      setError(friendlyError(err, 'We could not save that.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="muted">Loading your income details…</p>;

  return (
    <div className="income-sources">
      <h2 className="form-section-title">Income</h2>
      <p className="form-section-lede">
        We do not assume that you work. Tell us where your household&rsquo;s money comes from — a job, a
        grant, a pension, renting out a room, or anything else. Add every source, and how much each one
        brings in a month.
      </p>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {sources.length > 0 && (
        <ul className="income-list">
          {sources.map((s) => (
            <li key={s.id} className="income-row">
              <div className="income-row-main">
                <strong>{s.label}</strong>
                {s.sentence && s.sentence !== s.label ? (
                  <span className="income-row-detail">{s.sentence.replace(`${s.label} — `, '')}</span>
                ) : null}
              </div>
              <span className="income-row-amount">{money(s.monthlyAmount)}</span>
              {!disabled && (
                <div className="income-row-actions">
                  <button type="button" className="btn-icon" onClick={() => setDraft(s)} aria-label={`Change ${s.label}`}>
                    <Icon name="edit" size={15} />
                  </button>
                  <button type="button" className="btn-icon" onClick={() => remove(s.id)} disabled={busy} aria-label={`Remove ${s.label}`}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* The figure the qualifying threshold is assessed against, shown live —
          nobody should answer step 4's threshold question without seeing the
          number it refers to. */}
      {sources.length > 0 && (
        <div className="income-total">
          <div className="income-total-row">
            <span>Total household income</span>
            <strong>{money(total)}</strong>
          </div>
          {headcount > 0 && (
            <div className="income-total-row muted">
              <span>Per person across {headcount} {headcount === 1 ? 'person' : 'people'}</span>
              <span>{money(total / headcount)}</span>
            </div>
          )}
        </div>
      )}

      {draft ? (
        <div className="income-form">
          <div className="form-group">
            <label htmlFor="income-type">Where does this money come from?</label>
            <select
              id="income-type"
              value={draft.type || ''}
              onChange={(e) => setDraft({ type: e.target.value, monthlyAmount: draft.monthlyAmount || '', id: draft.id })}
            >
              <option value="">Choose one…</option>
              {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {definition(draft.type)?.hint ? <small>{definition(draft.type).hint}</small> : null}
          </div>

          {/* The follow-up questions this type asks, as the server defines them. */}
          {(definition(draft.type)?.asks || []).map((field) => {
            // Only a registered business has a number to give — asked right
            // after that answer, not as a fixed part of the list, so it never
            // appears before "registered" has actually been chosen.
            if (field === 'registrationNumber' && draft.isRegistered !== true) return null;

            return field === 'isRegistered' ? (
              <div className="form-group" key={field}>
                <label htmlFor="income-registered">Is the business registered?</label>
                <select
                  id="income-registered"
                  value={draft.isRegistered === true ? 'yes' : draft.isRegistered === false ? 'no' : ''}
                  onChange={(e) => setDraft({ ...draft, isRegistered: e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null })}
                >
                  <option value="">Not sure</option>
                  <option value="yes">Yes, it is registered</option>
                  <option value="no">No, it is informal</option>
                </select>
                <small>Both are fine. An informal business does not count against you.</small>
              </div>
            ) : (
              <div className="form-group" key={field}>
                <label htmlFor={`income-${field}`}>{FIELD_LABELS[field] || field}</label>
                <input
                  id={`income-${field}`}
                  type="text"
                  value={draft[field] || ''}
                  onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                  placeholder={FIELD_PLACEHOLDERS[field] || ''}
                />
              </div>
            );
          })}

          {draft.type ? (
            <div className="form-group">
              <label htmlFor="income-amount">How much a month?</label>
              <input
                id="income-amount"
                type="number"
                step="0.01"
                min="0"
                value={draft.monthlyAmount ?? ''}
                onChange={(e) => setDraft({ ...draft, monthlyAmount: e.target.value })}
                placeholder="R 0.00"
              />
            </div>
          ) : null}

          <div className="income-form-actions">
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !draft.type}>
              {draft.id ? 'Save changes' : 'Add this income'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setDraft(null); setError(''); }} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      ) : !disabled && (
        <div className="income-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setDraft({ type: '', monthlyAmount: '' })} disabled={busy}>
            <Icon name="plus" size={15} /> {sources.length ? 'Add another source' : 'Add where your income comes from'}
          </button>

          {/*
            A real answer, and a common one — so it has somewhere to be recorded.
            Without it, an empty list means both "there is nothing" and "nobody
            has asked yet", and only one of those can be submitted.
          */}
          {sources.length === 0 && (
            <label className="income-none">
              <input
                type="checkbox"
                checked={declaredNone}
                onChange={(e) => declareNone(e.target.checked)}
                disabled={busy}
              />
              <span>This household has no income at all</span>
            </label>
          )}
        </div>
      )}

      {declaredNone && sources.length === 0 ? (
        <p className="income-declared-none">
          <Icon name="check" size={14} /> Recorded: this household has no income. You can still add a source
          if that changes.
        </p>
      ) : null}
    </div>
  );
}
