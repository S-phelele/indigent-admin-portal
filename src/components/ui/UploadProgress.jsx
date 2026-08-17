import Icon from './Icon';

/**
 * How far an upload has actually got.
 *
 * Uploads used to show nothing beyond a disabled button. A household
 * photographing an ID book produces a few megabytes, and on a slow connection
 * that is a long wait with no sign of life — which is exactly where somebody
 * clicks again and creates a duplicate.
 *
 * ## The rule
 *
 * **Never show a number that is not true.** The bar is determinate only where
 * real bytes are being counted; where the total is unknown it falls back to an
 * indeterminate sweep rather than inventing a denominator. A bar that creeps to
 * 90% and waits teaches people the number means nothing, which is worse than no
 * number at all.
 *
 * Motion lives in the stylesheet and is dropped entirely under
 * `prefers-reduced-motion`. The progress figures stay either way, and the
 * `aria-live` announcement does too — this has to work for somebody who cannot
 * see the bar move.
 */

const humanSize = (bytes) => {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function UploadProgress({ fileName, fraction, loaded, total, onCancel, done = false }) {
  const percent = fraction === null || fraction === undefined ? null : Math.round((done ? 1 : fraction) * 100);

  return (
    <div
      className={`upload-progress${done ? ' is-done' : ''}`}
      role="progressbar"
      aria-live="polite"
      aria-valuemin={0}
      aria-valuemax={100}
      // Omitted entirely when unknown, which is what tells a screen reader the
      // bar is indeterminate rather than stuck at zero.
      aria-valuenow={percent ?? undefined}
      aria-label={done ? `${fileName || 'File'} uploaded` : `Uploading ${fileName || 'file'}`}
    >
      <div className="upload-progress-head">
        <div className="upload-progress-text">
          <strong>{fileName || 'Uploading…'}</strong>
          <small>
            {done
              ? 'Sent'
              : percent === null
                ? `${humanSize(loaded)} sent`
                : `${percent}% · ${humanSize(loaded)} of ${humanSize(total)}`}
          </small>
        </div>

        {/* Completion morphs into a tick rather than the row disappearing — a
            control that vanishes reads as something having gone wrong. */}
        {done ? (
          <Icon name="check-circle" size={20} />
        ) : onCancel ? (
          <button type="button" className="btn-icon" onClick={onCancel} aria-label="Cancel this upload">
            <Icon name="close" size={16} />
          </button>
        ) : null}
      </div>

      <div className="upload-progress-track">
        <div
          className={percent === null && !done ? 'upload-progress-fill indeterminate' : 'upload-progress-fill'}
          style={percent === null && !done ? undefined : { width: `${percent ?? 0}%` }}
        />
      </div>
    </div>
  );
}
