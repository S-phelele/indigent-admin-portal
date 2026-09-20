import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import ReportFilters, { EMPTY_FILTERS, toQuery } from '../../components/ReportFilters';
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
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get(`/export/statistics${applied ? `?${applied}` : ''}`)
      .then((res) => {
        if (cancelled) return;
        const payload = res.data?.data;
        if (!payload) {
          setError('The statistics report returned no data.');
          setReport(null);
          return;
        }
        setReport(payload);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(loadErrorMessage(err));
          setReport(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [applied]);

  const downloadExcel = async () => {
    try {
      const res = await api.get(`/export/statistics.xls${applied ? `?${applied}` : ''}`, {
        responseType: 'arraybuffer',
      });
      const buf = res.data;
      const head = String.fromCharCode(...new Uint8Array(buf.slice(0, 20)));
      if (head.trimStart().startsWith('{')) {
        const text = new TextDecoder().decode(buf);
        let message = 'Could not download the Excel file.';
        try { message = JSON.parse(text)?.message || message; } catch { /* keep */ }
        setError(message);
        return;
      }
      const blob = new Blob([buf], { type: 'application/vnd.ms-excel;charset=utf-8' });
      if (blob.size < 64) {
        setError('The Excel file came back empty. Clear filters and try again.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `indigent-statistics-${new Date().toISOString().slice(0, 10)}.xls`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Your session expired. Please sign in again, then download the Excel file.');
        return;
      }
      setError(loadErrorMessage(err) || 'Could not download the Excel file. Please try again.');
    }
  };

  if (loading) {
    return <div className="print-page"><SkeletonPanel height={280} /></div>;
  }

  // Keep a usable page when a filter fails on hosted deploys (auth / API URL).
  if (error || !report) {
    return (
      <div className="print-page">
        <div className="alert alert-error" role="alert">
          <Icon name="alert-circle" size={16} />
          <span>{error || 'The report could not be loaded.'}</span>
        </div>
        <p className="field-hint" style={{ marginTop: '0.75rem' }}>
          If this only happens after applying a filter on the hosted site, check that
          <code> VITE_API_URL </code> points at your API and that you are still signed in.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { setApplied(''); setError(''); }}>
            Clear filters and retry
          </button>
          <Link className="btn btn-outline btn-sm" to="/analytics">Back to analytics</Link>
        </div>
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
          {/* Authenticated download — a plain href omits the JWT and fails with
              "Please sign in to continue" on hosted environments. */}
          <button type="button" className="btn btn-outline btn-sm" onClick={downloadExcel}>
            <Icon name="download" size={15} /> Download for Excel
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
            <Icon name="file" size={15} /> Print or save as PDF
          </button>
        </div>
      </div>

      <ReportFilters
        value={filters}
        onChange={setFilters}
        onApply={(next) => setApplied(toQuery(next))}
      />

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

        {/*
          What these figures cover, printed above them.

          A statistic without its criteria is not a statistic. This page gets
          saved as a PDF and forwarded into a council pack, and at that point
          nothing else on the paper says whether it is one ward or all of them.
          Always shown — an unfiltered report says "all wards" rather than
          leaving the reader to assume.
        */}
        {report.filters?.length ? (
          <section className="report-criteria">
            <h2>What these figures cover</h2>
            <dl>
              {report.filters.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

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
          <p className="print-foot-powered">Powered by Malcam ICT Solutions</p>
        </footer>
      </article>
    </div>
  );
}
