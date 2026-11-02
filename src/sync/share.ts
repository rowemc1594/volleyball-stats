import type { AppData } from '../db/repo';
import {
  eventFromCloud,
  matchFromCloud,
  playerFromCloud,
  setFromCloud,
  type CloudRow,
} from './mapping';
import { supabase } from './supabase';

export interface ShareLink {
  id: string;
  token: string;
  label: string;
  createdAt: string;
  revokedAt: string | null;
  lastViewedAt: string | null;
}

/** 32 random bytes as URL-safe text (43 characters, 256 bits): impossible to guess. */
export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * The address a viewer opens. The secret is after the #, which browsers never send to a
 * server, so not even GitHub Pages' logs can see it.
 */
export function shareUrl(token: string, base: string = new URL(import.meta.env.BASE_URL, location.origin).href): string {
  return `${base.replace(/\/?$/, '/')}#/share/${encodeURIComponent(token)}`;
}

/** What get_shared_stats returns, turned into the same shape the screens already use. */
export function parseSharedStats(json: unknown): AppData | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as { player?: CloudRow | null; matches?: CloudRow[]; sets?: CloudRow[]; events?: CloudRow[] };
  const matches = (j.matches ?? [])
    .map(matchFromCloud)
    .sort((a, b) => b.matchDate.localeCompare(a.matchDate) || b.createdAt.localeCompare(a.createdAt));
  return {
    player: j.player ? playerFromCloud(j.player) : undefined,
    matches,
    sets: (j.sets ?? []).map(setFromCloud).sort((a, b) => a.setNumber - b.setNumber),
    events: (j.events ?? []).map(eventFromCloud),
  };
}

export type SharedResult =
  | { ok: true; data: AppData }
  | { ok: false; reason: 'revoked' | 'unavailable' | 'offline' };

/** Viewer side. No account needed: this calls the one function logged-out visitors may call. */
export async function fetchSharedStats(token: string): Promise<SharedResult> {
  if (!supabase) return { ok: false, reason: 'unavailable' };
  try {
    const { data, error } = await supabase.rpc('get_shared_stats', { p_token: token });
    if (error) return { ok: false, reason: 'unavailable' };
    const parsed = parseSharedStats(data);
    return parsed ? { ok: true, data: parsed } : { ok: false, reason: 'revoked' };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

const toLink = (r: Record<string, unknown>): ShareLink => ({
  id: r.id as string,
  token: r.token as string,
  label: (r.label as string) ?? '',
  createdAt: r.created_at as string,
  revokedAt: (r.revoked_at as string | null) ?? null,
  lastViewedAt: (r.last_viewed_at as string | null) ?? null,
});

function client() {
  if (!supabase) throw new Error('Cloud sync is not set up in this build.');
  return supabase;
}

/** Owner side. These need to be signed in and online. */
export async function listShareLinks(): Promise<ShareLink[]> {
  const { data, error } = await client().from('share_links').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toLink);
}

export async function createShareLink(playerId: string, label: string): Promise<ShareLink> {
  const { data, error } = await client()
    .from('share_links')
    .insert({ player_id: playerId, token: newShareToken(), label: label.trim() })
    .select()
    .single();
  if (error) {
    // The player row must reach the cloud first (it is what the link points at).
    if (/foreign key|violates/i.test(error.message)) {
      throw new Error('Your data is still syncing. Wait a moment and try again.');
    }
    throw new Error(error.message);
  }
  return toLink(data);
}

export async function revokeShareLink(id: string): Promise<void> {
  const { error } = await client().from('share_links').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}
