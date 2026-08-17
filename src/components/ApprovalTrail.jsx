import Icon from './ui/Icon';

/**
 * How this application was decided: who acted, what they decided, and why.
 *
 * Shared by the administrator's application view and the approver's case file,
 * because the two must describe one decision in one vocabulary. Until this
 * existed the administrator's screen showed no approvals at all — the half of
 * the record the municipality is actually accountable for was invisible on the
 * screen an audit opens first.
 *
 * ## Why the reasons are shown in full
 *
 * "Recommended approval" tells the next officer nothing they can check. The
 * assessment officer needs the verifier's reasoning, and the supervisor signing
 * off is accountable for a chain they can actually read. Notes are rendered
 * verbatim rather than truncated — a reason worth recording is worth reading.
 *
 * ## Steps still open are shown too
 *
 * A stage that was started and not finished is exactly what somebody asking
 * "why is this taking so long" needs to see, so an undecided step appears with
 * the date it was picked up rather than being hidden until it resolves.
 */

const TONE_ICON = {
  approved: 'check-circle',
  declined: 'alert-circle',
  draft: 'arrow-left',
  pending: 'clock',
  neutral: 'circle',
};

const dateTimeZA = (value) =>
  (value ? new Date(value).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : null);

export default function ApprovalTrail({ trail = [], signatures = [], title = 'How this was decided' }) {
  if (!trail.length) {
    return (
      <section className="panel">
        <div className="panel-header"><h2>{title}</h2></div>
        <div className="table-empty">
          <Icon name="clock" size={26} />
          <p>Nothing has happened yet.</p>
          <small>Steps appear here as each officer picks the application up and decides.</small>
        </div>
      </section>
    );
  }

  /** Signatures are matched to their step so the image sits with its decision. */
  const signatureFor = (stage) => signatures.find((s) => s.stage === stage) || null;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <p className="field-hint">
          Every stage, in order, with the officer who acted and the reasons they gave.
        </p>
      </div>

      <ol className="trail">
        {trail.map((step) => {
          const signed = signatureFor(step.stage);

          return (
            <li key={step.id} className={`trail-step trail-${step.tone}`}>
              <span className="trail-mark" aria-hidden="true">
                <Icon name={TONE_ICON[step.tone] || 'circle'} size={15} />
              </span>

              <div className="trail-body">
                <div className="trail-head">
                  <strong>{step.stageLabel}</strong>
                  <span className={`badge badge-${step.tone}`}>{step.outcomeLabel}</span>
                </div>

                {/* Who, and in what capacity. The role matters as much as the
                    name: it is what shows the separation of duties held. */}
                <p className="trail-who">
                  {step.who}
                  {step.role ? <span className="muted"> · {step.role}</span> : null}
                </p>

                <p className="trail-when">
                  {step.decided ? (
                    <>
                      Decided {dateTimeZA(step.decidedAt)}
                      {step.daysTaken !== null
                        ? ` · took ${step.daysTaken} ${step.daysTaken === 1 ? 'day' : 'days'}`
                        : ''}
                    </>
                  ) : (
                    <>Picked up {dateTimeZA(step.startedAt)} · still with this officer</>
                  )}
                </p>

                {step.returnedTo ? (
                  <p className="trail-returned">
                    <Icon name="arrow-left" size={13} /> Sent back to {step.returnedTo}
                  </p>
                ) : null}

                {/*
                  Separation of duties was set aside for this step.

                  Only an administrator or a superuser can reach this state, and
                  for them the exemption is the whole of the control — so it is
                  stated plainly rather than left to be inferred from two
                  identical names further apart in the list. Somebody reviewing a
                  case must be able to see that one person carried more than one
                  stage of it without having to work it out.
                */}
                {step.isOverride ? (
                  <p className="trail-override">
                    <Icon name="alert-triangle" size={13} />
                    <span>
                      <strong>Separation of duties overridden.</strong>
                      {step.overrideReason ? ` ${step.overrideReason}.` : ''}
                    </span>
                  </p>
                ) : null}

                {/* The reason. Rendered as given, because this is the part that
                    has to stand up if the decision is ever questioned. */}
                {step.why ? (
                  <blockquote className="trail-why">{step.why}</blockquote>
                ) : step.decided ? (
                  <p className="trail-nowhy">No reasons were recorded for this step.</p>
                ) : null}

                {signed ? (
                  <div className="trail-signature">
                    <img src={signed.image} alt={`Signature of ${signed.name}`} className="signature-image" />
                    <div>
                      <strong>{signed.name}</strong>
                      <p className="field-hint">
                        {signed.signedAtLabel}
                        {signed.ip ? ` · from ${signed.ip}` : ''}
                        <br />{signed.statement}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
