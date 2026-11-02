import { useEffect } from 'preact/hooks';

/** The slice of the Wake Lock API we use, so tests can stand in for the browser. */
export interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}
export interface WakeLockApi {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}
export interface VisibilityDoc {
  hidden: boolean;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

/**
 * Keeps the screen on. The browser drops the lock whenever the page is hidden
 * (switching apps, locking the phone), so it is asked for again when the page
 * comes back. Returns a function that stops everything.
 */
export function holdScreenAwake(wakeLock: WakeLockApi | undefined, doc: VisibilityDoc): () => void {
  if (!wakeLock) return () => {};
  let sentinel: WakeLockSentinelLike | null = null;
  let stopped = false;
  let requesting = false;

  const acquire = async () => {
    if (stopped || requesting || sentinel || doc.hidden) return;
    requesting = true;
    try {
      const s = await wakeLock.request('screen');
      if (stopped) {
        await s.release();
        return;
      }
      sentinel = s;
      s.addEventListener('release', () => {
        if (sentinel === s) sentinel = null;
      });
    } catch {
      // Refused (low battery, unsupported, not visible). Tracking works either way.
    } finally {
      requesting = false;
    }
  };

  const onVisibility = () => {
    if (!doc.hidden) void acquire();
  };
  doc.addEventListener('visibilitychange', onVisibility);
  void acquire();

  return () => {
    stopped = true;
    doc.removeEventListener('visibilitychange', onVisibility);
    const s = sentinel;
    sentinel = null;
    void s?.release().catch(() => {});
  };
}

/** Keep the screen awake while `active` is true. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return holdScreenAwake((navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock, document);
  }, [active]);
}
