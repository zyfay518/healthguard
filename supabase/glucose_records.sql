create table if not exists public.glucose_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  value numeric(4, 1) not null check (value >= 0 and value <= 40),
  unit text not null default 'mmol/L' check (unit = 'mmol/L'),
  measurement_context text check (measurement_context in ('fasting', 'pre_meal', 'post_meal', 'random')),
  post_meal_timing text check (post_meal_timing in ('within_30_min', 'one_hour', 'two_hours', 'over_two_hours')),
  note text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists glucose_records_user_recorded_at_idx
  on public.glucose_records (user_id, recorded_at desc);

alter table public.glucose_records enable row level security;

create policy "Users can read own glucose records"
  on public.glucose_records
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own glucose records"
  on public.glucose_records
  for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own glucose records"
  on public.glucose_records
  for delete
  using (auth.uid() = user_id);
