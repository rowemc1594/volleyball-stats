-- Side Out Stats: sharing (Phase 5).
-- Run this in the Supabase SQL Editor AFTER schema.sql. It is safe to run more than once.
--
-- How sharing stays private:
--  * A share link is a long random secret (the "token"). Only the owner can see, create or
--    revoke links (row-level security on share_links).
--  * Logged-out viewers never touch the tables. They call ONE function, get_shared_stats(token),
--    which checks the token is real and not revoked, and returns that player's stats only.
--  * Revoking a link takes effect immediately: the next call returns nothing.

create table if not exists public.share_links (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  player_id      uuid not null references public.players (id) on delete cascade,
  token          text not null unique check (length(token) >= 32),
  label          text not null default '',
  created_at     timestamptz not null default now(),
  revoked_at     timestamptz,
  last_viewed_at timestamptz
);

create index if not exists share_links_owner on public.share_links (owner_id);

alter table public.share_links enable row level security;

revoke all on public.share_links from anon;
grant select, insert, update on public.share_links to authenticated;

drop policy if exists owner_all on public.share_links;
create policy owner_all on public.share_links for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- The only door for viewers. SECURITY DEFINER lets it read the tables on the viewer's behalf,
-- so it must stay small and must only ever return data for the token it was given.
create or replace function public.get_shared_stats(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  link   public.share_links;
  result jsonb;
begin
  select * into link
  from public.share_links
  where token = p_token and revoked_at is null;

  if not found then
    return null;
  end if;

  -- Note when it was last opened (at most every 5 minutes, so polling does not hammer the table).
  if link.last_viewed_at is null or link.last_viewed_at < now() - interval '5 minutes' then
    update public.share_links set last_viewed_at = now() where id = link.id;
  end if;

  select jsonb_build_object(
    'player', (
      select to_jsonb(p) - 'owner_id' - 'updated_at'
      from public.players p where p.id = link.player_id
    ),
    'matches', coalesce((
      select jsonb_agg(to_jsonb(m) - 'owner_id' - 'updated_at' order by m.match_date, m.created_at)
      from public.matches m
      where m.player_id = link.player_id and m.deleted_at is null
    ), '[]'::jsonb),
    'sets', coalesce((
      select jsonb_agg(to_jsonb(s) - 'owner_id' - 'updated_at')
      from public.sets s
      join public.matches m on m.id = s.match_id
      where m.player_id = link.player_id and m.deleted_at is null
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) - 'owner_id' - 'updated_at')
      from public.events e
      join public.matches m on m.id = e.match_id
      where m.player_id = link.player_id and m.deleted_at is null and e.deleted_at is null
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- Functions are callable by everyone by default; say exactly who may call this one.
revoke all on function public.get_shared_stats(text) from public;
grant execute on function public.get_shared_stats(text) to anon, authenticated;
