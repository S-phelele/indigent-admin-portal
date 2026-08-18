import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import Icon from '../../components/ui/Icon';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import DerivedIdentity from '../../components/DerivedIdentity';
import IncomeSources from '../../components/IncomeSources';
import HouseholdEditor from '../../components/HouseholdEditor';
import FunctioningQuestions from '../../components/FunctioningQuestions';
import { useToast } from '../../components/ui/Toast';
import api from '../../services/api';
import useUpload from '../../hooks/useUpload';
import UploadProgress from '../../components/ui/UploadProgress';
import { friendlyError } from '../../utils/apiError';

/**
 * Capturing a resident's application on their behalf.
 *
 * Uses exactly the same endpoints, the same fields and the same validation as
 * the resident's own wizard — a field capture is not held to a lower standard,
 * and the reviewer must be able to trust both equally. It follows the same five
 * steps for the same reason the resident's form does: tenure and category
 * decide which documents get asked for, and the consent declarations are legal
 * requirements, not paperwork — none of that can be a step a councillor's
 * capture skips.
 *
 * One difference from the resident-facing form: saving happens on "Next" and
 * from the header button, not silently, so a lost signal at the door costs one
 * section rather than a whole household's answers.
 */

const STEPS = [
  { num: 1, label: 'Applicant' },
  { num: 2, label: 'Property' },
  { num: 3, label: 'Income' },
  { num: 4, label: 'General' },
  { num: 5, label: 'Documents' },
];

const empty = {
  title: '', surname: '', fullName: '', idNumber: '', cellNumber: '', maritalStatus: '',
  residentialAddress: '', postalAddress: '',
  tenure: '', applicantCategory: 'STANDARD',
  municipalAccountNumber: '', eskomAccountNumber: '', wardNumber: '',
  peopleOnProperty: '', childrenUnder18: '', adults: '', pensionersOver60: '',
  waterMeterNumber: '', electricityMeterNumber: '',
  ownsImmovableProperty: '', isFullTimeOccupant: '', incomeBelowThreshold: '',
  hasMunicipalArrears: '', hasArrearsArrangement: '',
  ownsOtherProperty: '', otherPropertyDetails: '', incomeExclusions: '',
  addressLatitude: '', addressLongitude: '', addressFormatted: '', addressSource: '', addressAccuracyM: '',
  // The Washington Group Short Set, identical to the applicant's own form so a
  // captured application carries the same data as one somebody filled in.
  difficultySeeing: '', difficultyHearing: '', difficultyWalking: '',
  difficultyRemembering: '', difficultySelfCare: '', difficultyCommunicating: '',
  // Legally load-bearing, so always sent — including a withdrawn "yes" — never
  // left for the client to omit silently.
  consentSiteVisit: false, consentDataMatching: false, declarationTruthful: false,
};

const STRINGS = [
  'title', 'surname', 'fullName', 'idNumber', 'cellNumber', 'maritalStatus', 'residentialAddress',
  'postalAddress', 'tenure', 'applicantCategory', 'municipalAccountNumber', 'eskomAccountNumber', 'wardNumber',
  'waterMeterNumber', 'electricityMeterNumber', 'otherPropertyDetails', 'incomeExclusions',
  'difficultySeeing', 'difficultyHearing', 'difficultyWalking',
  'difficultyRemembering', 'difficultySelfCare', 'difficultyCommunicating',
];
const INTS = ['peopleOnProperty', 'childrenUnder18', 'adults', 'pensionersOver60'];

/**
 * Initials from whatever given names were typed.
 *
 * Mirrors src/lib/names.js on the server. The first *letter* rather than the
 * first character, because people bracket a preferred name and
 * "Nomsa (Thandiwe)" should still give N.T.
 */
function initialsOf(fullName) {
  return String(fullName || '')
    .trim()
    .split(/\s+/)
    .flatMap((part) => part.split('-'))
    .map((part) => [...part].find((ch) => /\p{L}/u.test(ch)))
    .filter(Boolean)
    .map((ch) => ch.toUpperCase() + '.')
    .join('');
}
// Income is captured as rows against /applications/:id/income and its totals
// are derived there. Nothing about money is sent from this form any more.
const MONEY = [];
const BOOLS = ['ownsImmovableProperty', 'isFullTimeOccupant', 'incomeBelowThreshold', 'hasMunicipalArrears', 'hasArrearsArrangement', 'ownsOtherProperty'];

