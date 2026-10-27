alter table public.songs
  add column if not exists play_count integer not null default 0
  check (play_count >= 0);

do $$
declare
  song_id_type text;
begin
  select format_type(attribute.atttypid, attribute.atttypmod)
    into song_id_type
    from pg_attribute as attribute
   where attribute.attrelid = 'public.songs'::regclass
     and attribute.attname = 'id'
     and not attribute.attisdropped;

  if song_id_type is null then
    raise exception 'Could not find public.songs.id';
  end if;

  execute format(
    'create table if not exists public.favorites (
       user_id uuid not null references auth.users(id) on delete cascade,
       song_id %s not null references public.songs(id) on delete cascade,
       created_at timestamptz not null default now(),
       primary key (user_id, song_id)
     )',
    song_id_type
  );

  execute format(
    'create table if not exists public.play_events (
       id bigint generated always as identity primary key,
       user_id uuid not null references auth.users(id) on delete cascade,
       song_id %s not null references public.songs(id) on delete cascade,
       created_at timestamptz not null default now()
     )',
    song_id_type
  );
end
$$;

create index if not exists play_events_song_user_created_idx
  on public.play_events (song_id, user_id, created_at desc);

alter table public.favorites enable row level security;
alter table public.play_events enable row level security;

drop policy if exists "Users can read their own favorites" on public.favorites;
create policy "Users can read their own favorites"
  on public.favorites for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can add their own favorites" on public.favorites;
create policy "Users can add their own favorites"
  on public.favorites for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own favorites" on public.favorites;
create policy "Users can remove their own favorites"
  on public.favorites for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.play_events from public, anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;

create or replace function public.prevent_direct_play_count_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.play_count is distinct from old.play_count
     and coalesce(current_setting('xin_audio.recording_play', true), '') <> 'on' then
    raise exception 'play_count can only be changed by record_song_play';
  end if;
  return new;
end
$$;

drop trigger if exists protect_song_play_count on public.songs;
create trigger protect_song_play_count
  before update of play_count on public.songs
  for each row
  execute function public.prevent_direct_play_count_change();

create or replace function public.record_song_play(p_song_id text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  current_user_id uuid := auth.uid();
  inserted_rows integer;
begin
  if current_user_id is null then
    raise exception 'Sign in to record a play';
  end if;

  if p_song_id is null or p_song_id = '' then
    raise exception 'A song ID is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(current_user_id::text || ':' || p_song_id, 0)
  );

  if exists (
    select 1
      from public.play_events as event
     where event.user_id = current_user_id
       and event.song_id::text = p_song_id
       and event.created_at > now() - interval '30 minutes'
  ) then
    return false;
  end if;

  insert into public.play_events (user_id, song_id)
  select current_user_id, song.id
    from public.songs as song
   where song.id::text = p_song_id;

  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then
    raise exception 'Song not found';
  end if;

  perform set_config('xin_audio.recording_play', 'on', true);
  update public.songs
     set play_count = coalesce(play_count, 0) + 1
   where id::text = p_song_id;

  return true;
end
$$;

revoke all on function public.record_song_play(text) from public, anon;
grant execute on function public.record_song_play(text) to authenticated;

revoke all on function public.prevent_direct_play_count_change() from public, anon, authenticated;
