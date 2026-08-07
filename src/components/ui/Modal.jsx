import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

/**
 * Accessible modal dialog.
 *
 * Handles the things hand-rolled overlays usually miss: Escape to close, focus
 * moved into the dialog on open and restored to the trigger on close, focus
 * trapped inside while open, background scroll locked, and correct ARIA roles.
 *
 * `<ConfirmModal>` below wraps this for the common destructive-action case so
 * approve/decline flows don't rely on window.confirm.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open = true,
  onClose,
  title,
  description,
  icon,
  iconVariant = 'info',
  size,
  children,
  footer,
  closeOnOverlay = true,
  flushBody = false,
}) {
  const dialogRef = useRef(null);
  const restoreRef = useRef(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 9)}`).current;

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const nodes = dialogRef.current?.querySelectorAll(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return undefined;

    restoreRef.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Focus the first control, falling back to the dialog itself.
    const node = dialogRef.current?.querySelector(FOCUSABLE) || dialogRef.current;
    node?.focus?.();

    return () => {
      document.body.style.overflow = overflow;
      restoreRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        className={`modal${size === 'lg' ? ' modal-lg' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {(title || onClose) && (
          <div className="modal-head">
            <div style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start', minWidth: 0 }}>
              {icon ? (
                <div className={`modal-icon is-${iconVariant}`}>
                  <Icon name={icon} size={18} />
                </div>
              ) : null}
              <div style={{ minWidth: 0 }}>
                {title ? <h2 id={titleId}>{title}</h2> : null}
                {description ? <p>{description}</p> : null}
              </div>
            </div>
            {onClose ? (
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
                <Icon name="close" size={16} />
              </button>
            ) : null}
          </div>
        )}

        <div className={`modal-body${flushBody ? ' is-flush' : ''}`}>{children}</div>

        {footer ? <div className="modal-actions">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

/** Confirmation dialog for actions worth a second look (approve, decline, delete). */
export function ConfirmModal({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'info',
  busy = false,
  children,
}) {
  const confirmClass =
    variant === 'danger' ? 'btn btn-danger' : variant === 'success' ? 'btn btn-primary' : 'btn btn-primary';

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onCancel}
      title={title}
      description={description}
      icon={variant === 'danger' ? 'alert-triangle' : variant === 'success' ? 'check-circle' : 'info'}
      iconVariant={variant}
      closeOnOverlay={!busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className={confirmClass} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
