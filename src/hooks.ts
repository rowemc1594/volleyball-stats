import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';
import { loadAppData, type AppData } from './db/repo';
import { db } from './db/schema';
import { navigate, paths } from './router';

/**
 * Everything the screens show, kept in step with IndexedDB. `data` is null until the first read.
 * `failed` is true when the browser will not open local storage (for example a private window).
 */
export function useAppData(): { data: AppData | null; failed: boolean } {
  const [data, setData] = useState<AppData | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // A live query waits quietly if the database cannot open, so ask directly.
    db.open().catch((err) => {
      console.error('Local database could not open', err);
      setFailed(true);
    });
    const sub = liveQuery(loadAppData).subscribe({
      next: (d) => {
        setFailed(false);
        setData(d);
      },
      error: (err) => {
        console.error('Local database error', err);
        setFailed(true);
      },
    });
    return () => sub.unsubscribe();
  }, []);
  return { data, failed };
}

/**
 * Go back to Matches if a match from the address bar does not exist (deleted, or a bad link).
 * Waits a moment first: right after a match is created the screen can open a tick before
 * the live query has caught up.
 */
export function useLeaveIfMissing(exists: boolean): void {
  useEffect(() => {
    if (exists) return;
    const t = setTimeout(() => navigate(paths.matches), 1000);
    return () => clearTimeout(t);
  }, [exists]);
}

type Listener =(message: string | null) => void;
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(message: string): void {
  listeners.forEach((l) => l(message));
  clearTimeout(timer);
  timer = setTimeout(() => listeners.forEach((l) => l(null)), 1800);
}

export function useToast(): string | null {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    listeners.add(setMessage);
    return () => void listeners.delete(setMessage);
  }, []);
  return message;
}
