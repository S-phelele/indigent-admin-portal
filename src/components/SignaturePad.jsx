import { useEffect, useRef, useState, useCallback } from 'react';
import SignaturePadLib from 'signature_pad';
import Icon from './ui/Icon';

/**
 * A drawn signature.
 *
 * The supervisor signs with a finger, a stylus or a mouse. What comes out is a
 * PNG data URI, which the server stores against the sign-off step together with
 * who drew it, when, and from where.
 *
 * ## Two things that are easy to get wrong
 *
 * **Device pixel ratio.** A canvas sized in CSS pixels but drawn at 1× looks
 * blurred on every phone and most laptops. The canvas backing store is scaled to
 * the device ratio and the context scaled to match, so the line is crisp
 * wherever it is signed.
 *
 * **Resizing clears the canvas.** Changing a canvas's width or height attribute
 * wipes it — so a rotated phone, or an on-screen keyboard opening, would silently
 * erase a signature somebody had already drawn. The drawing is saved and
 * restored around every resize.
 */
export default function SignaturePad({
  onChange,
  disabled = false,
  height = 200,
  label = 'Sign here',
  hint = 'Use your finger, a stylus or your mouse.',
}) {
  const canvasRef = useRef(null);
  const padRef = useRef(null);
  const [empty, setEmpty] = useState(true);

  /** Size the backing store to the device, preserving anything already drawn. */
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const pad = padRef.current;
    if (!canvas || !pad) return;

    const drawn = pad.isEmpty() ? null : pad.toDataURL();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    canvas.getContext('2d').scale(ratio, ratio);

    // Changing width/height above cleared it; put it back.
    if (drawn) pad.fromDataURL(drawn, { width: rect.width, height: rect.height });
    else pad.clear();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const pad = new SignaturePadLib(canvas, {
      // Dark ink on white, the way a signature on paper reads.
      penColor: '#0f172a',
      backgroundColor: '#ffffff',
      minWidth: 0.8,
      maxWidth: 2.4,
    });
    padRef.current = pad;

    const onEnd = () => {
      setEmpty(pad.isEmpty());
      onChange?.(pad.isEmpty() ? null : pad.toDataURL('image/png'));
    };
    pad.addEventListener('endStroke', onEnd);

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);

    return () => {
      pad.removeEventListener('endStroke', onEnd);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      pad.off();
    };
  }, [onChange, resize]);

  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    if (disabled) pad.off();
    else pad.on();
  }, [disabled]);

  const clear = () => {
    padRef.current?.clear();
    setEmpty(true);
    onChange?.(null);
  };

  return (
    <div className={`signature-pad${disabled ? ' is-disabled' : ''}`}>
      <div className="signature-pad-head">
        <span className="field-label">{label}</span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={clear} disabled={disabled || empty}>
          <Icon name="refresh" size={14} /> Clear
        </button>
      </div>

      <div className="signature-canvas-wrap" style={{ height }}>
        <canvas
          ref={canvasRef}
          className="signature-canvas"
          // Without this the browser scrolls the page instead of drawing when a
          // finger moves across the canvas.
          style={{ touchAction: 'none' }}
          aria-label={label}
        />
        {empty ? <span className="signature-placeholder" aria-hidden="true">{hint}</span> : null}
        <span className="signature-baseline" aria-hidden="true" />
      </div>

      <p className="field-hint">
        Signing electronically has the same effect as signing on paper, under the Electronic Communications and
        Transactions Act 25 of 2002. Your name, the time and your address are recorded with the signature.
      </p>
    </div>
  );
}
