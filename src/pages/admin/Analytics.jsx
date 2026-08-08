import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import Icon from '../../components/ui/Icon';
import LoadError, { loadErrorMessage } from '../../components/LoadError';
import { LineChart, BarList, Donut, Funnel, Gauge } from '../../components/ui/Chart';
import api from '../../services/api';

/**
 * Analytics for whoever has to account for this register.
 *
 * The organising idea is that a count is not an insight. "412 applications" is a
 * number; "half your pending queue is past the service standard, concentrated in
 * two wards, and the affidavit is what holds everyone up" is something a manager
 * can act on this week. Each section below was chosen to answer a question
 * somebody actually asks:
 *
 *   Are we meeting our promise?      → service level, turnaround, queue ageing
 *   Who are we reaching?             → demographics, households, income
 *   Where is the need?               → wards and suburbs
 *   Is the assisted capture working? → channel comparison, councillor activity
 *   Where do people fall out?        → funnel, document bottlenecks
 */

const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '12 months' },
];

const COLOURS = {
  registrations: '#6366f1',
  applications: '#0ea5e9',
  approved: '#16a34a',
  declined: '#dc2626',
  neutral: '#64748b',
};

const AGE_COLOURS = ['#0ea5e9', '#6366f1', '#8b5cf6', '#f59e0b', '#16a34a'];

