import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import Icon from '../../components/ui/Icon';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import api from '../../services/api';
import { friendlyError } from '../../utils/apiError';

/**
 * Capturing a resident's application on their behalf.
 *
 * Uses exactly the same endpoints and the same validation as the resident's own
 * wizard — a field capture is not held to a lower standard, and the reviewer
 * must be able to trust both equally.
 *
 * Two differences from the resident-facing form, both deliberate:
 *
 *  - Everything is on one page. The resident's wizard is paced across four steps
 *    because they are working alone and may come back tomorrow. A councillor is
 *    standing at a gate and needs to see what is left, not discover it.
 *  - Saving is explicit and per section, so a lost signal costs one section
 *    rather than a whole household's answers.
 */

const empty = {
  surname: '', names: '', idNumber: '', cellNumber: '', maritalStatus: '',
  residentialAddress: '', postalAddress: '', employmentStatus: '',
  employerName: '', workTelNumber: '',
  peopleOnProperty: '', childrenUnder18: '', adults: '', pensionersOver60: '',
  waterMeterNumber: '', electricityMeterNumber: '',
  salary: '', oldAgePension: '', disabilityPension: '', businessIncome: '', rentingIncome: '',
  ownsImmovableProperty: '', isFullTimeOccupant: '', incomeBelowThreshold: '',
  hasMunicipalArrears: '', hasArrearsArrangement: '',
  addressLatitude: '', addressLongitude: '', addressFormatted: '', addressSource: '', addressAccuracyM: '',
};

const STRINGS = [
  'surname', 'names', 'idNumber', 'cellNumber', 'maritalStatus', 'residentialAddress',
  'postalAddress', 'employmentStatus', 'employerName', 'workTelNumber',
  'waterMeterNumber', 'electricityMeterNumber',
];
const INTS = ['peopleOnProperty', 'childrenUnder18', 'adults', 'pensionersOver60'];
const MONEY = ['salary', 'oldAgePension', 'disabilityPension', 'businessIncome', 'rentingIncome'];
const BOOLS = ['ownsImmovableProperty', 'isFullTimeOccupant', 'incomeBelowThreshold', 'hasMunicipalArrears', 'hasArrearsArrangement'];

const num = (v) => (v === '' || v === null || v === undefined ? undefined : (Number.isFinite(Number(v)) ? Number(v) : undefined));
const bool = (v) => (v === 'Yes' ? true : v === 'No' ? false : undefined);