const num = (v) => (v === '' || v === null || v === undefined ? undefined : (Number.isFinite(Number(v)) ? Number(v) : undefined));
const bool = (v) => (v === 'Yes' ? true : v === 'No' ? false : undefined);

function buildPayload(form, nextStep) {
  const payload = { currentStep: nextStep };
  STRINGS.forEach((k) => { if (form[k] !== '' && form[k] != null) payload[k] = form[k]; });
  INTS.forEach((k) => { const n = num(form[k]); if (n !== undefined) payload[k] = Math.floor(n); });
  MONEY.forEach((k) => { const n = num(form[k]); if (n !== undefined) payload[k] = n; });
  BOOLS.forEach((k) => { const b = bool(form[k]); if (b !== undefined) payload[k] = b; });

  ['consentSiteVisit', 'consentDataMatching', 'declarationTruthful'].forEach((k) => {
    if (typeof form[k] === 'boolean') payload[k] = form[k];
  });

  // Coordinates travel as a pair, or are cleared as a pair — half a coordinate
  // locates nothing, and the API rejects a lone value.
  if (form.addressLatitude !== '' && form.addressLongitude !== '') {
    payload.addressLatitude = Number(form.addressLatitude);
    payload.addressLongitude = Number(form.addressLongitude);
    payload.addressSource = form.addressSource || 'DEVICE';
    if (form.addressFormatted) payload.addressFormatted = form.addressFormatted;
    if (form.addressAccuracyM !== '') payload.addressAccuracyM = Number(form.addressAccuracyM);
  }
  return payload;
}

const YesNo = ({ label, value, onChange, hint }) => (
  <fieldset className="form-group yesno">
    <legend>{label}</legend>
    <div className="yesno-options">
      {['Yes', 'No'].map((option) => (
        <label key={option} className={`yesno-option${value === option ? ' selected' : ''}`}>
          <input type="radio" checked={value === option} onChange={() => onChange(option)} />
          <span>{option}</span>
        </label>
      ))}
    </div>
    {hint ? <small>{hint}</small> : null}
  </fieldset>
);