const zar = (n) => (n === null || n === undefined
  ? '—'
  : `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);

const days = (n) => (n === null || n === undefined ? '—' : `${n} day${n === 1 ? '' : 's'}`);

/** A headline figure with its own explanation, because a number alone invites a wrong reading. */
const Metric = ({ label, value, caption, tone, icon }) => (
  <div className={`metric${tone ? ` tone-${tone}` : ''}`}>
    {icon ? <span className="metric-icon"><Icon name={icon} size={18} /></span> : null}
    <div>
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
      {caption ? <span className="metric-caption">{caption}</span> : null}
    </div>
  </div>
);

const Panel = ({ title, hint, children, wide }) => (
  <section className={`panel${wide ? ' wide' : ''}`}>
    <div className="panel-header">
      <h2>{title}</h2>
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
    {children}
  </section>
);

export default function Analytics() {
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get('/admin/analytics/full', { params: { days: period } })
      .then((res) => setData(res.data.data))
      .catch((err) => setError(loadErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading && !data) {
    return (
      <AdminLayout title="Analytics">
        <div className="loading"><span className="spinner" /> Building the picture…</div>
      </AdminLayout>
    );
  }

  if (error && !data) {
    return <AdminLayout title="Analytics"><LoadError message={error} /></AdminLayout>;
  }

  const { headline, turnaround, queue, demographics, households, income, channels, geography, funnel, councillors, documents } = data;

  const genderSlices = demographics.gender
    .filter((g) => g.count > 0)
    .map((g, i) => ({ ...g, colour: [COLOURS.registrations, COLOURS.applications, COLOURS.neutral][i] }));

  const ageSlices = demographics.ageBands.map((b, i) => ({ ...b, colour: AGE_COLOURS[i % AGE_COLOURS.length] }));

  const activeCouncillors = councillors.filter((c) => c.captured > 0);

  return (
    <AdminLayout
      title="Analytics"
      description="How the register is performing, who it is reaching, and where the need sits."
      actions={
        <div className="segmented" role="group" aria-label="Reporting period">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              className={period === p.days ? 'active' : ''}
              onClick={() => setPeriod(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
      }
    >
      <LoadError message={error} />

      {/* ---------------------------------------------------------------- */}
      <div className="metric-row">
        <Metric
          icon="users"
          label="Households on the register"
          value={headline.householdsSupported}
          caption={`${headline.peopleSupported} people in approved households`}
          tone="good"
        />
        <Metric
          icon="applications"
          label="Applications in total"
          value={headline.totalApplications}
          caption={`${headline.draft} not yet submitted`}
        />
        <Metric
          icon="clock"
          label="Waiting for a decision"
          value={headline.pending}
          caption={queue.overdue > 0 ? `${queue.overdue} past the ${data.slaDays}-day standard` : 'All within the standard'}
          tone={queue.overdue > 0 ? 'warn' : 'good'}
        />
        <Metric
          icon="check"
          label="Approval rate"
          value={headline.approvalRate === null ? '—' : `${headline.approvalRate}%`}
          caption={`${headline.approved} approved, ${headline.declined} declined`}
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      <div className="panel-grid">
        <Panel
          title="Activity over time"
          hint={`Registrations, new applications and decisions across the last ${period} days.`}
          wide
        >
          <LineChart
            data={data.series}
            series={[
              { key: 'registrations', label: 'Registrations', colour: COLOURS.registrations },
              { key: 'applications', label: 'Applications started', colour: COLOURS.applications },
              { key: 'approved', label: 'Approved', colour: COLOURS.approved },
              { key: 'declined', label: 'Declined', colour: COLOURS.declined },
            ]}
          />
        </Panel>

        <Panel
          title="Are we keeping our promise?"
          hint={`The municipality undertakes to decide within ${data.slaDays} days.`}
        >
          <Gauge
            value={turnaround.withinSlaPercent}
            target={90}
            label="Decided within the standard"
            caption={
              turnaround.decided
                ? `${turnaround.withinSla} of ${turnaround.decided} decisions met it; ${turnaround.breached} did not.`
                : undefined
            }
          />
        </Panel>

        <Panel
          title="How long a decision takes"
          hint="The median is the honest figure — one application stuck for months would drag an average anywhere."
        >
          <div className="stat-pairs">
            <div><dt>Median</dt><dd>{days(turnaround.medianDays)}</dd></div>
            <div><dt>Average</dt><dd>{days(turnaround.averageDays)}</dd></div>
            <div>
              <dt>Slowest 10%</dt>
              <dd>{days(turnaround.p90Days)}</dd>
            </div>
            <div><dt>Fastest</dt><dd>{days(turnaround.fastestDays)}</dd></div>
          </div>
          {turnaround.p90Days && turnaround.medianDays && turnaround.p90Days > turnaround.medianDays * 3 ? (
            <p className="insight is-warn">
              <Icon name="alert" size={14} />
              A typical application is decided in {days(turnaround.medianDays)}, but the slowest tenth waits{' '}
              {days(turnaround.p90Days)}. A specific group is being badly failed rather than the service being slow.
            </p>
          ) : null}
        </Panel>

        <Panel title="How long the queue has been waiting" hint="Applications submitted and not yet decided.">
          <BarList
            items={queue.buckets}
            emptyLabel="Nothing is waiting — the queue is clear."
            tone="warn"
          />
          {queue.oldestDays > data.slaDays ? (
            <p className="insight is-warn">
              <Icon name="clock" size={14} />
              The oldest application has been waiting {days(queue.oldestDays)}.
            </p>
          ) : null}
        </Panel>

        {/* -------------------------------------------------------------- */}
        <Panel
          title="How applications reach us"
          hint="Assisted capture exists for residents who cannot complete the form themselves. This is whether it is working."
          wide
        >
          <div className="channel-grid">
            {channels.map((c) => (
              <div key={c.key} className="channel-card">
                <h3>{c.label}</h3>
                <div className="channel-total">{c.total}</div>
                <dl className="mini-facts">
                  <div><dt>Submitted</dt><dd>{c.total - c.draft}</dd></div>
                  <div><dt>Approved</dt><dd>{c.approved}</dd></div>
                  <div><dt>Approval rate</dt><dd>{c.approvalRate === null ? '—' : `${c.approvalRate}%`}</dd></div>
                </dl>
              </div>
            ))}
          </div>
          {channels.length > 1 && channels.every((c) => c.approvalRate !== null) ? (
            <p className="insight">
              <Icon name="info" size={14} />
              A large gap between these approval rates is worth understanding: it is either a training issue or evidence
              that assisted capture is reaching households that would never have applied.
            </p>
          ) : null}
        </Panel>

        {/* -------------------------------------------------------------- */}
        <Panel title="Who is applying" hint="Age and gender are derived from the ID number, never asked twice.">
          <Donut items={ageSlices} centreLabel="applicants" />
          <p className="field-hint">
            Median age {demographics.medianAge ?? '—'}
            {demographics.unknownAge ? ` · ${demographics.unknownAge} without a usable ID number` : ''}
          </p>
        </Panel>

        <Panel title="Gender split">
          <Donut items={genderSlices} centreLabel="applicants" />
        </Panel>

        <Panel title="Household size" hint="Relief is assessed per person, so size is what turns income into eligibility.">
          <BarList items={households.bands} />
          <div className="stat-pairs">
            <div><dt>Median size</dt><dd>{households.medianSize ?? '—'}</dd></div>
            <div><dt>With children</dt><dd>{households.withChildren}</dd></div>
            <div><dt>With pensioners</dt><dd>{households.withPensioners}</dd></div>
          </div>
        </Panel>

        <Panel
          title="Declared household income"
          hint={`Against the qualifying threshold of ${zar(income.threshold)} a month.`}
        >
          <BarList items={income.bands} />
          <div className="stat-pairs">
            <div><dt>Median</dt><dd>{zar(income.medianIncome)}</dd></div>
            <div><dt>Above the threshold</dt><dd>{income.aboveThreshold} ({income.aboveThresholdPercent}%)</dd></div>
          </div>
          {income.aboveThreshold > 0 ? (
            <p className="insight">
              <Icon name="info" size={14} />
              Declaring more than the threshold is not automatically a disqualification — a large household is assessed
              per person — but these are the applications a reviewer should look at closely.
            </p>
          ) : null}
        </Panel>

        {/* -------------------------------------------------------------- */}
        <Panel title="Where the need is" hint="Ward comes from the capturing councillor; suburb from verified addresses.">
          <h3 className="panel-sub">By ward</h3>
          <BarList items={geography.wards} labelKey="name" emptyLabel="No ward-captured applications yet." />
          <h3 className="panel-sub">By suburb</h3>
          <BarList items={geography.suburbs} labelKey="name" emptyLabel="No addresses have been verified yet." />
          <p className="field-hint">
            {geography.withCoordinates} application{geography.withCoordinates === 1 ? '' : 's'} carry a pinned location
            {geography.withoutAddress ? ` · ${geography.withoutAddress} have no address at all` : ''}
          </p>
        </Panel>

        <Panel title="Where people fall out" hint="Every step is people who got that far.">
          <Funnel steps={funnel} />
        </Panel>

        <Panel
          title="What holds applications up"
          hint="Outstanding documents on applications not yet decided."
        >
          <BarList
            items={documents.filter((d) => d.outstanding > 0).slice(0, 6)}
            labelKey="name"
            valueKey="outstanding"
            tone="warn"
            emptyLabel="Nothing outstanding."
          />
          {documents.some((d) => d.rejectionRate !== null && d.rejectionRate >= 25) ? (
            <p className="insight is-warn">
              <Icon name="alert" size={14} />
              {documents.filter((d) => d.rejectionRate >= 25).map((d) => d.name).join(', ')}{' '}
              {documents.filter((d) => d.rejectionRate >= 25).length === 1 ? 'is' : 'are'} frequently uploaded and then
              refused. That usually means the guidance is unclear rather than that residents are being careless.
            </p>
          ) : null}
        </Panel>

        {/* -------------------------------------------------------------- */}
        {activeCouncillors.length ? (
          <Panel
            title="Ward councillor activity"
            hint="Captures per councillor, and what became of them."
            wide
          >
            <div className="table-card table-scroll">
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>Councillor</th>
                    <th>Ward</th>
                    <th>Captured</th>
                    <th>Submitted</th>
                    <th>Approved</th>
                    <th>Approval rate</th>
                    <th>Unfinished</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCouncillors.map((c) => (
                    <tr key={c.id} className={c.isActive ? '' : 'row-muted'}>
                      <td>
                        <strong>{c.name}</strong>
                        {!c.isActive ? <small className="muted">Deactivated</small> : null}
                      </td>
                      <td>{c.ward || '—'}</td>
                      <td>{c.captured}</td>
                      <td>{c.submitted}</td>
                      <td>{c.approved}</td>
                      <td>{c.approvalRate === null ? '—' : `${c.approvalRate}%`}</td>
                      <td className={c.unfinishedPercent > 30 ? 'warn-cell' : ''}>
                        {c.draft} ({c.unfinishedPercent}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="field-hint">
              A high unfinished share usually means households are being turned away at the door for want of a document,
              not that a councillor is idle — it is worth asking which document.
            </p>
          </Panel>
        ) : null}

        <Panel title="Employment status">
          <BarList items={data.employment} />
        </Panel>

        <Panel title="Marital status">
          <BarList items={data.marital} />
        </Panel>
      </div>
    </AdminLayout>
  );
}
