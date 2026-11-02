-- Side Out Stats: database setup (Phase 4).
-- Paste this whole file into the Supabase SQL Editor and click Run.
-- It is safe to run more than once.
--
-- Privacy model: every row belongs to one logged-in owner (owner_id). Row-level security
-- lets an owner see and change only their own rows. The anonymous (logged-out) role gets
-- nothing at all. Viewer access arrives in Phase 5 through a separate, revocable share link.

create table if not exists public.players (
  id          uuid primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null default 'Son',
  jersey      text not null default '',
  updated_at  timestamptz not null default now()
);

create table if not exists public.matches (
  id          uuid primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  opponent    text not null,
  match_date  date not null,
  event       text not null default '',
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  updated_at  timestamptz not null default now()
);

create table if not exists public.sets (
  id          uuid primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  match_id    uuid not null references public.matches (id) on delete cascade,
  set_number  integer not null check (set_number >= 1),
  score_us    integer check (score_us >= 0),
  score_them  integer check (score_them >= 0),
  updated_at  timestamptz not null default now()
);

create table if not exists public.events (
  id          uuid primary key,
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  match_id    uuid not null references public.matches (id) on delete cascade,
  set_id      uuid not null references public.sets (id) on delete cascade,
  kind        text not null check (kind in ('pass', 'serve', 'hit')),
  value       text not null,
  occurred_at timestamptz not null,
  deleted_at  timestamptz,
  updated_at  timestamptz not null default now(),
  check (
    (kind = 'pass'  and value in ('0', '1', '2', '3')) or
    (kind = 'serve' and value in ('ace', 'in', 'error')) or
    (kind = 'hit'   and value in ('kill', 'in', 'error'))
  )
);

create index if not exists matches_owner_updated on public.matches (owner_id, updated_at);
create index if not exists sets_match on public.sets (match_id);
create index if not exists events_match on public.events (match_id);
create index if not exists events_owner_updated on public.events (owner_id, updated_at);

-- The server stamps updated_at on every write. The app uses it to fetch only what changed.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['players', 'matches', 'sets', 'events'] loop
    execute format('drop trigger if exists touch_updated_at on public.%I', t);
    execute format(
      'create trigger touch_updated_at before insert or update on public.%I
         for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Row-level security: owners only, nothing for anonymous visitors.
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.sets    enable row level security;
alter table public.events  enable row level security;

revoke all on public.players, public.matches, public.sets, public.events from anon;
grant select, insert, update on public.players, public.matches, public.sets, public.events to authenticated;

do $$
declare t text;
begin
  foreach t in array array['players', 'matches', 'sets', 'events'] loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated
         using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
  end loop;
end $$;
