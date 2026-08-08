import Icon from './ui/Icon';

/**
 * "You are about to be signed out."
 *
 * Deliberately not the standard Modal: this has to appear over whatever is on
 * screen including an open modal, and it must not be dismissible by clicking
 * away. Ignoring it is a valid choice — the sign-out happens either way — but it
 * should be a choice rather than an accident.
 *
 * The countdown is shown in seconds because that is what makes it feel like a
 * deadline. "2 minutes" reads as advisory; "1:43" gets read.
 */
export default function IdleWarning({ secondsLeft, onStay, onSignOutNow }) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="idle-overlay" role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
      <div className="idle-dialog">
        <span className="idle-icon" aria-hidden="true"><Icon name="clock" size={22} /></span>

        <h2 id="idle-title">Still there?</h2>
        <p>
          You have not done anything for a while, so we are about to sign you out. This protects the household
          information on screen if you have stepped away.
        </p>

        <p className="idle-countdown" aria-live="polite">
          Signing out in <strong>{minutes}:{seconds}</strong>
        </p>

        <div className="idle-actions">
          <button type="button" className="btn btn-ghost" onClick={onSignOutNow}>Sign out now</button>
          {/* Focused on mount so Enter keeps the session, which is what somebody
              who is still working will reach for. */}
          <button type="button" className="btn btn-primary" onClick={onStay} autoFocus>
            I&apos;m still here
          </button>
        </div>
      </div>
    </div>
  );
}
