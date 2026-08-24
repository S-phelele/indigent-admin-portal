import { useEffect, useState } from 'react';
import api from '../services/api';
import Icon from './ui/Icon';

/**
 * Narrow a report to the question actually being asked.
 *
 * Reports covered the whole register, always — every ward, since the beginning.
 * That answers almost nothing a municipality needs: "how many disabled
 * households in ward 12 were approved this quarter" is the shape of a real
 * request, and it previously meant exporting everything and pivoting it by hand.
 *
 * The options come from `GET /export/report-options`, not from this file. They
 * are derived from the enums and from the wards that actually appear in the
 * register, so a re-demarcation or a new income type does not leave a stale
 * list here — the mistake the staff-role dropdown made.
 */

const EMPTY = {
  ward: '', status: '', stage: '', disability: '', category: '', tenure: '', employmentStatus: '',
  householdSize: '', incomeType: '', channel: '', renewalStatus: '',
  dateField: 'submitted', from: '', to: '',
};

/** Only the filters that are set, so the URL stays readable and bookmarkable. */
export function toQuery(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value && !(key === 'dateField' && value === 'submitted')) params.set(key, value);
  });
  return params.toString();
}

export default function ReportFilters({ value, onChange, onApply }) {
  const [options, setOptions] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.get('/export/report-options')
      .then((res) => setOptions(res.data.data))
      .catch(() => setOptions(null));
  }, []);

  if (!options) return null;

  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });

  const active = Object.entries(value).filter(
    ([key, v]) => v && !(key === 'dateField' && v === 'submitted')
  ).length;

  const Select = ({ label, field, items, allLabel }) => (
    <label className="form-group">
      <span>{label}</span>
      <select value={value[field]} onChange={set(field)}>
        <option value="">{allLabel}</option>
        {items.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );

  return (
    <div className="report-filters">
      <div className="report-filters-head">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen((v) => !v)}>
          <Icon name="filter" size={15} />
          {active > 0 ? `Filters (${active})` : 'Filter this report'}
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} />
        </button>

        {active > 0 ? (
          <button type="button" className="btn-link" onClick={() => { onChange(EMPTY); onApply(EMPTY); }}>
            Clear all
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="report-filters-body">
          <div className="form-grid">
            <label className="form-group">
              <span>Ward</span>
              <select value={value.ward} onChange={set('ward')}>
                <option value="">All wards</option>
                {options.wards.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </label>

            <Select label="Status" field="status" items={options.statuses} allLabel="Any status" />
            <Select label="Approval stage" field="stage" items={options.stages} allLabel="Any stage" />

            {/*
              Three states, not two. "Not asked" is a real answer and must never
              be counted as "no disability" — that distinction is the whole
              reason the column is nullable.
            */}
            <Select label="Disability" field="disability" items={options.disability} allLabel="Any" />

            <Select label="Category" field="category" items={options.categories} allLabel="Any category" />
            <Select label="Tenure" field="tenure" items={options.tenures} allLabel="Any tenure" />
            <Select label="Employment" field="employmentStatus" items={options.employmentStatuses} allLabel="Any employment status" />
            <Select label="Household size" field="householdSize" items={options.householdSizes} allLabel="Any size" />

            {/*
              "Declared no income at all" sits alongside the source types
              because it is a group in its own right, not the absence of one.
            */}
            <Select label="Income" field="incomeType" items={options.incomeTypes} allLabel="Any income" />

            <Select label="Captured through" field="channel" items={options.channels} allLabel="Any channel" />
            <Select label="Renewal" field="renewalStatus" items={options.renewalStatuses} allLabel="Any" />

            {/* Submitted and decided are different questions with different
                answers, so the report says which one it used. */}
            <label className="form-group">
              <span>Date range on</span>
              <select value={value.dateField} onChange={set('dateField')}>
                {options.dateFields.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>

            <label className="form-group">
              <span>From</span>
              <input type="date" value={value.from} onChange={set('from')} />
            </label>

            <label className="form-group">
              <span>To</span>
              <input type="date" value={value.to} onChange={set('to')} />
            </label>
          </div>

          <div className="report-filters-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onApply(value)}>
              Apply to this report
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { EMPTY as EMPTY_FILTERS };
