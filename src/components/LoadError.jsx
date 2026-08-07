import { friendlyError } from '../utils/apiError';
import Icon from './ui/Icon';

/**
 * Turns a failed page load into something the person reading it can act on.
 *
 * All wording goes through friendlyError, so a staff member never sees "Request
 * failed with status code 500". The technical detail is logged to the browser
 * console at the same time, which is where a developer will look.
 */
export function loadErrorMessage(err) {
  // A 404 on an admin page usually means an endpoint that does not exist yet,
  // not a missing record — and the difference matters, because one means "no
  // data" and the other means "these figures are not real".
  if (err?.response?.status === 404 && !err?.response?.data?.message) {
    return 'This part of the system is not available yet. Any figures shown below are not real.';
  }
  return friendlyError(err, 'We could not load this. Please try again.');
}

export default function LoadError({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
      <Icon name="alert" size={16} />
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="btn btn-sm btn-outline" onClick={onRetry} style={{ marginLeft: 'auto' }}>
          <Icon name="refresh" size={14} /> Try again
        </button>
      ) : null}
    </div>
  );
}
