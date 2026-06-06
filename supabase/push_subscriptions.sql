create table if not exists public.push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    endpoint text not null unique,
    subscription jsonb not null,
    user_agent text,
    enabled boolean not null default true,
    last_sent_at timestamptz,
    last_sent_key text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_enabled_idx
    on public.push_subscriptions (user_id, enabled);

alter table public.push_subscriptions enable row level security;

create policy "Users can view own push subscriptions"
    on public.push_subscriptions
    for select
    using (auth.uid() = user_id);

create policy "Users can insert own push subscriptions"
    on public.push_subscriptions
    for insert
    with check (auth.uid() = user_id);

create policy "Users can update own push subscriptions"
    on public.push_subscriptions
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete own push subscriptions"
    on public.push_subscriptions
    for delete
    using (auth.uid() = user_id);
