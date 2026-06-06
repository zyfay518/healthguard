alter table public.profiles
    add column if not exists birth_year integer,
    add column if not exists birth_month integer;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'profiles_birth_month_range'
    ) then
        alter table public.profiles
            add constraint profiles_birth_month_range
            check (birth_month is null or birth_month between 1 and 12)
            not valid;
    end if;
end $$;

alter table public.profiles
    validate constraint profiles_birth_month_range;
