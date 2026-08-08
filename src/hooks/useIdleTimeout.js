import { useEffect, useRef, useState } from 'react';

/**
 * Sign somebody out after a period of doing nothing, with a warning first.
 *
 * ## Why the browser and not the server
 *
 * The risk here is physical, not network: a front-desk terminal left signed in
 * while the officer helps somebody at the counter, or a councillor's phone put
 * down at a gate. The server cannot see an idle browser — it only knows when a
 * request arrives — so the timer has to live here. The server's job is the
 * absolute cap on token lifetime, which this does not replace.
 *
 * This is a usability control as much as a security one. It is not a defence
 * against somebody who has already taken the token: they are not waiting for a
 * countdown. It closes the far more common case of an unattended screen.
 *
 * ## Why a warning
 *
 * An officer half way through capturing a household at somebody's door should not
 * lose the form because they spent three minutes reading an ID book. The warning
 * gives them a way to stay signed in, and makes the sign-out something that was
 * announced rather than something that appeared to be a crash.
 *
 * ## What counts as activity
 *
 * Pointer, keyboard, scroll and touch, plus returning to the tab. Deliberately
 * not "a request went out" — a page that polls in the background would keep a
 * session alive forever with nobody in the room, which is the exact situation
 * this exists to end.
 */

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'wheel'];

/**
 * How often the timer is checked, rather than relying on one long setTimeout.
 *
 * A laptop that sleeps does not fire timers while suspended, so a single timeout
 * set for twenty minutes can come due long after the fact — or not fire until the
 * machine wakes. Comparing timestamps on a short interval means a lid closed for
 * an hour is correctly treated as an hour of inactivity.
 */
const TICK_MS = 5000;

export default function useIdleTimeout({
  enabled,
  idleMinutes = 20,
  warningMinutes = 2,
  onTimeout,
  storageKey,
}) {
  const [secondsLeft, setSecondsLeft] = useState(null);
  const lastActive = useRef(Date.now());
  const firedRef = useRef(false);

  /**
   * Mirrors secondsLeft so the activity listener can read it.
   *
   * Declared before the effect that uses it — reading it from a closure created
   * above its declaration works only because effects run after the component body
   * has finished, which is not a thing to rely on. Using a ref rather than the
   * state value keeps the listeners out of the effect's dependencies, so they are
   * not torn down and rebuilt every time the countdown ticks.
   */
  const secondsLeftRef = useRef(null);
  secondsLeftRef.current = secondsLeft;
  // Held in a ref so a caller passing an inline arrow does not restart the timer
  // on every render, which would mean it never actually elapsed.
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const idleMs = idleMinutes * 60 * 1000;
  const warnMs = Math.min(warningMinutes * 60 * 1000, idleMs / 2);

  /**
   * Shared across tabs through localStorage.
   *
   * Somebody working in two tabs is not idle in the one they are not looking at.
   * Without this, the background tab would count down and sign them out of both.
   */
  function markActive() {
    const now = Date.now();
    lastActive.current = now;
    if (storageKey) {
      try { localStorage.setItem(storageKey, String(now)); } catch { /* private mode */ }
    }
  }

  useEffect(() => {
    if (!enabled) {
      setSecondsLeft(null);
      return undefined;
    }

    firedRef.current = false;
    markActive();

    const onActivity = () => {
      // Once the warning is showing, activity alone does not dismiss it — the
      // person has to say they are still there. An accidental cursor nudge while
      // a screen sits unattended should not extend the session.
      if (secondsLeftRef.current !== null) return;
      markActive();
    };

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));

    const onVisible = () => { if (document.visibilityState === 'visible' && secondsLeftRef.current === null) markActive(); };
    document.addEventListener('visibilitychange', onVisible);

    // Another tab reporting activity counts as activity here too.
    const onStorage = (event) => {
      if (storageKey && event.key === storageKey && event.newValue) {
        const stamp = Number(event.newValue);
        if (stamp > lastActive.current) {
          lastActive.current = stamp;
          setSecondsLeft(null);
        }
      }
    };
    window.addEventListener('storage', onStorage);

    const timer = setInterval(() => {
      const idleFor = Date.now() - lastActive.current;

      if (idleFor >= idleMs) {
        if (firedRef.current) return;
        firedRef.current = true;
        setSecondsLeft(0);
        onTimeoutRef.current?.();
        return;
      }

      if (idleFor >= idleMs - warnMs) {
        setSecondsLeft(Math.ceil((idleMs - idleFor) / 1000));
      } else {
        setSecondsLeft(null);
      }
    }, TICK_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
      clearInterval(timer);
    };
  }, [enabled, idleMs, warnMs, storageKey]);

  /** Called by the warning's "I'm still here" button. */
  const staySignedIn = () => {
    setSecondsLeft(null);
    markActive();
  };

  return { secondsLeft, warning: secondsLeft !== null && secondsLeft > 0, staySignedIn };
}
