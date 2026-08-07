import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

/**
 * Toast notifications.
 *
 * Replaces the pattern of setting an `error`/`success` string into page state and
 * rendering an inline alert, which pushed layout around and was easy to miss after
 * an action taken further down a long form.
 *
 * Inline alerts are still the right choice for validation tied to a specific field
 * or for a persistent page-level condition. Toasts are for the outcome of an action.
 *
 *   const toast = useToast();
 *   toast.success('Application approved');
 *   toast.error('Upload failed', err.message);
 */

const ToastContext = createContext(null);

const ICONS = {
  success: 'check-circle',
  error: 'alert-circle',
  warning: 'alert-triangle',
  info: 'info',
};

const DEFAULT_DURATION = 5000;
const MAX_VISIBLE = 4;

let seq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    // Mark leaving first so the exit animation can play, then remove.
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    const timer = setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
      timers.current.delete(`out-${id}`);
    }, 160);
    timers.current.set(`out-${id}`, timer);
  }, []);

  const push = useCallback(
    (variant, title, message, duration = DEFAULT_DURATION) => {
      const id = ++seq;
      setToasts((list) => [...list, { id, variant, title, message }].slice(-MAX_VISIBLE));
      if (duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), duration));
      }
      return id;
    },
    [dismiss]
  );

  // Clear every pending timer on unmount so nothing fires against a dead tree.
  useEffect(() => {
    const map = timers.current;
    return () => { map.forEach(clearTimeout); map.clear(); };
  }, []);

  const api = useMemo(
    () => ({
      success: (title, message, duration) => push('success', title, message, duration),
      error:   (title, message, duration) => push('error', title, message, duration ?? 8000),
      warning: (title, message, duration) => push('warning', title, message, duration),
      info:    (title, message, duration) => push('info', title, message, duration),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-region" role="region" aria-label="Notifications">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`toast toast-${t.variant}${t.leaving ? ' is-leaving' : ''}`}
              role={t.variant === 'error' ? 'alert' : 'status'}
              aria-live={t.variant === 'error' ? 'assertive' : 'polite'}
            >
              <Icon name={ICONS[t.variant]} size={18} className="toast-icon" />
              <div className="toast-body">
                <div className="toast-title">{t.title}</div>
                {t.message ? <div className="toast-msg">{t.message}</div> : null}
              </div>
              <button
                type="button"
                className="toast-close"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
