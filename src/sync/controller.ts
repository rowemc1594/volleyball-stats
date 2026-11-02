import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';
import { db } from '../db/schema';
import { syncOnce, type Cloud } from './engine';
import { cloud, supabase } from './supabase';

export type SyncPhase =
  | 'off' // built without Supabase settings: local only
  | 'signed-out'
  | 'idle'
  | 'syncing'
  | 'offline'
  | 'error';

export interface SyncState {
  phase: SyncPhase;
  /** Changes saved on this device that the cloud has not confirmed yet. */
  pending: number;
  email: string | null;
  lastSyncedAt: string | null;
  error: string | null;
}

const listeners = new Set<(s: SyncState) => void>();
let state: SyncState = {
  phase: supabase ? 'signed-out' : 'off',
  pending: 0,
  email: null,
  lastSyncedAt: null,
  error: null,
};
let userId: string | null = null;

function update(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function getSyncState(): SyncState {
  return state;
}

export function useSyncState(): SyncState {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    setS(state);
    return () => void listeners.delete(setS);
  }, []);
  return s;
}

let running = false;
let again = false;

/** Run one sync now. If one is already running, run another right after it instead of overlapping. */
export async function syncNow(client: Cloud | null = cloud, scope: string | null = userId): Promise<void> {
  if (!client || !scope) return;
  if (running) {
    again = true;
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    update({ phase: 'offline' });
    return;
  }
  running = true;
  update({ phase: 'syncing', error: null });
  try {
    do {
      again = false;
      await syncOnce(client, scope);
    } while (again);
    update({ phase: 'idle', lastSyncedAt: new Date().toISOString(), error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A failed fetch with no network is "offline", not a fault.
    const offline = navigator.onLine === false || /failed to fetch|network|load failed/i.test(message);
    update({ phase: offline ? 'offline' : 'error', error: offline ? null : message });
  } finally {
    running = false;
  }
}

/** Ask for a one-time code by email. The email must contain {{ .Token }} (see docs/SUPABASE.md). */
export async function requestCode(email: string): Promise<void> {
  if (!supabase) throw new Error('Cloud sync is not set up in this build.');
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  if (error) throw new Error(error.message);
}

export async function verifyCode(email: string, code: string): Promise<void> {
  if (!supabase) throw new Error('Cloud sync is not set up in this build.');
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

let started = false;

/** Wire up login state and the moments when a sync should happen. Call once at startup. */
export function startSync(): void {
  if (started || !supabase) return;
  started = true;

  // How many changes are waiting, kept live for the status chip.
  liveQuery(() => db.outbox.count()).subscribe({
    next: (pending) => {
      const grew = pending > state.pending;
      update({ pending });
      if (grew) scheduleSoon();
    },
    error: (err) => console.error('Outbox count failed', err),
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    userId = session?.user.id ?? null;
    update({ email: session?.user.email ?? null });
    if (userId) {
      update({ phase: 'idle' });
      void syncNow();
    } else {
      update({ phase: 'signed-out', error: null });
    }
  });

  // iOS has no background sync, so sync whenever the app comes back or the network returns.
  addEventListener('online', () => void syncNow());
  addEventListener('offline', () => userId && update({ phase: 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, 30_000);
}

let soon: ReturnType<typeof setTimeout> | undefined;
/** After a tap, wait a moment so a burst of taps goes out as one batch. */
function scheduleSoon() {
  clearTimeout(soon);
  soon = setTimeout(() => void syncNow(), 1500);
}
