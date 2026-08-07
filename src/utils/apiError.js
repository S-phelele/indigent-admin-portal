/**
 * Turning a failed request into a sentence.
 *
 * Nothing technical reaches the screen. "Network Error", "Request failed with
 * status code 500" and "ERR_BAD_REQUEST" are axios's words, not ours, and to
 * somebody applying for help with their water bill they read as "you have broken
 * something" — which is almost never true.
 *
 * The full error still goes to the browser console, tagged, so a developer
 * opening dev tools sees exactly what happened and where. Two audiences, two
 * messages, one place that decides which is which.
 */

/**
 * Fallbacks by status, used only when the server sent no message of its own.
 *
 * The server's message is always preferred: it knows the specifics, and it has
 * already been written for a person.
 */
const BY_STATUS = {
  400: 'Some of the details need correcting. Please check the form and try again.',
  401: 'Your session has ended. Please sign in again.',
  403: 'You do not have access to this.',
  404: 'We could not find what you were looking for.',
  409: 'That has already been done.',
  413: 'That file is too large. The limit is 10 MB.',
  415: 'That kind of file cannot be uploaded.',
  422: 'Some of the details need correcting.',
  429: 'You have tried that too many times. Please wait a few minutes and try again.',
  500: 'Something went wrong on our side. Please try again in a moment.',
  502: 'The service is not responding. Please try again shortly.',
  503: 'The service is temporarily unavailable. Please try again shortly.',
  504: 'That took too long. Please try again.',
};

const OFFLINE = 'You appear to be offline. Check your connection and try again.';
const UNREACHABLE = 'We could not reach the service. Please check your connection and try again.';

/**
 * The sentence to show somebody.
 *
 * `fallback` lets a caller phrase the failure in terms of what was being
 * attempted — "We could not save your application" is more use than "Something
 * went wrong", and only the caller knows which.
 */
export function friendlyError(error, fallback) {
  logForDeveloper(error);

  // No response at all: the request never arrived or never came back.
  if (!error?.response) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return OFFLINE;
    if (error?.code === 'ECONNABORTED') return 'That took too long. Please try again.';
    return UNREACHABLE;
  }

  const { status, data } = error.response;

  // The server's own wording wins — it is specific and already written for a
  // person. Guard against a stray code or a stack trace leaking through.
  const fromServer = data?.message;
  if (typeof fromServer === 'string' && fromServer.length > 0 && looksHuman(fromServer)) {
    // A support reference is worth showing; it is what they quote on the phone.
    return data.reference ? `${fromServer}` : fromServer;
  }

  return BY_STATUS[status] || fallback || 'Something went wrong. Please try again.';
}

/**
 * Would a person understand this?
 *
 * Rejects anything that looks like a stack trace, a driver code, or an
 * identifier rather than a sentence. Better to fall back to our own plain
 * wording than to render `PrismaClientKnownRequestError` at somebody.
 */
function looksHuman(message) {
  if (message.length > 400) return false;
  if (/\bat\s+\w+\s*\(/.test(message)) return false;
  if (/^[A-Z_]{4,}$/.test(message.trim())) return false;
  if (/\b(Error|Exception):\s/.test(message)) return false;
  if (/\b(prisma|sequelize|ECONN|ENOTFOUND|undefined is not|null is not)\b/i.test(message)) return false;
  return true;
}

/** The developer's version: everything, in the console, tagged and findable. */
export function logForDeveloper(error) {
  if (!import.meta.env.DEV && !window.__INDIGENT_DEBUG__) return;

  const req = error?.config;
  console.groupCollapsed(
    `%c[api] ${req?.method?.toUpperCase() || '???'} ${req?.url || 'unknown'} → ${error?.response?.status || 'no response'}`,
    'color:#c81e26;font-weight:600'
  );
  if (req?.data) console.log('request body :', safeParse(req.data));
  if (error?.response?.data) console.log('response     :', error.response.data);
  if (error?.response?.data?.reference) {
    console.log('reference    :', error.response.data.reference, '(grep the server log for this)');
  }
  console.log('raw error    :', error);
  console.groupEnd();
}

function safeParse(body) {
  if (typeof body !== 'string') return body;
  try { return JSON.parse(body); } catch { return body; }
}

/**
 * Field-level errors, when the server names them.
 *
 * Lets a form put the message beside the input it belongs to rather than in a
 * banner at the top, which is the difference between "something is wrong" and
 * "this box is wrong".
 */
export const fieldErrors = (error) => error?.response?.data?.fields || null;

/** True when the failure means the session is gone and a redirect is due. */
export const isAuthError = (error) => error?.response?.status === 401;

/** True when the applicant is simply going too fast, not doing anything wrong. */
export const isRateLimited = (error) => error?.response?.status === 429;

export default friendlyError;
