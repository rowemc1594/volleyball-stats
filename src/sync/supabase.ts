import { createClient } from '@supabase/supabase-js';
import type { Cloud } from './engine';

// Both values are public by design: the key can do nothing the row-level security rules forbid.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null when the app was built without Supabase settings: it then works as a local-only app. */
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // Sign-in is by typed code, not a link. The link would open in Safari, which on iPhone
          // is a different storage area from the installed app, so the app would never see it.
          detectSessionInUrl: false,
        },
      })
    : null;

export const cloud: Cloud | null = supabase
  ? {
      async upsert(table, rows) {
        const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
        if (error) throw new Error(error.message);
      },
      async fetchChanged(table, since, from, to) {
        let query = supabase.from(table).select('*');
        if (since) query = query.gte('updated_at', since);
        const { data, error } = await query.order('updated_at').order('id').range(from, to);
        if (error) throw new Error(error.message);
        return data ?? [];
      },
    }
  : null;
