-- =====================================================================
-- Convene: database setup for Supabase (PostgreSQL)
--
-- HOW TO RUN: Supabase Dashboard > SQL Editor > New query > paste this
-- whole file > Run. Expected result: "Success. No rows returned".
-- It is safe to run again later (it will not duplicate or wipe data).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

-- One profile per login account. Created automatically by a trigger (section 3).
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 80),
  bio         text not null default '' check (char_length(bio) <= 300),
  created_at  timestamptz not null default now()
);

-- Events. registered_count is maintained by triggers, never by the browser.
create table if not exists public.events (
  id                uuid primary key default gen_random_uuid(),
  organizer_id      uuid not null references public.profiles (id) on delete cascade,
  title             text not null check (char_length(title) between 3 and 120),
  description       text not null default '' check (char_length(description) <= 5000),
  category          text not null default 'Other' check (char_length(category) between 1 and 40),
  location          text not null check (char_length(location) between 2 and 160),
  image_url         text check (image_url is null or image_url ~* '^https://[^[:space:]]+$'),
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  capacity          integer check (capacity is null or capacity > 0),
  registered_count  integer not null default 0 check (registered_count >= 0),
  status            text not null default 'published' check (status in ('published', 'cancelled')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint events_dates_ok    check (ends_at > starts_at),
  constraint events_capacity_ok check (capacity is null or registered_count <= capacity)
);

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_organizer_idx on public.events (organizer_id);

-- Who registered for what. One row per person per event.
create table if not exists public.registrations (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  checked_in     boolean not null default false,
  checked_in_at  timestamptz,
  created_at     timestamptz not null default now(),
  constraint registrations_one_per_user unique (event_id, user_id)
);

create index if not exists registrations_user_idx on public.registrations (user_id);


-- ---------------------------------------------------------------------
-- 2. TRIGGER FUNCTIONS
-- ---------------------------------------------------------------------

-- Keep events.updated_at fresh.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();


-- When someone signs up, create their profile (name comes from the sign-up form).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles for anyone who signed up before this script was run.
insert into public.profiles (id, full_name)
select u.id, left(coalesce(u.raw_user_meta_data ->> 'full_name', ''), 80)
from auth.users u
on conflict (id) do nothing;


-- Registering: lock the event row, check the rules, count the seat.
-- Doing this in the database makes overbooking impossible, even if two
-- people click "Register" for the last seat at the same moment.
create or replace function public.handle_registration_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev public.events%rowtype;
begin
  select * into ev from public.events where id = new.event_id for update;

  if not found then
    raise exception 'Event not found';
  end if;
  if ev.status <> 'published' then
    raise exception 'Registration is closed: this event has been cancelled';
  end if;
  if ev.starts_at <= now() then
    raise exception 'Registration is closed: this event has already started';
  end if;
  if ev.capacity is not null and ev.registered_count >= ev.capacity then
    raise exception 'Sorry, this event is full';
  end if;

  update public.events
     set registered_count = registered_count + 1
   where id = new.event_id;

  return new;
end;
$$;

drop trigger if exists registrations_before_insert on public.registrations;
create trigger registrations_before_insert
  before insert on public.registrations
  for each row execute function public.handle_registration_insert();


-- Cancelling a registration frees the seat.
create or replace function public.handle_registration_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.events
     set registered_count = greatest(registered_count - 1, 0)
   where id = old.event_id;
  return old;
end;
$$;

drop trigger if exists registrations_after_delete on public.registrations;
create trigger registrations_after_delete
  after delete on public.registrations
  for each row execute function public.handle_registration_delete();

-- These functions only run as triggers. Nobody should call them from the API.
revoke execute on function public.handle_new_user()            from public, anon, authenticated;
revoke execute on function public.handle_registration_insert() from public, anon, authenticated;
revoke execute on function public.handle_registration_delete() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. ORGANIZER-ONLY ATTENDEE LIST (includes emails)
--    Emails live in the private auth schema, so this goes through a
--    function that first checks the caller is the event's organizer.
-- ---------------------------------------------------------------------
create or replace function public.get_event_attendees(p_event_id uuid)
returns table (
  registration_id  uuid,
  user_id          uuid,
  full_name        text,
  email            text,
  registered_at    timestamptz,
  checked_in       boolean,
  checked_in_at    timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.organizer_id = (select auth.uid())
  ) then
    raise exception 'Not allowed';
  end if;

  return query
    select r.id, r.user_id, p.full_name, u.email::text, r.created_at, r.checked_in, r.checked_in_at
    from public.registrations r
    join public.profiles p on p.id = r.user_id
    join auth.users u      on u.id = r.user_id
    where r.event_id = p_event_id
    order by r.created_at;
end;
$$;

revoke execute on function public.get_event_attendees(uuid) from public, anon;
grant  execute on function public.get_event_attendees(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (who can do what)
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.events         enable row level security;
alter table public.registrations  enable row level security;

-- profiles: names are public (shown as "Hosted by"), only you can edit yours.
drop policy if exists "profiles are readable by everyone" on public.profiles;
create policy "profiles are readable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "users update their own profile" on public.profiles;
create policy "users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- events: everyone can browse; only the organizer can create/change/delete theirs.
drop policy if exists "events are readable by everyone" on public.events;
create policy "events are readable by everyone"
  on public.events for select
  to anon, authenticated
  using (true);

drop policy if exists "users create their own events" on public.events;
create policy "users create their own events"
  on public.events for insert
  to authenticated
  with check (organizer_id = (select auth.uid()));

drop policy if exists "organizers update their events" on public.events;
create policy "organizers update their events"
  on public.events for update
  to authenticated
  using (organizer_id = (select auth.uid()))
  with check (organizer_id = (select auth.uid()));

drop policy if exists "organizers delete their events" on public.events;
create policy "organizers delete their events"
  on public.events for delete
  to authenticated
  using (organizer_id = (select auth.uid()));

-- registrations: you see your own; an organizer sees those for their events.
drop policy if exists "see own or hosted registrations" on public.registrations;
create policy "see own or hosted registrations"
  on public.registrations for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.events e
      where e.id = registrations.event_id and e.organizer_id = (select auth.uid())
    )
  );

