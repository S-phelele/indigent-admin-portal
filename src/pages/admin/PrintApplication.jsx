import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { loadErrorMessage } from '../../components/LoadError';
import api from '../../services/api';

/**
 * The printable application form.
 *
 * Municipalities still keep paper files, and an approval that exists only on a
 * screen cannot go in one. This renders the whole application — declaration,
 * household, means test, approval trail and signatures — as a single document
 * laid out for A4.
 *
 * Rendered in the browser and printed from there rather than generated as a PDF
 * server-side. Every browser's print dialog offers "Save as PDF", so this gives
 * both outputs without adding a rendering engine to the API, and the page stays
 * readable on screen while somebody checks it before printing.
 *
 * The layout deliberately carries no navigation: `.print-page` hides the portal
 * chrome, so what appears on paper is the form and nothing else.
 */
export default function PrintApplication() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/export/applications/${id}/print`)
      .then((res) => setDoc(res.data.data))
      .catch((err) => setError(loadErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="loading"><span className="spinner" /> Preparing the form…</div>;
  }
  if (!doc) {
    return (
      <div className="print-page">
        <div className="alert alert-error">{error || 'We could not build that form.'}</div>
      </div>
    );
  }

  const printedAt = new Date(doc.printedAt).toLocaleString('en-ZA', { dateStyle: 'long', timeStyle: 'short' });

  return (
    <div className="print-page">
      {/* Not printed — the controls for the person looking at it on screen. */}
      <div className="print-toolbar no-print">
        <Link className="btn btn-outline btn-sm" to={`/approvals/${id}`}>
          <Icon name="arrow-left" size={15} /> Back to the file
        </Link>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
          <Icon name="file" size={15} /> Print or save as PDF
        </button>
      </div>

      <article className="print-doc">
        <header className="print-head">
          <div className="print-mark" aria-hidden="true">IR</div>
          <div>
            <h1>Application for Indigent Support</h1>
            <p>Municipal Indigent Register</p>
          </div>
          <div className="print-ref">
            <span className="print-ref-label">Reference</span>
            <strong>{doc.reference || 'Not yet issued'}</strong>
          </div>
        </header>

        <div className="print-summary">
          <div><span>Applicant</span><strong>{doc.applicantName}</strong></div>
          <div><span>Status</span><strong>{doc.status}</strong></div>
          <div><span>Printed</span><strong>{printedAt}</strong></div>
          <div><span>Printed by</span><strong>{doc.printedBy}</strong></div>
        </div>

        {doc.sections.map((section) => (
          <section className="print-section" key={section.title}>
            <h2>{section.title}</h2>
            <dl className="print-fields">
              {section.fields.map(([name, value]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>

            {section.table ? (
              <table className="print-table">
                <thead>
                  <tr>{section.table.head.map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {section.table.rows.map((row, i) => (
                    <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        ))}

        <section className="print-section">
          <h2>Supporting documents</h2>
          <table className="print-table">
            <thead><tr><th>Document</th><th>Required</th><th>Supplied</th></tr></thead>
            <tbody>
              {doc.documents.map((d) => (
                <tr key={d.name}>
                  <td>{d.name}</td>
                  <td>{d.required ? 'Yes' : 'No'}</td>
                  <td>{d.supplied ? 'Yes' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {doc.siteVisits?.length ? (
          <section className="print-section">
            <h2>Site visits</h2>
            <table className="print-table">
              <thead><tr><th>Attempt</th><th>Outcome</th><th>Date</th><th>Officer</th><th>Findings</th></tr></thead>
              <tbody>
                {doc.siteVisits.map((v) => (
                  <tr key={v.attempt}>
                    <td>{v.attempt}</td>
                    <td>{v.outcome.replace(/_/g, ' ').toLowerCase()}</td>
                    <td>{v.at ? new Date(v.at).toLocaleDateString('en-ZA') : '—'}</td>
                    <td>{v.officer || '—'}</td>
                    <td>{v.findings || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {/*
          The approval trail belongs on the paper file. A printed form that shows
          only the outcome is missing the part an auditor asks about: who checked
          what, in what order, and who put their name to it.
        */}
        <section className="print-section print-approvals">
          <h2>Approval trail</h2>
          {doc.approvals.length === 0 ? (
            <p>No approval steps have been recorded.</p>
          ) : (
            doc.approvals.map((step, i) => (
              <div className="print-step" key={i}>
                <div className="print-step-head">
                  <strong>{step.stage}</strong>
                  <span>{step.at ? new Date(step.at).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</span>
                </div>
                <p>{step.description}</p>
                {step.notes ? <p className="print-step-notes">{step.notes}</p> : null}

                {step.signature ? (
                  <div className="print-signature">
                    <img src={step.signature.image} alt={`Signature of ${step.signature.name}`} />
                    <div>
                      <strong>{step.signature.name}</strong>
                      <span>{step.signature.signedAtLabel}</span>
                      <span className="print-signature-note">{step.signature.statement}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </section>

        <footer className="print-foot">
          <p>
            This form was produced from the Municipal Indigent Register on {printedAt}. Electronic signatures shown
            above were made under the Electronic Communications and Transactions Act 25 of 2002 and are recorded with
            the signatory&rsquo;s name, the time of signing and the address they signed from.
          </p>
        </footer>
      </article>
    </div>
  );
}
