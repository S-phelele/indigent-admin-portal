import { useCallback, useRef, useState } from 'react';
import api from '../services/api';

/**
 * One upload at a time, with the true byte count and a way to stop it.
 *
 * Three places in this portal post a file, and each had its own `busyId` and
 * nothing else — no percentage, no size, no way to abort. Written once here so
 * the three cannot drift, and so the "never invent a percentage" rule lives in
 * a single place rather than being re-decided at each call site.
 *
 * `progress.fraction` is null when the browser cannot report a total. Callers
 * pass that straight to UploadProgress, which falls back to an indeterminate
 * state rather than dividing by a guess.
 */
export default function useUpload() {
  const [progress, setProgress] = useState(null);
  const [done, setDone] = useState(null);
  const abortRef = useRef(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /**
   * Post `formData` and report progress against `key`.
   *
   * Resolves with the response, or with `{ cancelled: true }` when the
   * applicant stopped it — a cancellation is a choice, not a failure, and
   * callers must not show it as an error.
   */
  const upload = useCallback(async (key, url, formData, { fileName, size } = {}) => {
    const controller = new AbortController();
    abortRef.current = controller;

    setProgress({ key, fraction: 0, loaded: 0, total: size ?? null, fileName });

    try {
      const res = await api.post(url, formData, {
        signal: controller.signal,
        /**
         * A weak connection legitimately takes minutes for a 10 MB scan. The
         * instance default would cut off uploads that were going to succeed,
         * and the only thing worse than a slow upload is a slow upload thrown
         * away at the end.
         */
        timeout: 180000,
        onUploadProgress: (event) => {
          const total = event.total ?? size ?? null;
          setProgress({
            key,
            fraction: total ? event.loaded / total : null,
            loaded: event.loaded,
            total,
            fileName,
          });
        },
      });

      // Held briefly as a tick, so the applicant sees it finish rather than the
      // row simply vanishing.
      setDone(key);
      setTimeout(() => setDone((current) => (current === key ? null : current)), 1600);

      return res;
    } catch (err) {
      if (err?.code === 'ERR_CANCELED') return { cancelled: true };
      throw err;
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  }, []);

  return { progress, done, upload, cancel };
}