drop policy if exists "users register themselves" on public.registrations;
create policy "users register themselves"
  on public.registrations for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "users cancel their own registration" on public.registrations;
create policy "users cancel their own registration"
  on public.registrations for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "organizers check people in" on public.registrations;
create policy "organizers check people in"
  on public.registrations for update
  to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = registrations.event_id and e.organizer_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = registrations.event_id and e.organizer_id = (select auth.uid())
    )
  );


-- ---------------------------------------------------------------------
-- 5. TABLE AND COLUMN PERMISSIONS (extra safety on top of the policies)
--    Start from nothing, then grant only what the website needs. Nobody
--    can fake registered_count, move an event to another organizer, or
--    edit who registered. (Spelling every grant out also means this works
--    whether or not your project auto-exposes new tables.)
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

revoke all on public.profiles, public.events, public.registrations from anon, authenticated;

-- Visitors who are not logged in can browse events and see organizer names.
grant select on public.profiles, public.events to anon;

-- Logged-in users:
grant select on public.profiles, public.events, public.registrations to authenticated;
grant update (full_name, bio) on public.profiles to authenticated;

grant insert (organizer_id, title, description, category, location, image_url, starts_at, ends_at, capacity)
  on public.events to authenticated;
grant update (title, description, category, location, image_url, starts_at, ends_at, capacity, status)
  on public.events to authenticated;
grant delete on public.events to authenticated;

grant insert (event_id, user_id) on public.registrations to authenticated;
grant update (checked_in, checked_in_at) on public.registrations to authenticated;
grant delete on public.registrations to authenticated;

-- Server-side admin role (not used by the website, kept for the Supabase dashboard).
grant all on public.profiles, public.events, public.registrations to service_role;
