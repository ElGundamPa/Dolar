-- Default teams + dashboard tunables.
-- The admin user must be created via the Supabase Auth dashboard
-- (Authentication → Users → Add user) — there is no public signup.
-- The Apps Script URL lives as an Edge Function secret (APPS_SCRIPT_URL),
-- not in this table.

insert into public.teams (id, name, goal, display_order) values
  ('mesa-1', 'Mesa 1', 50000, 1),
  ('mesa-2', 'Mesa 2', 50000, 2),
  ('mesa-3', 'Mesa 3', 30000, 3)
on conflict (id) do nothing;

insert into public.app_settings (key, value) values
  ('polling_interval_seconds', '10'::jsonb),
  ('jackpot_duration_seconds', '10'::jsonb)
on conflict (key) do nothing;