function buildPayload(form) {
  const payload = {};
  STRINGS.forEach((k) => { if (form[k] !== '' && form[k] != null) payload[k] = form[k]; });
  INTS.forEach((k) => { const n = num(form[k]); if (n !== undefined) payload[k] = Math.floor(n); });
  MONEY.forEach((k) => { const n = num(form[k]); if (n !== undefined) payload[k] = n; });
  BOOLS.forEach((k) => { const b = bool(form[k]); if (b !== undefined) payload[k] = b; });

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
      setForm((f) => {
        const next = { ...f };
        Object.keys(empty).forEach((k) => {
          const value = app[k];
          if (value === null || value === undefined) return;
          next[k] = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
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

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.patch(`/applications/${id}`, buildPayload(form));
      setApplication(res.data.data);
      toast.success('Saved.');
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
      await api.post(`/documents/${id}/upload`, body);
      toast.success(`${slot.name} captured.`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || `Could not upload ${slot.name}.`);
    }
  };

  const submit = async () => {
    setConfirmSubmit(false);
    if (!(await save())) return;
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

  const name = [application.names, application.surname].filter(Boolean).join(' ') || 'this household';
  const required = documents.filter((d) => d.importance === 'REQUIRED' && !d.requirementGroup);
  const grouped = documents.filter((d) => d.requirementGroup);
  const optional = documents.filter((d) => d.importance === 'OPTIONAL' && !d.requirementGroup);
  const groupSatisfied = grouped.some((d) => d.status === 'Uploaded');

  const slotRow = (slot, { note } = {}) => (
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
  );

  return (
    <AdminLayout
      title={`Capturing for ${name}`}
      description="Complete this with the resident present. Save each section as you go."
      breadcrumb={<span>Fieldwork / Capture</span>}
      actions={
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          <Icon name="check" size={16} /> {saving ? 'Saving…' : 'Save'}
        </button>
      }
    >
      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}

      <section className="panel">
        <div className="panel-header"><h2>Applicant particulars</h2></div>
        <div className="form-grid">
          <label className="form-group"><span>First names</span><input value={form.names} onChange={set('names')} /></label>
          <label className="form-group"><span>Surname</span><input value={form.surname} onChange={set('surname')} /></label>
          <label className="form-group"><span>ID number</span><input value={form.idNumber} onChange={set('idNumber')} inputMode="numeric" maxLength={13} /></label>
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
          <label className="form-group">
            <span>Employment status</span>
            <select value={form.employmentStatus} onChange={set('employmentStatus')}>
              <option value="">Not stated</option>
              {['EMPLOYED', 'UNEMPLOYED', 'SELF_EMPLOYED', 'PENSIONER', 'OTHER'].map((v) => (
                <option key={v} value={v}>{v.charAt(0) + v.slice(1).toLowerCase().replace('_', ' ')}</option>
              ))}
            </select>
          </label>
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
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h2>The property and who lives there</h2></div>
        <div className="form-grid">
          <label className="form-group"><span>People on the property</span><input type="number" min="0" value={form.peopleOnProperty} onChange={set('peopleOnProperty')} /></label>
          <label className="form-group"><span>Children under 18</span><input type="number" min="0" value={form.childrenUnder18} onChange={set('childrenUnder18')} /></label>
          <label className="form-group"><span>Adults</span><input type="number" min="0" value={form.adults} onChange={set('adults')} /></label>
          <label className="form-group"><span>Pensioners over 60</span><input type="number" min="0" value={form.pensionersOver60} onChange={set('pensionersOver60')} /></label>
          <label className="form-group"><span>Water meter number</span><input value={form.waterMeterNumber} onChange={set('waterMeterNumber')} /></label>
          <label className="form-group"><span>Electricity meter number</span><input value={form.electricityMeterNumber} onChange={set('electricityMeterNumber')} /></label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Household income</h2>
          <p className="muted">Monthly rands. Leave blank where there is none — a blank is not the same as zero.</p>
        </div>
        <div className="form-grid">
          <label className="form-group"><span>Salary or wages</span><input type="number" min="0" step="0.01" value={form.salary} onChange={set('salary')} /></label>
          <label className="form-group"><span>Old age pension</span><input type="number" min="0" step="0.01" value={form.oldAgePension} onChange={set('oldAgePension')} /></label>
          <label className="form-group"><span>Disability pension</span><input type="number" min="0" step="0.01" value={form.disabilityPension} onChange={set('disabilityPension')} /></label>
          <label className="form-group"><span>Business income</span><input type="number" min="0" step="0.01" value={form.businessIncome} onChange={set('businessIncome')} /></label>
          <label className="form-group"><span>Rental income</span><input type="number" min="0" step="0.01" value={form.rentingIncome} onChange={set('rentingIncome')} /></label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h2>General</h2></div>
        <div className="form-grid">
          <YesNo label="Do they own immovable property?" value={form.ownsImmovableProperty} onChange={set('ownsImmovableProperty')} />
          <YesNo label="Do they live here full time?" value={form.isFullTimeOccupant} onChange={set('isFullTimeOccupant')} />
          <YesNo label="Is the household income below the threshold?" value={form.incomeBelowThreshold} onChange={set('incomeBelowThreshold')} />
          <YesNo label="Are there municipal arrears?" value={form.hasMunicipalArrears} onChange={set('hasMunicipalArrears')} />
          <YesNo label="Is there an arrangement for the arrears?" value={form.hasArrearsArrangement} onChange={set('hasArrearsArrangement')} />
        </div>
      </section>

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

      <div className="capture-submit">
        <button type="button" className="btn btn-primary btn-lg" onClick={() => setConfirmSubmit(true)} disabled={saving}>
          <Icon name="check" size={18} /> Submit this application
        </button>
        <p className="field-hint">
          The resident receives an SMS with their reference number as soon as you submit.
        </p>
      </div>

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
