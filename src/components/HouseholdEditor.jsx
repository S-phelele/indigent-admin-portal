import { useState, useEffect, useCallback } from 'react';
import Icon from './ui/Icon';
import { useToast } from './ui/Toast';
import api from '../services/api';
import { friendlyError } from '../utils/apiError';

/**
 * Everyone living on the property.
 *
 * The register measures income per head, so the same R3 000 qualifies a family
 * of six and does not qualify somebody living alone. Listing the household is
 * therefore not paperwork — it is half the calculation, and it is usually the
 * half that decides the outcome.
 *
 * Two deliberate softenings, because this is where applications get abandoned:
 *
 *  - **An ID number is never demanded.** Informal households routinely have no
 *    document for every child living there. A name and an age is enough.
 *  - **The applicant is not listed among their own dependants.** Their details
 *    are the application; asking them to add themselves is confusing and
 *    produces double counting.
 */

const RELATIONSHIPS = [
  'Spouse or partner', 'Son', 'Daughter', 'Mother', 'Father',
  'Grandmother', 'Grandfather', 'Grandchild', 'Brother', 'Sister',
  'Other relative', 'Lodger', 'Other',
];

const blank = { fullName: '', relationship: '', idNumber: '', age: '', monthlyIncome: '' };

export default function HouseholdEditor({ applicationId, onChange, readOnly = false, declaredPeople }) {
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!applicationId) { setLoading(false); return; }
    try {
      const res = await api.get(`/applications/${applicationId}/household`);
      setMembers(res.data.data);
      setSummary(res.data.summary);
    } catch {
      // A household that will not load must not block the rest of the wizard.
      setError('Your household list could not be loaded. You can still continue.');
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => { load(); }, [load]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const reset = () => { setForm(blank); setEditingId(null); setShowForm(false); setError(''); };

  const save = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) { setError('Please give this person’s name.'); return; }

    setBusy(true);
    setError('');
    try {
      const res = editingId
        ? await api.patch(`/applications/${applicationId}/household/${editingId}`, form)
        : await api.post(`/applications/${applicationId}/household`, form);

      toast.success(res.data.message);
      reset();
      await load();
      // The wizard's headcount fields are recalculated server-side from the list.
      if (res.data.application) onChange?.(res.data.application);
    } catch (err) {
      setError(friendlyError(err, 'That could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (member) => {
    try {
      const res = await api.delete(`/applications/${applicationId}/household/${member.id}`);
      toast.success(res.data.message);
      await load();
      if (res.data.application) onChange?.(res.data.application);
    } catch (err) {
      toast.error(friendlyError(err, 'That person could not be removed.'));
    }
  };

  const edit = (member) => {
    setForm({
      fullName: member.fullName || '',
      relationship: member.relationship || '',
      idNumber: member.idNumber || '',
      age: member.age ?? '',
      monthlyIncome: member.monthlyIncome ?? '',
    });
    setEditingId(member.id);
    setShowForm(true);
  };

  if (loading) {
    return <p className="field-hint">Loading your household…</p>;
  }

  // +1 throughout: the applicant lives there too but is not a row, because
  // their details *are* the application.
  const counted = Number(declaredPeople) || 0;
  const listedTotal = members.length + 1;
  const matches = counted > 0 && listedTotal === counted;

  return (
    <div className="household">
      <p className="field-hint">
        List everyone who lives on the property with you. You do not need to add yourself — your own details are already
        on this application.
      </p>

      {/*
        The count against what was declared.

        peopleOnProperty is a number somebody types; this list is one they
        build, and nothing reconciled them — so an application could say five
        people and name two. Income per person is half the means test and is
        computed from the typed number, so a roll that does not match is not a
        tidiness problem. Shown live here and refused at submission.
      */}
      {counted > 0 ? (
        <p className={matches ? 'household-count met' : 'household-count'}>
          <Icon name={matches ? 'check' : 'alert-circle'} size={14} />
          {matches
            ? `All ${counted} people on the property are listed.`
            : listedTotal < counted
              ? `${listedTotal} of ${counted} people listed. Add ${counted - listedTotal} more before you can submit.`
              : `${listedTotal} listed, but you said ${counted} live here. Correct whichever is wrong.`}
        </p>
      ) : null}

      {members.length > 0 ? (
        <ul className="household-list">
          {members.map((m) => (
            <li key={m.id}>
              <div>
                <strong>{m.fullName}</strong>
                <small>
                  {[
                    m.relationship,
                    Number.isFinite(m.age) ? `${m.age} years old` : null,
                    Number(m.monthlyIncome) > 0
                      ? `earns R${Number(m.monthlyIncome).toLocaleString('en-ZA')} a month`
                      : null,
                  ].filter(Boolean).join(' · ') || 'No further details'}
                </small>
              </div>
              {!readOnly ? (
                <div className="household-actions">
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => edit(m)}>
                    <Icon name="edit" size={14} /> Edit
                  </button>
                  <button type="button" className="btn btn-sm btn-danger-outline" onClick={() => remove(m)}>
                    <Icon name="trash" size={14} />
                    <span className="sr-only">Remove {m.fullName}</span>
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="field-hint">
          Nobody added yet. If you live alone, you can leave this empty and continue.
        </p>
      )}

      {summary && members.length > 0 ? (
        <p className="household-summary">
          <Icon name="users" size={15} />
          <span>
            {summary.total} people in this household — you and {summary.listed} other
            {summary.listed === 1 ? '' : 's'}
            {summary.children > 0 ? `, including ${summary.children} child${summary.children === 1 ? '' : 'ren'}` : ''}
            {summary.pensioners > 0 ? ` and ${summary.pensioners} pensioner${summary.pensioners === 1 ? '' : 's'}` : ''}.
          </span>
        </p>
      ) : null}

      {error ? <p className="field-error">{error}</p> : null}

      {!readOnly && !showForm ? (
        <button type="button" className="btn btn-outline" onClick={() => setShowForm(true)}>
          <Icon name="plus" size={15} /> Add someone to my household
        </button>
      ) : null}

      {!readOnly && showForm ? (
        <form onSubmit={save} className="household-form">
          <div className="form-group">
            <label htmlFor="hh-name">Full name</label>
            <input id="hh-name" value={form.fullName} onChange={set('fullName')} required autoComplete="off" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="hh-rel">Relationship to you</label>
              <select id="hh-rel" value={form.relationship} onChange={set('relationship')}>
                <option value="">Please choose</option>
                {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="hh-age">Age</label>
              <input id="hh-age" type="number" min="0" max="120" value={form.age} onChange={set('age')} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="hh-id">ID number <span className="optional-tag">optional</span></label>
              <input id="hh-id" value={form.idNumber} onChange={set('idNumber')} inputMode="numeric" maxLength={13} />
              <p className="field-hint">Only if they have one. Leave blank if not.</p>
            </div>
            <div className="form-group">
              <label htmlFor="hh-income">Their own income</label>
              <input
                id="hh-income"
                type="number"
                min="0"
                step="0.01"
                value={form.monthlyIncome}
                onChange={set('monthlyIncome')}
                placeholder="R 0.00"
              />
              <p className="field-hint">Leave blank if they earn nothing.</p>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={reset}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add to household'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
