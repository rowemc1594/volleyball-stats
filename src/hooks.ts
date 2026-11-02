import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';
import { loadAppData, type AppData } from './db/repo';
import { navigate, paths } from './router';

/** Everything the screens show, kept in step with IndexedDB. `null` until the first read. */
export function useAppData(): AppData | null {
  const [data, setData] = useState<AppData | null>(null);
  useEffect(() => {
    const sub = liveQuery(loadAppData).subscribe({
      next: setData,
      error: (err) => console.error('Local database error', err),
    });
    return () => sub.unsubscribe();
  }, []);
  return data;
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
