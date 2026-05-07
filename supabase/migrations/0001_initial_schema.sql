-- DolarDashboard — initial schema.
-- Idempotent: safe to re-run.
-- Schema preserved from the original Vegas Sales repo so any prior backend
-- (or Apps Script) keeps working without changes.

-- ---------- Tables ----------

create table if not exists public.teams (
  id text primary key,
  name text not null,
  goal numeric not null default 50000,
  icon_url text,
  display_order integer not null default 0
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  photo_url text,
  song_url text,
  song_start_seconds numeric not null default 0,
  team_id text not null references public.teams(id) on delete restrict,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agents_team_id_idx on public.agents(team_id);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null
);

-- updated_at trigger for agents
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agents_touch_updated_at on public.agents;
create trigger agents_touch_updated_at
before update on public.agents
for each row execute function public.touch_updated_at();

-- ---------- RLS ----------

alter table public.agents enable row level security;
alter table public.teams enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "agents read public" on public.agents;
create policy "agents read public" on public.agents for select using (true);
drop policy if exists "agents write authenticated" on public.agents;
create policy "agents write authenticated" on public.agents
  for all to authenticated using (true) with check (true);

drop policy if exists "teams read public" on public.teams;
create policy "teams read public" on public.teams for select using (true);
drop policy if exists "teams write authenticated" on public.teams;
create policy "teams write authenticated" on public.teams
  for all to authenticated using (true) with check (true);

drop policy if exists "app_settings read public" on public.app_settings;
create policy "app_settings read public" on public.app_settings for select using (true);
drop policy if exists "app_settings write authenticated" on public.app_settings;
create policy "app_settings write authenticated" on public.app_settings
  for all to authenticated using (true) with check (true);

-- ---------- Storage buckets ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agent-photos', 'agent-photos', true, null,
        array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = null,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agent-songs', 'agent-songs', true, null,
        array['audio/mpeg','audio/mp3','audio/wav','audio/ogg','audio/aac','audio/mp4'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = null,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "agent assets read public" on storage.objects;
create policy "agent assets read public" on storage.objects
  for select using (bucket_id in ('agent-photos','agent-songs'));

drop policy if exists "agent assets write authenticated" on storage.objects;
create policy "agent assets write authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('agent-photos','agent-songs'));

drop policy if exists "agent assets update authenticated" on storage.objects;
create policy "agent assets update authenticated" on storage.objects
  for update to authenticated
  using (bucket_id in ('agent-photos','agent-songs'))
  with check (bucket_id in ('agent-photos','agent-songs'));

drop policy if exists "agent assets delete authenticated" on storage.objects;
create policy "agent assets delete authenticated" on storage.objects
  for delete to authenticated
  using (bucket_id in ('agent-photos','agent-songs'));