export default function CaptureApplication() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [application, setApplication] = useState(null);
  const { progress, done: justUploaded, upload: sendFile, cancel } = useUpload();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(empty);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitProblems, setSubmitProblems] = useState(null);
  const [locating, setLocating] = useState(false);
  const fileInputs = useRef({});

  const load = async () => {
    try {
      const res = await api.get(`/applications/${id}`);
      const app = res.data.data;
      setApplication(app);
      setDocuments(app.documents || []);
      setStep(app.currentStep || 1);
      setForm((f) => {
        const next = { ...f };
        Object.keys(empty).forEach((k) => {
          const value = app[k];
          if (value === null || value === undefined) return;
          next[k] = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
        });
        // Registration at the door writes the resident's first name onto the
        // legacy `names` column, not `fullName` — so a household just registered
        // by this same councillor showed up here with a blank name field until
        // this fallback, exactly the field the councillor had just typed in.
        if (!app.fullName && app.names) next.fullName = app.names;
        // Booleans that are always sent (never "not yet answered") round-trip as
        // real booleans rather than the Yes/No strings the radio questions use.
        ['consentSiteVisit', 'consentDataMatching', 'declarationTruthful'].forEach((k) => {
          next[k] = Boolean(app[k]);
        });
        return next;
      });
    } catch (err) {
      setError(friendlyError(err, 'This application could not be loaded.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target?.value ?? e }));

  const save = async (nextStep = step) => {
    setSaving(true);
    setError('');
    try {
      const res = await api.patch(`/applications/${id}`, buildPayload(form, nextStep));
      setApplication(res.data.data);
      return true;
    } catch (err) {
      const message = friendlyError(err, 'Could not save.');
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const goNext = async () => {
    const target = Math.min(5, step + 1);
    if (!(await save(target))) return;
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveNow = async () => {
    if (await save(step)) toast.success('Saved.');
  };

  /**
   * Pin the property from the councillor's own handset.
   *
   * They are standing at the gate, so the device fix is the property. This is
   * the single most valuable thing a field capture adds over a form filled in at
   * home: an informal settlement dwelling with no street address still gets a
   * location a reviewer can find.
   */
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('This device cannot provide a location.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setForm((f) => ({
          ...f,
          addressLatitude: String(coords.latitude),
          addressLongitude: String(coords.longitude),
          addressAccuracyM: coords.accuracy ? String(Math.round(coords.accuracy)) : '',
          addressSource: 'DEVICE',
        }));
        // Fill the address text too, but never overwrite one already captured.
        try {
          const res = await api.get('/geocode/reverse', { params: { lat: coords.latitude, lon: coords.longitude } });
          const formatted = res.data.data?.formatted;
          if (formatted) {
            setForm((f) => ({ ...f, addressFormatted: formatted, residentialAddress: f.residentialAddress || formatted }));
          }
        } catch { /* a pin without a street name is still a pin */ }
        setLocating(false);
        toast.success('Location pinned from this device.');
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was refused. Type the address instead.'
            : 'Could not get a location. Type the address instead.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const uploadDocument = async (slot, file) => {
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    body.append('documentId', slot.id);
    try {
      const res = await sendFile(slot.id, `/documents/${id}/upload`, body, {
        fileName: file.name, size: file.size,
      });
      // Cancelling is a choice, not a failure — nothing is said about it.
      if (res?.cancelled) return;
      toast.success(`${slot.name} captured.`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || `Could not upload ${slot.name}.`);
    }
  };

  const submit = async () => {
    setConfirmSubmit(false);
    if (!(await save(5))) return;
    setSaving(true);
    try {
      const res = await api.post(`/fieldwork/applications/${id}/submit`);
      toast.success(res.data.message);
      navigate('/captures');
    } catch (err) {
      const data = err.response?.data;
      setSubmitProblems({ message: data?.message || 'Could not submit.', missing: data?.missing || [] });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLayout title="Capture"><div className="loading"><span className="spinner" /> Loading…</div></AdminLayout>;

  if (!application) {
    return (
      <AdminLayout title="Capture">
        <div className="alert alert-error">{error || 'Application not found.'}</div>
      </AdminLayout>
    );
  }

  const name = [application.fullName || application.names, application.surname].filter(Boolean).join(' ') || 'this household';
  const required = documents.filter((d) => d.importance === 'REQUIRED' && !d.requirementGroup);
  const grouped = documents.filter((d) => d.requirementGroup);
  const optional = documents.filter((d) => d.importance === 'OPTIONAL' && !d.requirementGroup);
  const groupSatisfied = grouped.some((d) => d.status === 'Uploaded');

  const slotRow = (slot, { note } = {}) => (
    /* While this slot is uploading it becomes the progress row. A councillor at
       a door on a weak signal needs to see bytes moving, not a button that
       looks unpressed — that is where a second tap becomes a duplicate. */
    (progress?.key === slot.id || justUploaded === slot.id) ? (
      <li key={slot.id} className="doc-slot">
        <UploadProgress
          fileName={progress?.fileName || slot.fileName || slot.name}
          fraction={justUploaded === slot.id ? 1 : progress?.fraction}
          loaded={progress?.loaded}
          total={progress?.total}
          onCancel={justUploaded === slot.id ? null : cancel}
          done={justUploaded === slot.id}
        />
      </li>
    ) : (
    <li key={slot.id} className={`doc-slot${slot.status === 'Uploaded' ? ' done' : ''}`}>
      <div className="doc-slot-main">
        <Icon name={slot.status === 'Uploaded' ? 'check' : 'file'} size={16} />
        <div>
          <strong>{slot.name}</strong>
          {note ? <small>{note}</small> : null}
          {slot.status === 'Rejected' ? <small className="field-error">Rejected on review — capture it again.</small> : null}
        </div>
      </div>
      <div>
        <input
          type="file"
          hidden
          ref={(el) => { fileInputs.current[slot.id] = el; }}
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={(e) => { uploadDocument(slot, e.target.files?.[0]); e.target.value = ''; }}
        />
        <button type="button" className="btn btn-sm" onClick={() => fileInputs.current[slot.id]?.click()}>
          <Icon name="upload" size={14} /> {slot.status === 'Uploaded' ? 'Replace' : 'Photograph'}
        </button>
      </div>
    </li>
    )
  );

  return (
    <AdminLayout
      title={`Capturing for ${name}`}
      description="Complete this with the resident present. Each step is saved as you move to the next."
      breadcrumb={<span>Fieldwork / Capture</span>}
      actions={
        <button type="button" className="btn btn-primary" onClick={saveNow} disabled={saving}>
          <Icon name="check" size={16} /> {saving ? 'Saving…' : 'Save'}
        </button>
      }
    >
      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}

      <ol className="capture-steps" aria-label="Progress">
        {STEPS.map((s) => (
          <li
            key={s.num}
            className={`capture-step${step === s.num ? ' current' : ''}${step > s.num ? ' done' : ''}`}
            onClick={() => { if (s.num < step) setStep(s.num); }}
            style={s.num < step ? { cursor: 'pointer' } : undefined}
          >
            <span className="capture-step-num">{s.num}</span>
            <span>{s.label}</span>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <>
          <section className="panel">
            <div className="panel-header"><h2>Applicant particulars</h2></div>
            <div className="form-grid">
              <label className="form-group">
                <span>Title <em className="optional">optional</em></span>
                <input value={form.title} onChange={set('title')} placeholder="Mr, Mrs, Dr…" maxLength={20} />
              </label>
              {/* Every given name, in one field. "First names" was filled in
                  inconsistently, and a household captured at a door is the one most
                  likely to end up with a letter addressed to the wrong name. */}
              <label className="form-group">
                <span>Full name</span>
                <input value={form.fullName} onChange={set('fullName')} placeholder="All given names, as on the ID" />
                {initialsOf(form.fullName) ? <small>Initials: {initialsOf(form.fullName)}</small> : null}
              </label>
              <label className="form-group"><span>Surname</span><input value={form.surname} onChange={set('surname')} /></label>
              <label className="form-group">
                <span>ID number</span>
                <input value={form.idNumber} onChange={set('idNumber')} inputMode="numeric" maxLength={13} />
                {/* Read back so a mistyped digit is caught at the door, not later. */}
                <DerivedIdentity idNumber={form.idNumber} />
              </label>
              <label className="form-group"><span>Cell number</span><input value={form.cellNumber} onChange={set('cellNumber')} inputMode="tel" /></label>
              <label className="form-group">
                <span>Marital status</span>
                <select value={form.maritalStatus} onChange={set('maritalStatus')}>
                  <option value="">Not stated</option>
                  {['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED'].map((v) => (
                    <option key={v} value={v}>{v.charAt(0) + v.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </label>
              {/* Employment is not asked. It is derived from the income answers:
                  a salary means employed, a business means self-employed. Asking it
                  here as well would give the form two places to disagree. */}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Where they live</h2>
              <p className="muted">
                You are at the property. Pinning it from this device is worth more than any address — many of these
                dwellings have no street number at all.
              </p>
            </div>
            <div className="form-grid">
              <label className="form-group span-2">
                <span>Residential address</span>
                <textarea rows={2} value={form.residentialAddress} onChange={set('residentialAddress')} />
              </label>

              <div className="span-2">
                <button type="button" className="btn btn-secondary btn-lg" onClick={useMyLocation} disabled={locating}>
                  <Icon name="mapPin" size={16} /> {locating ? 'Getting location…' : 'Pin this property from my phone'}
                </button>
              </div>

              {form.addressLatitude && form.addressLongitude ? (
                <div className="pin-card span-2">
                  <div>
                    <strong>Location pinned</strong>
                    <p className="field-hint">
                      {Number(form.addressLatitude).toFixed(5)}, {Number(form.addressLongitude).toFixed(5)}
                      {form.addressAccuracyM ? ` · accurate to about ${form.addressAccuracyM} m` : ''}
                    </p>
                    {form.addressAccuracyM && Number(form.addressAccuracyM) > 500 ? (
                      <p className="field-hint is-warn">
                        Low accuracy — this looks like a network fix rather than GPS. Try again outdoors.
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setForm((f) => ({ ...f, addressLatitude: '', addressLongitude: '', addressAccuracyM: '', addressSource: '' }))}
                  >
                    Remove
                  </button>
                </div>
              ) : null}

              <label className="form-group span-2">
                <span>Postal address <em className="optional">optional, if different</em></span>
                <textarea rows={2} value={form.postalAddress} onChange={set('postalAddress')} placeholder="Leave blank if the same as the residential address" />
              </label>
            </div>
          </section>

          <div className="form-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={goNext} disabled={saving}>
              {saving ? 'Saving…' : 'Next'}
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <section className="panel">
            <div className="panel-header"><h2>The property</h2></div>
            <div className="form-grid">
              <label className="form-group">
                <span>Own or rent?</span>
                <select value={form.tenure} onChange={set('tenure')}>
                  <option value="">Please choose</option>
                  <option value="OWNER">Owns it</option>
                  <option value="TENANT">Rents it</option>
                  <option value="OCCUPIER">Lives here but neither owns nor rents (e.g. family land)</option>
                </select>
                <small>Decides which proof of the property gets asked for below.</small>
              </label>
              <label className="form-group">
                <span>Does anything below describe this household?</span>
                <select value={form.applicantCategory} onChange={set('applicantCategory')}>
                  <option value="STANDARD">None of these</option>
                  <option value="PENSIONER">Pensioner</option>
                  <option value="DISABLED">Has a disability</option>
                  <option value="DECEASED_ESTATE">Owner has died, dealing with the estate</option>
                  <option value="CHILD_HEADED">Headed by a young person under 21</option>
                </select>
              </label>
              <label className="form-group"><span>Municipal account number</span><input value={form.municipalAccountNumber} onChange={set('municipalAccountNumber')} /></label>
              <label className="form-group"><span>Eskom account number <em className="optional">optional</em></span><input value={form.eskomAccountNumber} onChange={set('eskomAccountNumber')} /></label>
              <label className="form-group"><span>Ward number <em className="optional">optional</em></span><input value={form.wardNumber} onChange={set('wardNumber')} placeholder="e.g. Ward 12" /></label>
              <label className="form-group"><span>Water meter number</span><input value={form.waterMeterNumber} onChange={set('waterMeterNumber')} /></label>
              <label className="form-group"><span>Electricity meter number</span><input value={form.electricityMeterNumber} onChange={set('electricityMeterNumber')} /></label>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header"><h2>Who lives here</h2></div>
            <div className="form-grid">
              <label className="form-group"><span>People on the property</span><input type="number" min="0" value={form.peopleOnProperty} onChange={set('peopleOnProperty')} /></label>
              <label className="form-group"><span>Children under 18</span><input type="number" min="0" value={form.childrenUnder18} onChange={set('childrenUnder18')} /></label>
              <label className="form-group"><span>Adults</span><input type="number" min="0" value={form.adults} onChange={set('adults')} /></label>
              <label className="form-group"><span>Pensioners over 60</span><input type="number" min="0" value={form.pensionersOver60} onChange={set('pensionersOver60')} /></label>
            </div>

            {/*
              Room to list the people the headcount claims.

              This form had a "people on the property" box and nowhere to name them,
              so a councillor could declare five and record one. Submission refuses a
              roll that does not match the count — income per person is half the means
              test and is computed from the typed number.
            */}
            <HouseholdEditor
              applicationId={application.id}
              declaredPeople={form.peopleOnProperty}
              onChange={(updated) => { if (updated) setApplication((a) => ({ ...a, ...updated })); }}
            />
          </section>

          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={goBack}>Back</button>
            <button type="button" className="btn btn-primary btn-lg" onClick={goNext} disabled={saving}>
              {saving ? 'Saving…' : 'Next'}
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          {/*
            Income, asked the way the resident's own form asks it.

            Five fixed amount boxes could hold five kinds of income and no more, and
            a councillor standing at a door meets households with two grants and a
            lodger routinely. The same component renders here as on the resident's
            wizard, from the same server-side question definitions, so the two forms
            cannot drift.
          */}
          <section className="panel">
            <div className="panel-body">
              <IncomeSources
                applicationId={application.id}
                people={form.peopleOnProperty}
                onChange={(updated) => { if (updated) setApplication((a) => ({ ...a, ...updated })); }}
              />
            </div>
          </section>

          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={goBack}>Back</button>
            <button type="button" className="btn btn-primary btn-lg" onClick={goNext} disabled={saving}>
              {saving ? 'Saving…' : 'Next'}
            </button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <section className="panel">
            <div className="panel-header"><h2>General</h2></div>
            <div className="form-grid">
              <YesNo label="Do they own immovable property?" value={form.ownsImmovableProperty} onChange={set('ownsImmovableProperty')} />
              <YesNo label="Do they live here full time?" value={form.isFullTimeOccupant} onChange={set('isFullTimeOccupant')} />
              <YesNo label="Is the household income below the threshold?" value={form.incomeBelowThreshold} onChange={set('incomeBelowThreshold')} />
              <YesNo label="Are there municipal arrears?" value={form.hasMunicipalArrears} onChange={set('hasMunicipalArrears')} />
              <YesNo label="Is there an arrangement for the arrears?" value={form.hasArrearsArrangement} onChange={set('hasArrearsArrangement')} />
              <YesNo label="Do they own any other property anywhere in South Africa?" value={form.ownsOtherProperty} onChange={set('ownsOtherProperty')} />
            </div>

            {form.ownsOtherProperty === 'Yes' ? (
              <label className="form-group">
                <span>Where is it, and what is it?</span>
                <textarea
                  rows={2}
                  value={form.otherPropertyDetails}
                  onChange={set('otherPropertyDetails')}
                  placeholder="e.g. An empty inherited plot in Lusikisiki, Eastern Cape"
                />
              </label>
            ) : null}

            <label className="form-group">
              <span>Money coming in they think should not count <em className="optional">optional</em></span>
              <textarea
                rows={2}
                value={form.incomeExclusions}
                onChange={set('incomeExclusions')}
                placeholder="e.g. Child support grant for two children, NSFAS allowance, money a relative sends some months"
              />
            </label>
          </section>

          <section className="panel">
            <div className="panel-header"><h2>How they manage day to day</h2></div>
            <FunctioningQuestions form={form} update={(field, value) => setForm((f) => ({ ...f, [field]: value }))} />
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Consent and declaration</h2>
              <p className="muted">Read each of these to the resident. Their application cannot be reviewed without them.</p>
            </div>

            {[
              {
                key: 'consentSiteVisit',
                label: 'They agree that a municipal officer may visit and inspect the property.',
                hint: 'The municipality will try three times and send an SMS each time they cannot be reached.',
              },
              {
                key: 'consentDataMatching',
                label: 'They agree that the municipality may check their details with SARS, UIF, SASSA and credit bureaux.',
                hint: 'Used only to confirm what has been declared, and only for this application.',
              },
              {
                key: 'declarationTruthful',
                label: 'They declare that everything in this application is true and complete.',
                hint: 'They will sign this under oath on their affidavit. Giving false information is an offence.',
              },
            ].map((c) => (
              <div className="form-group consent-check" key={c.key}>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(form[c.key])}
                    onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.checked }))}
                  />
                  <span>{c.label}</span>
                </label>
                <p className="field-hint">{c.hint}</p>
              </div>
            ))}
          </section>

          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={goBack}>Back</button>
            <button type="button" className="btn btn-primary btn-lg" onClick={goNext} disabled={saving}>
              {saving ? 'Saving…' : 'Next'}
            </button>
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <section className="panel">
            <div className="panel-header">
              <h2>Documents</h2>
              <p className="muted">Photograph each one with the resident&rsquo;s permission.</p>
            </div>

            <ul className="doc-slots">{required.map((slot) => slotRow(slot))}</ul>

            <div className={`doc-group${groupSatisfied ? ' satisfied' : ''}`}>
              <div className="doc-group-head">
                <Icon name={groupSatisfied ? 'check' : 'info'} size={16} />
                <div>
                  <strong>Proof of income or proof of grant</strong>
                  <p className="field-hint">
                    Whichever one applies. A payslip, an employer&rsquo;s letter, or a SASSA grant letter — any one is
                    enough. Not both.
                  </p>
                </div>
              </div>
              <ul className="doc-slots">{grouped.map((slot) => slotRow(slot))}</ul>
            </div>

            <details className="doc-optional">
              <summary>Other documents, only if they apply ({optional.length})</summary>
              <ul className="doc-slots">{optional.map((slot) => slotRow(slot))}</ul>
            </details>
          </section>

          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={goBack}>Back</button>
          </div>

          <div className="capture-submit">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setConfirmSubmit(true)} disabled={saving}>
              <Icon name="check" size={18} /> Submit this application
            </button>
            <p className="field-hint">
              The resident receives an SMS with their reference number as soon as you submit.
            </p>
          </div>
        </>
      )}

      <ConfirmModal
        open={confirmSubmit}
        title="Submit this application?"
        description={`${name}'s application goes to the review queue and can no longer be changed in the field. They will be sent their reference number by SMS.`}
        confirmLabel="Submit"
        cancelLabel="Keep capturing"
        onCancel={() => setConfirmSubmit(false)}
        onConfirm={submit}
      />

      <Modal open={Boolean(submitProblems)} title="Not ready to submit" onClose={() => setSubmitProblems(null)} size="sm">
        <p>{submitProblems?.message}</p>
        {submitProblems?.missing?.length ? (
          <ul className="missing-list">
            {submitProblems.missing.map((m) => <li key={m}><Icon name="alert" size={14} /> {m}</li>)}
          </ul>
        ) : null}
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={() => setSubmitProblems(null)}>
            Go back and finish
          </button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
