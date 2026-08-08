import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { loadErrorMessage } from '../../components/LoadError';
import { SkeletonPanel } from '../../components/ui/Skeleton';
import api from '../../services/api';

/**
 * The statistics report, laid out for A4.
 *
 * The same tables the Excel workbook contains, rendered as a document somebody
 * can hand to a council committee. Both come from one definition on the server,
 * so the printed report and the spreadsheet can never disagree about a figure —
 * which is the failure that makes an exported report worse than none at all.
 *
 * Printed from the browser rather than generated as a PDF on the server. Every
 * print dialog offers "Save as PDF", so this gives both outputs without adding a
 * headless browser — a hundred megabytes of dependency and a second process to
 * keep alive — to the API.
 */

const dateZA = (d) => (d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

/** Render a cell according to the kind its column declared. */
function formatCell(value, kind) {
  if (value === null || value === undefined || value === '') return '—';
  if (kind === 'number') return Number(value).toLocaleString('en-ZA');
  if (kind === 'percent') return `${Number(value).toLocaleString('en-ZA')}%`;
  if (kind === 'money') return `R ${Number(value).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  if (kind === 'date' || kind === 'datetime') return new Date(value).toLocaleDateString('en-ZA');
  return String(value);
}

const isNumeric = (kind) => ['number', 'percent', 'money'].includes(kind);

export default function StatisticsReport() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/export/statistics')
      .then((res) => setReport(res.data.data))
      .catch((err) => setError(loadErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="print-page"><SkeletonPanel height={280} /></div>;
  }

  if (error) {
    return (
      <div className="print-page">
        <div className="alert alert-error" role="alert">
          <Icon name="alert-circle" size={16} />
          <span>{error}</span>
        </div>
        <Link className="btn btn-outline btn-sm" to="/analytics">Back to analytics</Link>
      </div>
    );
  }

  const { headline } = report;

  return (
    <div className="print-page">
      {/* Hidden on paper: this is the toolbar, not part of the report. */}
      <div className="print-toolbar">
        <Link className="btn btn-outline btn-sm" to="/analytics">
          <Icon name="arrow-left" size={15} /> Back to analytics
        </Link>
        <div className="row-actions">
          <a className="btn btn-outline btn-sm" href="/api/export/statistics.xls">
            <Icon name="download" size={15} /> Download for Excel
          </a>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
            <Icon name="file" size={15} /> Print or save as PDF
          </button>
        </div>
      </div>

      <article className="print-doc">
        <header className="print-head">
          <span className="print-mark" aria-hidden="true">IR</span>
          <div>
            <h1>Indigent register — statistics</h1>
            <p className="muted">
              {report.municipality || 'Municipality not set'} · prepared {dateZA(report.generatedAt)}
              {report.generatedBy ? ` by ${report.generatedBy}` : ''}
            </p>
          </div>
        </header>

        {/* The four figures somebody wants before reading anything else. */}
        <section className="report-headline">
          <div><span className="rh-value">{headline.applications.toLocaleString('en-ZA')}</span><span className="rh-label">Applications</span></div>
          <div><span className="rh-value">{headline.approved.toLocaleString('en-ZA')}</span><span className="rh-label">Approved</span></div>
          <div><span className="rh-value">{headline.approvalRate}%</span><span className="rh-label">Approval rate</span></div>
          <div><span className="rh-value">{headline.medianTurnaround ?? '—'}</span><span className="rh-label">Median days to decide</span></div>
        </section>

        {report.sections.map((section) => (
          <section className="report-section" key={section.key}>
            <h2>{section.title}</h2>
            {section.note ? <p className="report-note">{section.note}</p> : null}

            {section.rows.length === 0 ? (
              <p className="muted">Nothing to report yet.</p>
            ) : (
              <table className="report-table">
                <thead>
                  <tr>
                    {section.columns.map((c) => (
                      <th key={c.key} className={isNumeric(c.kind) ? 'num' : undefined}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, i) => (
                    <tr key={i}>
                      {section.columns.map((c) => (
                        <td key={c.key} className={isNumeric(c.kind) ? 'num' : undefined}>
                          {formatCell(row[c.key], c.kind)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}

        <footer className="print-foot">
          <p>
            Produced from the indigent register on {dateZA(report.generatedAt)}. Figures cover every application on
            the register unless a table states otherwise.
          </p>
        </footer>
      </article>
    </div>
  );
}
