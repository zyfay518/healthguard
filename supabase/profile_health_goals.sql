alter table public.profiles
  add column if not exists health_goals jsonb;
