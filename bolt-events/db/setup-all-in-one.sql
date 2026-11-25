-- =====================================================================================
-- Bolt Events: complete database setup for a NEW database (Supabase SQL editor)
-- Generated from db/migrations by scripts/build-setup-sql.mjs. Do not edit by hand.
--
-- 1. Change the three values in the SETTINGS block just below.
-- 2. Paste this whole file into Supabase: SQL Editor, New query. Click Run.
-- 3. The result shows your admin "set password" link (valid 72 hours). Open it once the site is live.
-- Run it once. Later updates use: npm run db:migrate (it skips what this script already applied).
-- =====================================================================================

begin;

create temp table bolt_setup (k text primary key, v text not null);
insert into bolt_setup values
  ('admin_email',  'you@example.com'),                 -- <- your admin sign-in email
  ('app_password', 'CHANGE-ME-to-a-long-random-password'), -- <- password for the bolt_app database login (save it: it goes in DATABASE_URL)
  ('site_url',     'https://events.example.com');      -- <- your website address, no trailing slash

do $$ begin
  if (select v from bolt_setup where k = 'admin_email') = 'you@example.com' then raise exception 'Edit admin_email in the SETTINGS block first.'; end if;
  if (select v from bolt_setup where k = 'app_password') like 'CHANGE-ME%' or length((select v from bolt_setup where k = 'app_password')) < 16 then raise exception 'Set app_password to a random password of at least 16 characters (letters and digits).'; end if;
  if (select v from bolt_setup where k = 'app_password') !~ '^[A-Za-z0-9._~-]+$' then raise exception 'Use only letters, digits and . _ ~ - in app_password, so it works inside DATABASE_URL.'; end if;
  if (select v from bolt_setup where k = 'site_url') !~ '^https://[^/]+$' then raise exception 'site_url must look like https://events.example.com (no trailing slash).'; end if;
  if exists (select 1 from pg_namespace where nspname = 'bolt') then raise exception 'This database already has Bolt Events. Use npm run db:migrate for updates.'; end if;
end $$;

create schema bolt;
create table bolt.schema_migrations (name text primary key, applied_at timestamptz not null default now());
alter table bolt.schema_migrations enable row level security;

-- ===== 001_schema.sql =====
-- Bolt Events: tables, constraints, indexes.
-- Everything lives in its own "bolt" schema so that hosted platforms that expose
-- the public schema over an API (e.g. Supabase) never expose these tables.
create schema if not exists bolt;
set local search_path = bolt, pg_temp;

create type user_role         as enum ('admin', 'staff');
create type event_type        as enum ('offline', 'online');
create type event_visibility  as enum ('public', 'unlisted');
create type event_status      as enum ('draft', 'published', 'completed', 'cancelled');
create type slot_status       as enum ('active', 'blocked');
create type booking_status    as enum ('confirmed', 'rescheduled', 'cancelled');
create type attendance_status as enum ('not_checked_in', 'checked_in', 'attended', 'no_show');
create type notif_type as enum ('booking_confirmation', 'booking_cancellation', 'booking_rescheduling',
                                'appointment_reminder', 'event_reminder', 'staff_assignment');
create type notif_channel as enum ('email', 'whatsapp', 'aisensy', 'pabbly');
create type notif_status  as enum ('pending', 'sending', 'sent', 'failed', 'not_configured', 'cancelled');

create table profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) <= 254),
  full_name text not null check (length(full_name) between 2 and 100),
  role user_role not null,
  password_hash text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_key on profiles (lower(email));

create table sessions (
  token_hash bytea primary key,
  profile_id uuid not null references profiles on delete cascade,
  ip text,
  user_agent text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_profile_idx on sessions (profile_id);

create table auth_tokens (
  token_hash bytea primary key,
  profile_id uuid not null references profiles on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index auth_tokens_profile_idx on auth_tokens (profile_id);

create table staff (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles on delete cascade,
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  designation text check (length(designation) <= 100),
  can_reschedule boolean not null default false,
  auto_assign boolean not null default true,
  max_daily_reservations int not null default 50 check (max_daily_reservations between 1 and 1000),
  working_days int[] not null default '{1,2,3,4,5,6,7}' check (working_days <@ array[1,2,3,4,5,6,7]),
  work_start time not null default '00:00',
  work_end time not null default '23:59',
  unavailable_dates date[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (work_end > work_start)
);

create table events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120),
  name text not null check (length(name) between 2 and 150),
  description text not null default '' check (length(description) <= 5000),
  banner_version int not null default 0,
  location text not null default '' check (length(location) <= 300),
  event_type event_type not null default 'offline',
  meeting_link text check (meeting_link is null or meeting_link ~ '^https?://'),
  start_date date not null,
  end_date date not null,
  daily_start_time time not null,
  daily_end_time time not null,
  slot_duration_min int not null check (slot_duration_min between 5 and 720),
  buffer_min int not null default 0 check (buffer_min between 0 and 240),
  capacity_per_slot int not null default 1 check (capacity_per_slot between 1 and 1000),
  registration_deadline timestamptz,
  visibility event_visibility not null default 'public',
  status event_status not null default 'draft',
  auto_assign_staff boolean not null default false,
  created_by uuid references profiles on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (end_date - start_date <= 366),
  check (daily_end_time > daily_start_time)
);
create index events_status_idx on events (status, visibility, start_date);

create table event_banners (
  event_id uuid primary key references events on delete cascade,
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  data bytea not null check (octet_length(data) <= 2097152),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table event_dates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  slot_duration_min int not null check (slot_duration_min between 5 and 720),
  buffer_min int not null default 0 check (buffer_min between 0 and 240),
  capacity int not null check (capacity between 1 and 1000),
  is_blocked boolean not null default false,
  booking_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, date),
  unique (id, event_id),
  check (end_time > start_time)
);

create table availability_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  event_date_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int not null check (capacity between 1 and 1000),
  booked_count int not null default 0,
  status slot_status not null default 'active',
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_date_id, event_id) references event_dates (id, event_id) on delete cascade,
  unique (id, event_id),
  unique (event_date_id, starts_at, ends_at),
  check (ends_at > starts_at),
  -- The final word on overbooking: no transaction can commit past this.
  constraint slot_not_overbooked check (booked_count between 0 and capacity)
);
create index slots_event_start_idx on availability_slots (event_id, starts_at);
create index slots_start_idx on availability_slots (starts_at);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  event_id uuid not null references events on delete restrict,
  slot_id uuid not null,
  participant_name text not null check (length(participant_name) between 2 and 100),
  mobile text not null check (mobile ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  message text check (length(message) <= 1000),
  status booking_status not null default 'confirmed',
  idempotency_key uuid not null unique,
  manage_token_hash bytea not null unique,
  cancelled_at timestamptz,
  cancel_reason text check (length(cancel_reason) <= 500),
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  fbclid text, campaign_id text, adset_id text, ad_id text, landing_page text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (slot_id, event_id) references availability_slots (id, event_id) on delete restrict
);
create index reservations_event_idx on reservations (event_id, created_at desc);
create index reservations_active_slot_idx on reservations (slot_id) where status <> 'cancelled';
create index reservations_mobile_idx on reservations (mobile);
create index reservations_created_idx on reservations (created_at desc);
create index reservations_campaign_idx on reservations (event_id, utm_source, utm_campaign);
-- The same person cannot hold the same slot twice.
create unique index reservations_no_duplicates on reservations (slot_id, mobile, lower(participant_name)) where status <> 'cancelled';

create table staff_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff on delete cascade,
  event_id uuid references events on delete cascade,
  reservation_id uuid references reservations on delete cascade,
  assigned_by uuid references profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(event_id, reservation_id) = 1),
  unique (staff_id, event_id),
  unique (reservation_id)
);
create index staff_assignments_event_idx on staff_assignments (event_id);
create index staff_assignments_staff_idx on staff_assignments (staff_id);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references reservations on delete cascade,
  status attendance_status not null default 'not_checked_in',
  checked_in_at timestamptz,
  marked_by uuid references profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index attendance_status_idx on attendance (status);

create table booking_history (
  id bigint generated always as identity primary key,
  reservation_id uuid not null references reservations on delete cascade,
  action text not null,
  actor_type text not null check (actor_type in ('participant', 'admin', 'staff', 'system')),
  actor_id uuid references profiles on delete set null,
  details jsonb not null default '{}',
  note text check (length(note) <= 2000),
  created_at timestamptz not null default now()
);
create index booking_history_res_idx on booking_history (reservation_id, created_at);

create table integration_settings (
  key text primary key,
  enabled boolean not null default false,
  config jsonb not null default '{}',
  secrets_encrypted text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table notification_templates (
  id uuid primary key default gen_random_uuid(),
  type notif_type not null,
  channel notif_channel not null,
  subject text not null default '' check (length(subject) <= 200),
  body text not null check (length(body) <= 4000),
  provider_template text check (length(provider_template) <= 200),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, channel)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  type notif_type not null,
  channel notif_channel not null,
  reservation_id uuid references reservations on delete cascade,
  staff_id uuid references staff on delete cascade,
  recipient text not null,
  status notif_status not null default 'pending',
  attempts int not null default 0,
  provider_message_id text,
  error text,
  scheduled_for timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_due_idx on notifications (scheduled_for) where status in ('pending', 'sending');
create index notifications_res_idx on notifications (reservation_id);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('meta', 'pabbly')),
  external_id text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create unique index webhook_events_external on webhook_events (source, external_id) where external_id is not null;

create table rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits int not null
);

create function touch_updated_at() returns trigger language plpgsql set search_path = bolt, pg_temp as $$
begin new.updated_at := now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['profiles','staff','events','event_banners','event_dates','availability_slots','reservations',
    'staff_assignments','attendance','integration_settings','notification_templates','notifications'] loop
    execute format('create trigger touch before update on bolt.%I for each row execute function bolt.touch_updated_at()', t);
  end loop;
end $$;
insert into bolt.schema_migrations (name) values ('001_schema.sql');
reset search_path;

-- ===== 002_security.sql =====
-- Identity helpers, Row Level Security and authentication functions.
-- The web app connects as "bolt_app": not an owner, no BYPASSRLS. Each request sets
-- app.session to the raw session token; identity is resolved from the sessions table,
-- so the app cannot impersonate anyone without a valid token.
set local search_path = bolt, pg_temp;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'bolt_app') then
    create role bolt_app login noinherit;
  end if;
end $$;

create function uid() returns uuid language sql stable security definer set search_path = bolt, pg_temp as $$
  select s.profile_id from sessions s join profiles p on p.id = s.profile_id
  where s.token_hash = sha256(convert_to(current_setting('app.session', true), 'UTF8'))
    and s.expires_at > now() and p.is_active
$$;

create function my_role() returns user_role language sql stable security definer set search_path = bolt, pg_temp as $$
  select role from profiles where id = uid()
$$;

create function is_admin() returns boolean language sql stable security definer set search_path = bolt, pg_temp as $$
  select coalesce(my_role() = 'admin', false)
$$;

create function my_staff_id() returns uuid language sql stable security definer set search_path = bolt, pg_temp as $$
  select id from staff where profile_id = uid()
$$;

-- Staff may see: reservations assigned to them personally, plus reservations of their
-- events that are not personally assigned to somebody else.
create function can_access_reservation(p_id uuid) returns boolean language sql stable security definer set search_path = bolt, pg_temp as $$
  select is_admin() or (my_staff_id() is not null and exists (
    select 1 from reservations r left join staff_assignments a on a.reservation_id = r.id
    where r.id = p_id and case when a.staff_id is not null then a.staff_id = my_staff_id()
      else exists (select 1 from staff_assignments ea where ea.event_id = r.event_id and ea.staff_id = my_staff_id()) end))
$$;

create function can_access_event(p_id uuid) returns boolean language sql stable security definer set search_path = bolt, pg_temp as $$
  select is_admin() or (my_staff_id() is not null and (
    exists (select 1 from staff_assignments where event_id = p_id and staff_id = my_staff_id())
    or exists (select 1 from staff_assignments a join reservations r on r.id = a.reservation_id
               where r.event_id = p_id and a.staff_id = my_staff_id())))
$$;

create function require_admin() returns void language plpgsql stable security definer set search_path = bolt, pg_temp as $$
begin
  if not is_admin() then raise exception 'Administrator access is required.' using errcode = 'BE403'; end if;
end $$;

do $$ declare t text; begin
  foreach t in array array['profiles','sessions','auth_tokens','staff','events','event_banners','event_dates','availability_slots',
    'reservations','staff_assignments','attendance','booking_history','notifications','notification_templates',
    'integration_settings','webhook_events','rate_limits'] loop
    execute format('alter table bolt.%I enable row level security', t);
  end loop;
  foreach t in array array['profiles','staff','events','event_banners','event_dates','availability_slots',
    'reservations','staff_assignments','attendance','booking_history','notifications','notification_templates',
    'integration_settings','webhook_events'] loop
    execute format('create policy admin_all on bolt.%I for all to bolt_app using ((select bolt.is_admin())) with check ((select bolt.is_admin()))', t);
  end loop;
end $$;

create policy own_profile on profiles for select to bolt_app using (id = (select uid()));
create policy own_staff on staff for select to bolt_app using (id = (select my_staff_id()));
create policy staff_events on events for select to bolt_app using (can_access_event(id));
create policy staff_dates on event_dates for select to bolt_app using (can_access_event(event_id));
create policy staff_slots on availability_slots for select to bolt_app using (can_access_event(event_id));
create policy staff_reservations on reservations for select to bolt_app using (can_access_reservation(id));
create policy staff_attendance on attendance for select to bolt_app using (can_access_reservation(reservation_id));
create policy staff_history on booking_history for select to bolt_app using (can_access_reservation(reservation_id));
create policy staff_own_assignments on staff_assignments for select to bolt_app using (staff_id = (select my_staff_id()));

-- Privileges: least privilege on top of RLS. Sensitive columns are never selectable.
grant usage on schema bolt to bolt_app;
grant select on staff, events, event_dates, availability_slots, staff_assignments, attendance, booking_history,
  notifications, notification_templates, integration_settings, webhook_events to bolt_app;
grant select (id, email, full_name, role, is_active, last_login_at, created_at, updated_at) on profiles to bolt_app;
grant select (id, reference, event_id, slot_id, participant_name, mobile, email, message, status, cancelled_at, cancel_reason,
  utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, campaign_id, adset_id, ad_id, landing_page,
  created_at, updated_at) on reservations to bolt_app;
grant select (event_id, mime, updated_at) on event_banners to bolt_app;
grant insert, update, delete on event_banners, notification_templates, integration_settings to bolt_app;
grant insert, delete on events to bolt_app;
grant update (name, description, banner_version, location, event_type, meeting_link, start_date, end_date, daily_start_time, daily_end_time,
  slot_duration_min, buffer_min, capacity_per_slot, registration_deadline, visibility, auto_assign_staff) on events to bolt_app;
grant insert, update, delete on event_dates to bolt_app;
grant insert (event_id, event_date_id, starts_at, ends_at, capacity, status, is_custom), delete on availability_slots to bolt_app;
grant update (starts_at, ends_at, capacity, status) on availability_slots to bolt_app;
grant update (phone, designation, can_reschedule, auto_assign, max_daily_reservations, working_days, work_start, work_end, unavailable_dates) on staff to bolt_app;
grant insert (staff_id, event_id, assigned_by), delete on staff_assignments to bolt_app;

-- Authentication -------------------------------------------------------------
create function auth_get_user(p_email text) returns table (id uuid, password_hash text, role user_role, is_active boolean)
language sql stable security definer set search_path = bolt, pg_temp as $$
  select id, password_hash, role, is_active from profiles where lower(email) = lower(trim(p_email))
$$;

create function create_session(p_profile uuid, p_token text, p_ip text, p_ua text) returns void
language plpgsql security definer set search_path = bolt, pg_temp as $$
begin
  if not exists (select 1 from profiles where id = p_profile and is_active) then
    raise exception 'Account is not active.' using errcode = 'BE403';
  end if;
  delete from sessions where expires_at < now();
  insert into sessions (token_hash, profile_id, ip, user_agent, expires_at)
  values (sha256(convert_to(p_token, 'UTF8')), p_profile, left(p_ip, 64), left(p_ua, 300), now() + interval '12 hours');
  update profiles set last_login_at = now() where id = p_profile;
end $$;

create function delete_session(p_token text) returns void language sql security definer set search_path = bolt, pg_temp as $$
  delete from sessions where token_hash = sha256(convert_to(p_token, 'UTF8'))
$$;

create function whoami() returns table (id uuid, email text, full_name text, role user_role, staff_id uuid, can_reschedule boolean)
language sql stable security definer set search_path = bolt, pg_temp as $$
  select p.id, p.email, p.full_name, p.role, s.id, coalesce(s.can_reschedule, false)
  from profiles p left join staff s on s.profile_id = p.id where p.id = uid()
$$;

create function change_own_password(p_hash text) returns void language plpgsql security definer set search_path = bolt, pg_temp as $$
begin
  if uid() is null then raise exception 'Please sign in again.' using errcode = 'BE403'; end if;
  update profiles set password_hash = p_hash where id = uid();
  delete from sessions where profile_id = uid()
    and token_hash <> sha256(convert_to(current_setting('app.session', true), 'UTF8'));
end $$;

create function update_own_staff_profile(p_name text, p_phone text) returns void language plpgsql security definer set search_path = bolt, pg_temp as $$
begin
  if my_staff_id() is null then raise exception 'Staff access is required.' using errcode = 'BE403'; end if;
  update profiles set full_name = trim(p_name) where id = uid();
  update staff set phone = p_phone where id = my_staff_id();
end $$;

create function consume_auth_token(p_token text, p_password_hash text) returns void language plpgsql security definer set search_path = bolt, pg_temp as $$
declare v uuid;
begin
  update auth_tokens set used_at = now()
  where token_hash = sha256(convert_to(p_token, 'UTF8')) and used_at is null and expires_at > now()
  returning profile_id into v;
  if v is null then raise exception 'This link is invalid or has expired. Ask your administrator for a new one.' using errcode = 'BE404'; end if;
  update profiles set password_hash = p_password_hash where id = v;
  delete from sessions where profile_id = v;
end $$;

create function admin_create_auth_token(p_profile uuid, p_token text) returns void language plpgsql security definer set search_path = bolt, pg_temp as $$
begin
  perform require_admin();
  if not exists (select 1 from profiles where id = p_profile and role = 'staff') then
    raise exception 'Staff account not found.' using errcode = 'BE404';
  end if;
  delete from auth_tokens where profile_id = p_profile;
  insert into auth_tokens (token_hash, profile_id, expires_at)
  values (sha256(convert_to(p_token, 'UTF8')), p_profile, now() + interval '72 hours');
end $$;

create function admin_create_staff(p_email text, p_name text, p_password_hash text) returns table (staff_id uuid, profile_id uuid)
language plpgsql security definer set search_path = bolt, pg_temp as $$
declare v_p uuid; v_s uuid;
begin
  perform require_admin();
  if exists (select 1 from profiles where lower(email) = lower(trim(p_email))) then
    raise exception 'An account with this email already exists.' using errcode = 'BE409';
  end if;
  insert into profiles (email, full_name, role, password_hash) values (lower(trim(p_email)), trim(p_name), 'staff', p_password_hash) returning id into v_p;
  insert into staff (profile_id) values (v_p) returning id into v_s;
  return query select v_s, v_p;
end $$;

create function admin_update_staff_account(p_staff uuid, p_email text, p_name text, p_active boolean) returns void
language plpgsql security definer set search_path = bolt, pg_temp as $$
declare v_p uuid;
begin
  perform require_admin();
  select profile_id into v_p from staff where id = p_staff;
  if v_p is null then raise exception 'Staff account not found.' using errcode = 'BE404'; end if;
  if exists (select 1 from profiles where lower(email) = lower(trim(p_email)) and id <> v_p) then
    raise exception 'An account with this email already exists.' using errcode = 'BE409';
  end if;
  update profiles set email = lower(trim(p_email)), full_name = trim(p_name), is_active = p_active where id = v_p;
  if not p_active then delete from sessions where profile_id = v_p; delete from auth_tokens where profile_id = v_p; end if;
end $$;

-- Fixed-window limiter. Returns true while the caller is within the limit.
create function rate_limit_hit(p_key text, p_limit int, p_seconds int) returns boolean
language plpgsql security definer set search_path = bolt, pg_temp as $$
declare v_hits int;
begin
  if random() < 0.01 then delete from rate_limits where window_start < now() - interval '1 day'; end if;
  insert into rate_limits as r (key, window_start, hits) values (left(p_key, 200), now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end $$;
insert into bolt.schema_migrations (name) values ('002_security.sql');
reset search_path;

-- ===== 003_booking.sql =====
-- Booking engine. Lock order everywhere: event -> event_date -> reservation -> slot (by id).
-- Business errors use SQLSTATE class "BE"; their messages are safe to show to users.
set local search_path = bolt, pg_temp;

-- booked_count is maintained by the database only; with slot_not_overbooked it makes
-- exceeding capacity impossible whatever code path writes a reservation.
create function reservation_capacity() returns trigger language plpgsql security definer set search_path = bolt, pg_temp as $$
declare v_old uuid; v_new uuid;
begin
  if tg_op <> 'INSERT' and old.status <> 'cancelled' then v_old := old.slot_id; end if;
  if tg_op <> 'DELETE' and new.status <> 'cancelled' then v_new := new.slot_id; end if;
  if v_old is not distinct from v_new then return null; end if;
  if v_old is not null then update availability_slots set booked_count = booked_count - 1 where id = v_old; end if;
  if v_new is not null then update availability_slots set booked_count = booked_count + 1 where id = v_new; end if;
  return null;
end $$;
create trigger reservation_capacity after insert or delete or update of slot_id, status on reservations
  for each row execute function reservation_capacity();

create function _log(p_res uuid, p_action text, p_actor text, p_details jsonb default '{}', p_note text default null) returns void
language sql security definer set search_path = bolt, pg_temp as $$
  insert into booking_history (reservation_id, action, actor_type, actor_id, details, note)
  values (p_res, p_action, p_actor, case when p_actor in ('admin','staff') then uid() end, p_details, p_note)
$$;

create function _actor() returns text language sql stable security definer set search_path = bolt, pg_temp as $$
  select coalesce(my_role()::text, 'participant')
$$;

create function _new_reference() returns text language plpgsql volatile set search_path = bolt, pg_temp as $$
declare a text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; b bytea; r text;
begin
  loop
    -- hash two random UUIDs so every character carries full entropy
    b := sha256(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()));
    r := 'BE-';
    for i in 0..7 loop r := r || substr(a, (get_byte(b, i) & 31) + 1, 1); end loop;
    exit when not exists (select 1 from reservations where reference = r);
  end loop;
  return r;
end $$;

create function _enqueue(p_type notif_type, p_res uuid, p_staff uuid default null, p_at timestamptz default null) returns void
language plpgsql security definer set search_path = bolt, pg_temp as $$
begin
  insert into notifications (type, channel, reservation_id, staff_id, recipient, status, scheduled_for)
  select p_type, t.channel, p_res, p_staff, rcpt, case when coalesce(i.enabled, false) then 'pending' else 'not_configured' end::notif_status,
         coalesce(p_at, now())
  from notification_templates t
  left join integration_settings i on i.key = t.channel::text
  cross join lateral (
    select case
      when t.channel = 'pabbly' then 'webhook'
      when t.channel = 'email' then case when p_staff is null then (select email from reservations where id = p_res)
                                         else (select p.email from staff s join profiles p on p.id = s.profile_id where s.id = p_staff) end
      else case when p_staff is null then (select mobile from reservations where id = p_res)
                else (select phone from staff where id = p_staff) end end as rcpt) x
  where t.type = p_type and t.is_active and rcpt is not null
    and (p_at is null or coalesce(i.enabled, false));  -- future reminders only for live channels
end $$;

create function _schedule_reminders(p_res uuid) returns void language plpgsql security definer set search_path = bolt, pg_temp as $$
declare v_start timestamptz; v_cfg jsonb; v_h int; v_d int;
begin
  update notifications set status = 'cancelled' where reservation_id = p_res and status = 'pending'
    and type in ('appointment_reminder', 'event_reminder');
  select s.starts_at into v_start from reservations r join availability_slots s on s.id = r.slot_id
  where r.id = p_res and r.status <> 'cancelled';
  if v_start is null then return; end if;
  select config into v_cfg from integration_settings where key = 'app';
  v_h := coalesce((v_cfg->>'appointment_reminder_hours')::int, 2);
  v_d := coalesce((v_cfg->>'event_reminder_hours')::int, 24);
  if v_start - make_interval(hours => v_h) > now() then
    perform _enqueue('appointment_reminder', p_res, null, v_start - make_interval(hours => v_h)); end if;
  if v_start - make_interval(hours => v_d) > now() then
    perform _enqueue('event_reminder', p_res, null, v_start - make_interval(hours => v_d)); end if;
end $$;

create function _staff_free(p_staff uuid, p_at timestamptz, p_until timestamptz) returns boolean
language sql stable security definer set search_path = bolt, pg_temp as $$
  select exists (
    select 1 from staff s join profiles p on p.id = s.profile_id,
      lateral (select p_at at time zone 'Asia/Kolkata' l, p_until at time zone 'Asia/Kolkata' u) t
    where s.id = p_staff and p.is_active
      and extract(isodow from t.l)::int = any (s.working_days)
      and not (t.l::date = any (s.unavailable_dates))
      and t.l::time >= s.work_start and t.u::time <= s.work_end
      and (select count(*) from staff_assignments a join reservations r on r.id = a.reservation_id
             join availability_slots sl on sl.id = r.slot_id
           where a.staff_id = s.id and r.status <> 'cancelled'
             and (sl.starts_at at time zone 'Asia/Kolkata')::date = t.l::date) < s.max_daily_reservations)
$$;

create function _auto_assign(p_res uuid) returns void language plpgsql security definer set search_path = bolt, pg_temp as $$
declare v_staff uuid; v_event uuid; v_from timestamptz; v_to timestamptz;
begin
  select r.event_id, s.starts_at, s.ends_at into v_event, v_from, v_to
  from reservations r join availability_slots s on s.id = r.slot_id join events e on e.id = r.event_id
  where r.id = p_res and e.auto_assign_staff;
  if v_event is null then return; end if;
  -- fewest appointments overlapping this time first, then fewest that day
  select st.id into v_staff
  from staff_assignments ea join staff st on st.id = ea.staff_id
  left join lateral (
    select count(*) filter (where sl.starts_at < v_to and sl.ends_at > v_from) as overlapping, count(*) as day_total
    from staff_assignments a join reservations r on r.id = a.reservation_id join availability_slots sl on sl.id = r.slot_id
    where a.staff_id = st.id and r.status <> 'cancelled'
      and (sl.starts_at at time zone 'Asia/Kolkata')::date = (v_from at time zone 'Asia/Kolkata')::date) w on true
  where ea.event_id = v_event and st.auto_assign and _staff_free(st.id, v_from, v_to)
  order by w.overlapping, w.day_total, st.id limit 1;
  if v_staff is null then return; end if;
  insert into staff_assignments (staff_id, reservation_id) values (v_staff, p_res) on conflict (reservation_id) do nothing;
  perform _log(p_res, 'staff_assigned', 'system', jsonb_build_object('staff_id', v_staff, 'automatic', true));
  perform _enqueue('staff_assignment', p_res, v_staff);
end $$;

create function _booking_json(p_res uuid) returns jsonb language sql stable security definer set search_path = bolt, pg_temp as $$
  select jsonb_build_object(
    'reference', r.reference, 'status', r.status, 'participant_name', r.participant_name,
    'event_id', e.id, 'event_name', e.name, 'event_slug', e.slug, 'event_type', e.event_type, 'event_status', e.status, 'location', e.location,
    'meeting_link', case when r.status <> 'cancelled' then e.meeting_link end,
    'slot_id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at, 'created_at', r.created_at,
    'can_change', r.status <> 'cancelled' and s.starts_at > now() and a.status = 'not_checked_in' and e.status = 'published')
  from reservations r join availability_slots s on s.id = r.slot_id join events e on e.id = r.event_id
  join attendance a on a.reservation_id = r.id where r.id = p_res
$$;

-- Locks and validates a slot, returning it with capacity guaranteed for this transaction.
create function _lock_open_slot(p_slot uuid, p_public boolean) returns availability_slots
language plpgsql security definer set search_path = bolt, pg_temp as $$
declare v availability_slots; e events; d event_dates; v_active int;
begin
  select * into v from availability_slots where id = p_slot;
  if not found then raise exception 'This time slot no longer exists. Please choose another.' using errcode = 'BE404'; end if;
  select * into e from events where id = v.event_id for share;
  if e.status <> 'published' then raise exception 'This event is not accepting bookings.' using errcode = 'BE422'; end if;
  if p_public and e.registration_deadline is not null and e.registration_deadline <= now() then
    raise exception 'The registration deadline for this event has passed.' using errcode = 'BE422'; end if;
  select * into d from event_dates where id = v.event_date_id for share;
  if d.is_blocked or not d.booking_enabled then
    raise exception 'Booking is closed for this date. Please choose another date.' using errcode = 'BE409'; end if;
  select * into v from availability_slots where id = p_slot for update;
  if not found then raise exception 'This time slot no longer exists. Please choose another.' using errcode = 'BE404'; end if;
  if v.status <> 'active' then raise exception 'This time slot is no longer available. Please choose another.' using errcode = 'BE409'; end if;
  if v.starts_at <= now() then raise exception 'This time slot has already started. Please choose another.' using errcode = 'BE409'; end if;
  select count(*) into v_active from reservations where slot_id = p_slot and status <> 'cancelled';
  if v_active >= v.capacity then
    raise exception 'This time slot has just been fully booked. Please choose another.' using errcode = 'BE409'; end if;
  return v;
end $$;

create function book_slot(p_slot uuid, p_name text, p_mobile text, p_email text, p_message text, p_idem uuid, p_token text, p_marketing jsonb)
returns jsonb language plpgsql security definer set search_path = bolt, pg_temp as $$
declare s availability_slots; v_id uuid; v_hash bytea := sha256(convert_to(p_token, 'UTF8')); x reservations; m jsonb := coalesce(p_marketing, '{}');
begin
  select * into x from reservations where idempotency_key = p_idem;
  if not found then
    -- serialise retries of the same submission before anything else
    perform pg_advisory_xact_lock(hashtextextended(p_idem::text, 42));
    select * into x from reservations where idempotency_key = p_idem;
  end if;
  if found then
    if x.manage_token_hash <> v_hash or x.slot_id <> p_slot then
      raise exception 'This booking was already submitted.' using errcode = 'BE409'; end if;
    return _booking_json(x.id) || '{"replayed": true}';
  end if;
  s := _lock_open_slot(p_slot, true);
  begin
    insert into reservations (reference, event_id, slot_id, participant_name, mobile, email, message, idempotency_key, manage_token_hash,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, campaign_id, adset_id, ad_id, landing_page)
    values (_new_reference(), s.event_id, s.id, trim(p_name), p_mobile, nullif(trim(p_email), ''), nullif(trim(p_message), ''), p_idem, v_hash,
      left(m->>'utm_source', 200), left(m->>'utm_medium', 200), left(m->>'utm_campaign', 200), left(m->>'utm_content', 200), left(m->>'utm_term', 200),
      left(m->>'fbclid', 500), left(m->>'campaign_id', 100), left(m->>'adset_id', 100), left(m->>'ad_id', 100), left(m->>'landing_page', 1000))
    returning id into v_id;
  exception
    when unique_violation then raise exception 'You already have a booking for this time slot.' using errcode = 'BE409';
    when check_violation then raise exception 'Please check your details and try again.' using errcode = 'BE422';
  end;
  insert into attendance (reservation_id) values (v_id);
  perform _log(v_id, 'booked', 'participant', jsonb_build_object('slot_id', s.id, 'starts_at', s.starts_at));
  perform _enqueue('booking_confirmation', v_id);
  perform _schedule_reminders(v_id);
  perform _auto_assign(v_id);
  return _booking_json(v_id);
end $$;

create function _cancel(p_res uuid, p_actor text, p_reason text) returns void language plpgsql security definer set search_path = bolt, pg_temp as $$
declare r reservations; a attendance_status;
begin
  select * into r from reservations where id = p_res for update;
  if r.status = 'cancelled' then raise exception 'This booking is already cancelled.' using errcode = 'BE409'; end if;
  select status into a from attendance where reservation_id = p_res;
  if a in ('checked_in', 'attended') then raise exception 'This participant has already checked in, so the booking cannot be cancelled.' using errcode = 'BE422'; end if;
  update reservations set status = 'cancelled', cancelled_at = now(), cancel_reason = nullif(trim(p_reason), '') where id = p_res;
  perform _log(p_res, 'cancelled', p_actor, jsonb_build_object('slot_id', r.slot_id), nullif(trim(p_reason), ''));
  perform _schedule_reminders(p_res);
  perform _enqueue('booking_cancellation', p_res);
end $$;

create function _reschedule(p_res uuid, p_slot uuid, p_actor text) returns void language plpgsql security definer set search_path = bolt, pg_temp as $$
declare r reservations; s_old availability_slots; s_new availability_slots; v_event uuid; v_new_event uuid; a attendance_status;
begin
  select event_id into v_event from reservations where id = p_res;
  select event_id into v_new_event from availability_slots where id = p_slot;
  if v_new_event is null then raise exception 'This time slot no longer exists. Please choose another.' using errcode = 'BE404'; end if;
  if v_new_event <> v_event then raise exception 'Choose a time slot from the same event.' using errcode = 'BE422'; end if;
  perform 1 from events where id = v_event for share;
  perform 1 from event_dates where id = (select event_date_id from availability_slots where id = p_slot) for share;
  select * into r from reservations where id = p_res for update;
  if r.status = 'cancelled' then raise exception 'A cancelled booking cannot be rescheduled.' using errcode = 'BE422'; end if;
  if r.slot_id = p_slot then raise exception 'This is already your booked time slot.' using errcode = 'BE422'; end if;
  select status into a from attendance where reservation_id = p_res;
  if a in ('checked_in', 'attended') then raise exception 'This participant has already checked in, so the booking cannot be rescheduled.' using errcode = 'BE422'; end if;
  perform 1 from availability_slots where id in (r.slot_id, p_slot) order by id for update;
  select * into s_old from availability_slots where id = r.slot_id;
  if p_actor = 'participant' and s_old.starts_at <= now() then
    raise exception 'This appointment has already started and can no longer be changed.' using errcode = 'BE422'; end if;
  s_new := _lock_open_slot(p_slot, p_actor = 'participant');
  begin
    update reservations set slot_id = p_slot, status = 'rescheduled' where id = p_res;
  exception when unique_violation then
    raise exception 'This participant already has a booking for that time slot.' using errcode = 'BE409';
  end;
  update attendance set status = 'not_checked_in', checked_in_at = null where reservation_id = p_res and status = 'no_show';
  perform _log(p_res, 'rescheduled', p_actor, jsonb_build_object('from_slot', s_old.id, 'from', s_old.starts_at, 'to_slot', s_new.id, 'to', s_new.starts_at));
  perform _schedule_reminders(p_res);
  perform _enqueue('booking_rescheduling', p_res);
end $$;

-- Participant self-service: authorised only by the secret management token ----
create function _res_by_token(p_token text) returns uuid language plpgsql stable security definer set search_path = bolt, pg_temp as $$
declare v uuid;
begin
  select id into v from reservations where manage_token_hash = sha256(convert_to(p_token, 'UTF8'));
  if v is null then raise exception 'Booking not found. Please check your link.' using errcode = 'BE404'; end if;
  return v;
end $$;

create function booking_by_token(p_token text) returns jsonb language sql stable security definer set search_path = bolt, pg_temp as $$
  select _booking_json(_res_by_token(p_token))
$$;

create function booking_idem_by_reference(p_reference text, p_mobile text) returns uuid language sql stable security definer set search_path = bolt, pg_temp as $$
  select idempotency_key from reservations where reference = upper(trim(p_reference)) and mobile = p_mobile
$$;

create function participant_cancel(p_token text, p_reason text) returns jsonb language plpgsql security definer set search_path = bolt, pg_temp as $$
declare v uuid := _res_by_token(p_token);
begin
  if exists (select 1 from reservations r join availability_slots s on s.id = r.slot_id where r.id = v and s.starts_at <= now()) then
    raise exception 'This appointment has already started and can no longer be changed.' using errcode = 'BE422'; end if;
  perform _cancel(v, 'participant', p_reason);
  return _booking_json(v);
end $$;

create function participant_reschedule(p_token text, p_slot uuid) returns jsonb language plpgsql security definer set search_path = bolt, pg_temp as $$
declare v uuid := _res_by_token(p_token);
begin perform _reschedule(v, p_slot, 'participant'); return _booking_json(v); end $$;

-- Staff / admin operations ----------------------------------------------------
create function _require_access(p_res uuid) returns void language plpgsql stable security definer set search_path = bolt, pg_temp as $$
begin
  if not can_access_reservation(p_res) then raise exception 'You do not have access to this booking.' using errcode = 'BE403'; end if;
end $$;

create function manage_cancel(p_res uuid, p_reason text) returns void language plpgsql security definer set search_path = bolt, pg_temp as $$
begin perform _require_access(p_res); perform _cancel(p_res, _actor(), p_reason); end $$;

create function manage_reschedule(p_res uuid, p_slot uuid) returns void language plpgsql security definer set search_path = bolt, pg_temp as $$
begin
  perform _require_access(p_res);
  if not is_admin() and not exists (select 1 from staff where id = my_staff_id() and can_reschedule) then
    raise exception 'You are not authorised to reschedule appointments.' using errcode = 'BE403'; end if;
  perform _reschedule(p_res, p_slot, _actor());
end $$;

create function set_attendance(p_res uuid, p_status attendance_status) returns void language plpgsql security definer set search_path = bolt, pg_temp as $$
declare v_old attendance_status; v_b booking_status; v_start timestamptz;
begin
  perform _require_access(p_res);
  select status into v_b from reservations where id = p_res for update;
  if v_b = 'cancelled' then raise exception 'Attendance cannot be changed on a cancelled booking.' using errcode = 'BE422'; end if;
  select s.starts_at into v_start from reservations r join availability_slots s on s.id = r.slot_id where r.id = p_res;
  if p_status = 'no_show' and v_start > now() then
    raise exception 'No-show can only be marked after the appointment start time.' using errcode = 'BE422'; end if;
  select status into v_old from attendance where reservation_id = p_res;
  if v_old = p_status then return; end if;
  update attendance set status = p_status, marked_by = uid(),
    checked_in_at = case when p_status = 'checked_in' then now() when p_status = 'attended' then coalesce(checked_in_at, now()) end
  where reservation_id = p_res;
  perform _log(p_res, 'attendance', _actor(), jsonb_build_object('from', v_old, 'to', p_status));
end $$;

create function add_note(p_res uuid, p_note text) returns void language plpgsql security definer set search_path = bolt, pg_temp as $$
begin
  perform _require_access(p_res);
  if length(trim(coalesce(p_note, ''))) not between 1 and 2000 then raise exception 'Enter a note of up to 2000 characters.' using errcode = 'BE422'; end if;
  perform _log(p_res, 'note', _actor(), '{}', trim(p_note));
end $$;

create function assign_reservation(p_res uuid, p_staff uuid) returns void language plpgsql security definer set search_path = bolt, pg_temp as $$
declare v_old uuid;
begin
  perform require_admin();
  perform 1 from reservations where id = p_res for update;
  if not found then raise exception 'Booking not found.' using errcode = 'BE404'; end if;
  select staff_id into v_old from staff_assignments where reservation_id = p_res;
  if v_old is not distinct from p_staff then return; end if;
  if p_staff is not null and not exists (select 1 from staff s join profiles p on p.id = s.profile_id where s.id = p_staff and p.is_active) then
    raise exception 'Choose an active staff member.' using errcode = 'BE422'; end if;
  delete from staff_assignments where reservation_id = p_res;
  if p_staff is not null then
    insert into staff_assignments (staff_id, reservation_id, assigned_by) values (p_staff, p_res, uid());
    perform _enqueue('staff_assignment', p_res, p_staff);
  end if;
  perform _log(p_res, 'staff_assigned', 'admin', jsonb_build_object('from', v_old, 'staff_id', p_staff));
end $$;

-- Events and slots ------------------------------------------------------------
create function generate_slots(p_date uuid, p_replace boolean) returns int language plpgsql security definer set search_path = bolt, pg_temp as $$
declare d event_dates; v_t timestamptz; v_end timestamptz; v_stop timestamptz; n int := 0;
begin
  perform require_admin();
  select * into d from event_dates where id = p_date for update;
  if not found then raise exception 'Event date not found.' using errcode = 'BE404'; end if;
  if p_replace then
    -- slots that ever had a reservation are kept to preserve booking records
    delete from availability_slots s where s.event_date_id = p_date and not s.is_custom and s.status = 'active'  -- blocked times stay blocked
      and not exists (select 1 from reservations r where r.slot_id = s.id);
  end if;
  v_t := (d.date + d.start_time) at time zone 'Asia/Kolkata';
  v_stop := (d.date + d.end_time) at time zone 'Asia/Kolkata';
  loop
    v_end := v_t + make_interval(mins => d.slot_duration_min);
    exit when v_end > v_stop;
    if not exists (select 1 from availability_slots s where s.event_date_id = p_date and s.starts_at < v_end and s.ends_at > v_t) then
      insert into availability_slots (event_id, event_date_id, starts_at, ends_at, capacity) values (d.event_id, d.id, v_t, v_end, d.capacity);
      n := n + 1;
    end if;
    v_t := v_end + make_interval(mins => d.buffer_min);
  end loop;
  return n;
end $$;

-- Makes event_dates match the event's date range and weekdays (ISO 1..7).
create function sync_event_dates(p_event uuid, p_weekdays int[], p_apply_defaults boolean) returns int
language plpgsql security definer set search_path = bolt, pg_temp as $$
declare e events; d record; n int := 0;
begin
  perform require_admin();
  select * into e from events where id = p_event for update;
  if not found then raise exception 'Event not found.' using errcode = 'BE404'; end if;
  delete from event_dates x where x.event_id = p_event and (x.date < e.start_date or x.date > e.end_date
      or (p_weekdays is not null and not extract(isodow from x.date)::int = any (p_weekdays)))
    and not exists (select 1 from reservations r join availability_slots s on s.id = r.slot_id where s.event_date_id = x.id);
  if p_apply_defaults then
    for d in update event_dates set start_time = e.daily_start_time, end_time = e.daily_end_time, slot_duration_min = e.slot_duration_min,
        buffer_min = e.buffer_min, capacity = e.capacity_per_slot where event_id = p_event returning id loop
      n := n + generate_slots(d.id, true);
    end loop;
  end if;
  for d in insert into event_dates (event_id, date, start_time, end_time, slot_duration_min, buffer_min, capacity)
      select p_event, g::date, e.daily_start_time, e.daily_end_time, e.slot_duration_min, e.buffer_min, e.capacity_per_slot
      from generate_series(e.start_date::timestamp, e.end_date::timestamp, interval '1 day') g
      where p_weekdays is null or extract(isodow from g)::int = any (p_weekdays)
      on conflict (event_id, date) do nothing returning id loop
    n := n + generate_slots(d.id, false);
  end loop;
  return n;
end $$;

create function set_event_status(p_event uuid, p_status event_status) returns void language plpgsql security definer set search_path = bolt, pg_temp as $$
declare v event_status; r record;
begin
  perform require_admin();
  select status into v from events where id = p_event for update;
  if v is null then raise exception 'Event not found.' using errcode = 'BE404'; end if;
  if v = p_status then return; end if;
  if p_status = 'published' and not exists (select 1 from availability_slots where event_id = p_event) then
    raise exception 'Add at least one time slot before publishing.' using errcode = 'BE422'; end if;
  update events set status = p_status, published_at = case when p_status = 'published' then now() else published_at end where id = p_event;
  if p_status = 'cancelled' then
    for r in select x.id from reservations x join availability_slots s on s.id = x.slot_id join attendance a on a.reservation_id = x.id
        where x.event_id = p_event and x.status <> 'cancelled' and s.starts_at > now() and a.status in ('not_checked_in', 'no_show') order by x.id loop
      perform _cancel(r.id, 'admin', 'Event cancelled');
    end loop;
  end if;
end $$;

create function duplicate_event(p_event uuid, p_slug text) returns uuid language plpgsql security definer set search_path = bolt, pg_temp as $$
declare v uuid;
begin
  perform require_admin();
  insert into events (slug, name, description, location, event_type, meeting_link, start_date, end_date, daily_start_time, daily_end_time,
    slot_duration_min, buffer_min, capacity_per_slot, registration_deadline, visibility, status, auto_assign_staff, created_by, banner_version)
  select p_slug, left(name, 143) || ' (Copy)', description, location, event_type, meeting_link, start_date, end_date, daily_start_time, daily_end_time,
    slot_duration_min, buffer_min, capacity_per_slot, registration_deadline, visibility, 'draft', auto_assign_staff, uid(), banner_version
  from events where id = p_event returning id into v;
  if v is null then raise exception 'Event not found.' using errcode = 'BE404'; end if;
  insert into event_banners (event_id, mime, data) select v, mime, data from event_banners where event_id = p_event;
  insert into event_dates (event_id, date, start_time, end_time, slot_duration_min, buffer_min, capacity, is_blocked, booking_enabled)
    select v, date, start_time, end_time, slot_duration_min, buffer_min, capacity, is_blocked, booking_enabled from event_dates where event_id = p_event;
  insert into availability_slots (event_id, event_date_id, starts_at, ends_at, capacity, status, is_custom)
    select v, nd.id, s.starts_at, s.ends_at, s.capacity, s.status, s.is_custom
    from availability_slots s join event_dates od on od.id = s.event_date_id join event_dates nd on nd.event_id = v and nd.date = od.date
    where s.event_id = p_event;
  insert into staff_assignments (staff_id, event_id, assigned_by) select staff_id, v, uid() from staff_assignments where event_id = p_event;
  return v;
end $$;

-- Public reads: aggregated availability only, never participant data ----------
create function public_events() returns jsonb language sql stable security definer set search_path = bolt, pg_temp as $$
  select coalesce(jsonb_agg(x order by x->>'next_date' nulls last), '[]') from (
    select jsonb_build_object('id', e.id, 'slug', e.slug, 'name', e.name, 'description', left(e.description, 200), 'location', e.location,
      'event_type', e.event_type, 'start_date', e.start_date, 'end_date', e.end_date, 'banner_version', e.banner_version,
      'closed', coalesce(e.registration_deadline <= now(), false),
      'next_date', (min(s.starts_at) at time zone 'Asia/Kolkata')::date, 'available', coalesce(sum(s.capacity - s.booked_count), 0)) x
    from events e left join (availability_slots s join event_dates d on d.id = s.event_date_id and not d.is_blocked and d.booking_enabled)
      on s.event_id = e.id and s.status = 'active' and s.starts_at > now()
    where e.status = 'published' and e.visibility = 'public' and e.end_date >= (now() at time zone 'Asia/Kolkata')::date
    group by e.id) q
$$;

create function public_event(p_slug text) returns jsonb language sql stable security definer set search_path = bolt, pg_temp as $$
  select jsonb_build_object('id', e.id, 'slug', e.slug, 'name', e.name, 'description', e.description, 'location', e.location,
    'event_type', e.event_type, 'start_date', e.start_date, 'end_date', e.end_date, 'status', e.status, 'visibility', e.visibility,
    'banner_version', e.banner_version, 'registration_deadline', e.registration_deadline,
    'closed', coalesce(e.registration_deadline <= now(), false) or e.status <> 'published',
    'slots', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'date', d.date, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
        'capacity', s.capacity, 'remaining', s.capacity - s.booked_count) order by s.starts_at)
      from availability_slots s join event_dates d on d.id = s.event_date_id
      where s.event_id = e.id and s.status = 'active' and s.starts_at > now() and not d.is_blocked and d.booking_enabled
        and e.status = 'published'), '[]'))
  from events e where e.slug = p_slug and e.status <> 'draft'
$$;

create function event_banner(p_event uuid) returns table (mime text, data bytea) language sql stable security definer set search_path = bolt, pg_temp as $$
  select b.mime, b.data from event_banners b join events e on e.id = b.event_id
  where b.event_id = p_event and (e.status <> 'draft' or is_admin())
$$;

-- Notification worker ---------------------------------------------------------
create function claim_notifications(p_limit int) returns setof jsonb language plpgsql security definer set search_path = bolt, pg_temp as $$
begin
  return query
  with due as (
    select id from notifications
    where (status = 'pending' and scheduled_for <= now()) or (status = 'sending' and locked_at < now() - interval '10 minutes')
    order by scheduled_for limit p_limit for update skip locked
  ), c as (
    update notifications n set status = 'sending', attempts = attempts + 1, locked_at = now() from due where n.id = due.id returning n.*
  )
  select jsonb_build_object('id', c.id, 'type', c.type, 'channel', c.channel, 'recipient', c.recipient, 'attempts', c.attempts,
    'subject', t.subject, 'body', t.body, 'provider_template', t.provider_template,
    'idem', r.idempotency_key, 'participant_name', r.participant_name, 'mobile', r.mobile, 'email', r.email, 'reference', r.reference,
    'booking_status', r.status, 'event_name', e.name, 'event_slug', e.slug, 'location', e.location, 'meeting_link', e.meeting_link,
    'starts_at', s.starts_at, 'ends_at', s.ends_at, 'staff_name', sp.full_name,
    'utm_source', r.utm_source, 'utm_campaign', r.utm_campaign, 'campaign_id', r.campaign_id, 'adset_id', r.adset_id, 'ad_id', r.ad_id)
  from c join notification_templates t on t.type = c.type and t.channel = c.channel
  left join reservations r on r.id = c.reservation_id left join events e on e.id = r.event_id
  left join availability_slots s on s.id = r.slot_id left join staff st on st.id = c.staff_id left join profiles sp on sp.id = st.profile_id;
end $$;

create function finish_notification(p_id uuid, p_status notif_status, p_message_id text, p_error text, p_retry_at timestamptz) returns void
language sql security definer set search_path = bolt, pg_temp as $$
  update notifications set status = p_status, provider_message_id = left(p_message_id, 300), error = left(p_error, 500), locked_at = null,
    sent_at = case when p_status = 'sent' then now() end, scheduled_for = coalesce(p_retry_at, scheduled_for)
  where id = p_id and status = 'sending'
$$;

create function admin_retry_notification(p_id uuid) returns void language plpgsql security definer set search_path = bolt, pg_temp as $$
begin
  perform require_admin();
  update notifications set status = 'pending', attempts = 0, error = null, scheduled_for = now()
  where id = p_id and status in ('failed', 'not_configured');
end $$;

create function get_integration(p_key text) returns table (enabled boolean, config jsonb, secrets_encrypted text)
language sql stable security definer set search_path = bolt, pg_temp as $$
  select enabled, config, secrets_encrypted from integration_settings where key = p_key
$$;

create function record_webhook(p_source text, p_external text, p_payload jsonb) returns boolean language plpgsql security definer set search_path = bolt, pg_temp as $$
begin
  insert into webhook_events (source, external_id, payload) values (p_source, left(p_external, 200), p_payload) on conflict do nothing;
  return found;
end $$;

-- Function privileges: nothing for PUBLIC; underscore helpers stay internal ---
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'bolt' loop
    execute format('revoke all on function %s from public', f.sig);
    if f.proname not like '\_%' and f.proname not in ('touch_updated_at', 'reservation_capacity') then
      execute format('grant execute on function %s to bolt_app', f.sig);
    end if;
  end loop;
end $$;
insert into bolt.schema_migrations (name) values ('003_booking.sql');
reset search_path;

-- ===== 004_defaults.sql =====
-- Configuration defaults (not sample data): integration rows and notification templates.
set local search_path = bolt, pg_temp;

insert into integration_settings (key, enabled, config) values
  ('app', true, '{"organisation": "Bolt Academy", "support_contact": "", "appointment_reminder_hours": 2, "event_reminder_hours": 24}'),
  ('email', false, '{}'), ('whatsapp', false, '{}'), ('aisensy', false, '{}'), ('pabbly', false, '{}'), ('meta', false, '{}');

insert into notification_templates (type, channel, subject, body)
select t.type::notif_type, c.channel::notif_channel, case when c.channel = 'email' then t.subject else '' end, t.body
from (values
  ('booking_confirmation', 'Booking confirmed: {{event_name}} ({{reference}})',
   E'Hi {{participant_name}},\n\nYour appointment for {{event_name}} is confirmed.\n\nBooking ID: {{reference}}\nDate: {{date}}\nTime: {{time}}\nLocation: {{location}}\n\nManage your booking: {{manage_link}}\n\nBolt Academy'),
  ('booking_cancellation', 'Booking cancelled: {{event_name}} ({{reference}})',
   E'Hi {{participant_name}},\n\nYour booking {{reference}} for {{event_name}} on {{date}}, {{time}} has been cancelled.\n\nBolt Academy'),
  ('booking_rescheduling', 'Booking rescheduled: {{event_name}} ({{reference}})',
   E'Hi {{participant_name}},\n\nYour booking {{reference}} for {{event_name}} has moved to {{date}}, {{time}}.\n\nManage your booking: {{manage_link}}\n\nBolt Academy'),
  ('appointment_reminder', 'Reminder: {{event_name}} at {{time}}',
   E'Hi {{participant_name}},\n\nThis is a reminder of your {{event_name}} appointment on {{date}}, {{time}}.\nLocation: {{location}}\n\nManage your booking: {{manage_link}}'),
  ('event_reminder', 'Coming up: {{event_name}} on {{date}}',
   E'Hi {{participant_name}},\n\n{{event_name}} is coming up. Your appointment is on {{date}}, {{time}}.\nLocation: {{location}}\n\nManage your booking: {{manage_link}}'),
  ('staff_assignment', 'New assignment: {{event_name}} ({{reference}})',
   E'Hi {{staff_name}},\n\nYou have been assigned booking {{reference}} for {{event_name}} on {{date}}, {{time}}.\n\nPlease sign in to Bolt Events for details.')
) t(type, subject, body) cross join (values ('email'), ('whatsapp'), ('aisensy'), ('pabbly')) c(channel);
insert into bolt.schema_migrations (name) values ('004_defaults.sql');
reset search_path;

-- ===== 005_slot_timing.sql =====
-- A slot people have already booked cannot silently change time.
set local search_path = bolt, pg_temp;
create function slot_timing_guard() returns trigger language plpgsql set search_path = bolt, pg_temp as $$
begin
  if old.booked_count > 0 and (new.starts_at, new.ends_at) is distinct from (old.starts_at, old.ends_at) then
    raise exception 'This slot has bookings, so its time cannot change. Reschedule those participants first.' using errcode = 'BE409';
  end if;
  return new;
end $$;
create trigger slot_timing_guard before update of starts_at, ends_at on availability_slots for each row execute function slot_timing_guard();
revoke all on function slot_timing_guard() from public;
insert into bolt.schema_migrations (name) values ('005_slot_timing.sql');
reset search_path;

-- ===== 006_google_sheets.sql =====
-- Google Sheets mirror of reservations.
-- Any change to bookings, attendance, staff assignments or event names marks the sheet out of date;
-- the dispatcher (after each booking, on the scheduler, or "Sync now") rewrites the sheet tab.
set local search_path = bolt, pg_temp;

insert into integration_settings (key, enabled, config) values ('gsheet', false, '{"sheet_name": "Reservations"}') on conflict (key) do nothing;

create table sheet_sync (
  id int primary key default 1 check (id = 1),
  changed_at timestamptz not null default now(),   -- last change that the sheet should reflect
  synced_at timestamptz,                           -- the changed_at value the sheet was last written for
  last_run_at timestamptz,
  locked_until timestamptz,                        -- claim by one writer at a time; also the retry back-off
  row_count int,
  last_error text check (length(last_error) <= 500)
);
insert into sheet_sync default values;
alter table sheet_sync enable row level security;
create policy admin_read on sheet_sync for select to bolt_app using ((select is_admin()));
grant select on sheet_sync to bolt_app;

create function _sheet_dirty() returns trigger language plpgsql security definer set search_path = bolt, pg_temp as $$
begin
  update sheet_sync set changed_at = now() where id = 1;
  return null;
end $$;
create trigger sheet_dirty after insert or update or delete on reservations for each statement execute function _sheet_dirty();
create trigger sheet_dirty after insert or update or delete on attendance for each statement execute function _sheet_dirty();
create trigger sheet_dirty after insert or update or delete on staff_assignments for each statement execute function _sheet_dirty();
create trigger sheet_dirty after update of name on events for each statement execute function _sheet_dirty();

-- Claims a sync when the sheet is out of date and the integration is enabled. Returns the change time to sync up to, or null.
-- Returned as text so the full microsecond precision survives a round trip through JavaScript.
create function sheet_sync_claim() returns text language plpgsql security definer set search_path = bolt, pg_temp as $$
declare v text;
begin
  if not exists (select 1 from integration_settings where key = 'gsheet' and enabled) then return null; end if;
  update sheet_sync set locked_until = now() + interval '2 minutes', last_run_at = now()
  where id = 1 and changed_at > coalesce(synced_at, '-infinity') and coalesce(locked_until, '-infinity') < now()
  returning changed_at::text into v;
  return v;
end $$;

-- Every reservation as it should appear in the sheet. Only while the integration is enabled.
create function sheet_reservations() returns setof jsonb language sql stable security definer set search_path = bolt, pg_temp as $$
  select to_jsonb(x) from (
    select r.reference, r.participant_name, r.mobile, r.email, r.message, r.status, r.cancel_reason, r.created_at, r.cancelled_at,
      r.utm_source, r.utm_medium, r.utm_campaign, r.utm_content, r.utm_term, r.fbclid, r.campaign_id, r.adset_id, r.ad_id, r.landing_page,
      e.name event_name, s.starts_at, s.ends_at, a.status attendance, a.checked_in_at, sp.full_name staff_name
    from reservations r join events e on e.id = r.event_id join availability_slots s on s.id = r.slot_id
      join attendance a on a.reservation_id = r.id left join staff_assignments sa on sa.reservation_id = r.id
      left join staff st on st.id = sa.staff_id left join profiles sp on sp.id = st.profile_id
    where exists (select 1 from integration_settings where key = 'gsheet' and enabled)
    order by r.created_at, r.id
  ) x
$$;

-- Records the outcome. On success the sheet is current up to p_changed; on failure retry after 5 minutes.
create function sheet_sync_finish(p_changed timestamptz, p_rows int, p_error text) returns void
language sql security definer set search_path = bolt, pg_temp as $$
  update sheet_sync set
    synced_at = case when p_error is null then p_changed else synced_at end,
    row_count = case when p_error is null then p_rows else row_count end,
    last_error = left(p_error, 500),
    locked_until = case when p_error is null then null else now() + interval '5 minutes' end
  where id = 1
$$;

-- "Sync now" from Settings: forces a full rewrite and clears any back-off.
create function sheet_sync_request() returns void language plpgsql security definer set search_path = bolt, pg_temp as $$
begin
  perform require_admin();
  update sheet_sync set changed_at = now(), locked_until = null where id = 1;
end $$;

revoke all on function _sheet_dirty(), sheet_sync_claim(), sheet_reservations(), sheet_sync_finish(timestamptz, int, text), sheet_sync_request() from public;
grant execute on function sheet_sync_claim(), sheet_reservations(), sheet_sync_finish(timestamptz, int, text), sheet_sync_request() to bolt_app;
insert into bolt.schema_migrations (name) values ('006_google_sheets.sql');
reset search_path;

-- ===== 007_google_calendar.sql =====
-- Google Calendar: one calendar event per reservation on a shared academy calendar, so staff get Google's reminders.
-- Changes to a booking (new, rescheduled, cancelled, edited, staff assigned) queue that booking; the dispatcher
-- writes it to Google with a fixed event ID, so retries and repeats update the same event instead of duplicating it.
set local search_path = bolt, pg_temp;

insert into integration_settings (key, enabled, config) values ('gcal', false, '{"reminder_minutes": "30"}') on conflict (key) do nothing;

create table calendar_sync (
  reservation_id uuid primary key references reservations on delete cascade,
  changed_at timestamptz not null default now(),
  synced_at timestamptz,
  locked_until timestamptz,                       -- claimed by a writer, or backing off after an error
  attempts int not null default 0,
  last_error text check (length(last_error) <= 500)
);
create index calendar_sync_due_idx on calendar_sync (changed_at) where synced_at is null or changed_at > synced_at;
alter table calendar_sync enable row level security;
create policy admin_read on calendar_sync for select to bolt_app using ((select is_admin()));
grant select on calendar_sync to bolt_app;

create function _cal_queue(p_res uuid) returns void language sql security definer set search_path = bolt, pg_temp as $$
  insert into calendar_sync (reservation_id) select p_res
  where p_res is not null and exists (select 1 from integration_settings where key = 'gcal' and enabled)
  on conflict (reservation_id) do update set changed_at = now(), attempts = 0, locked_until = null
$$;
create function _cal_dirty_res() returns trigger language plpgsql security definer set search_path = bolt, pg_temp as $$
begin
  perform _cal_queue(new.id);
  return null;
end $$;
create function _cal_dirty_assign() returns trigger language plpgsql security definer set search_path = bolt, pg_temp as $$
begin
  if tg_op <> 'INSERT' then perform _cal_queue(old.reservation_id); end if;
  if tg_op <> 'DELETE' then perform _cal_queue(new.reservation_id); end if;
  return null;
end $$;
create trigger cal_dirty after insert or update of status, slot_id, participant_name, mobile, email, message on reservations
  for each row execute function _cal_dirty_res();
create trigger cal_dirty after insert or update or delete on staff_assignments for each row execute function _cal_dirty_assign();

-- Claims up to p_limit queued bookings with what the calendar event needs. One writer per booking at a time.
create function calendar_claim(p_limit int) returns setof jsonb language plpgsql security definer set search_path = bolt, pg_temp as $$
begin
  if not exists (select 1 from integration_settings where key = 'gcal' and enabled) then return; end if;
  return query
  with due as (
    select reservation_id from calendar_sync
    where (synced_at is null or changed_at > synced_at) and coalesce(locked_until, '-infinity') < now()
    order by changed_at limit p_limit for update skip locked
  ), c as (
    update calendar_sync cs set locked_until = now() + interval '2 minutes' from due where cs.reservation_id = due.reservation_id returning cs.*
  )
  select jsonb_build_object('id', r.id, 'changed', c.changed_at::text, 'reference', r.reference, 'participant_name', r.participant_name,
    'mobile', r.mobile, 'email', r.email, 'message', r.message, 'status', r.status, 'event_name', e.name, 'event_type', e.event_type,
    'location', e.location, 'meeting_link', e.meeting_link, 'starts_at', s.starts_at, 'ends_at', s.ends_at, 'staff_name', sp.full_name,
    'attempts', c.attempts)
  from c join reservations r on r.id = c.reservation_id join events e on e.id = r.event_id join availability_slots s on s.id = r.slot_id
    left join staff_assignments sa on sa.reservation_id = r.id left join staff st on st.id = sa.staff_id left join profiles sp on sp.id = st.profile_id;
end $$;

-- Records the outcome for one booking. p_changed is the claim's change time, as text to keep microseconds.
-- Errors back off 1, 2, 4 ... up to 60 minutes; a later change to the booking resets the back-off.
create function calendar_finish(p_res uuid, p_changed text, p_error text) returns void
language sql security definer set search_path = bolt, pg_temp as $$
  update calendar_sync set
    synced_at = case when p_error is null then p_changed::timestamptz else synced_at end,
    attempts = case when p_error is null then 0 else attempts + 1 end,
    last_error = left(p_error, 500),
    locked_until = case when p_error is null then null else now() + least(power(2, attempts), 60) * interval '1 minute' end
  where reservation_id = p_res
$$;

-- "Sync upcoming bookings" in Settings: queues every booking whose appointment has not ended yet.
create function calendar_sync_all() returns int language plpgsql security definer set search_path = bolt, pg_temp as $$
declare n int;
begin
  perform require_admin();
  if not exists (select 1 from integration_settings where key = 'gcal' and enabled) then return 0; end if;
  insert into calendar_sync (reservation_id)
  select r.id from reservations r join availability_slots s on s.id = r.slot_id where s.ends_at > now()
  on conflict (reservation_id) do update set changed_at = now(), attempts = 0, locked_until = null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function _cal_queue(uuid), _cal_dirty_res(), _cal_dirty_assign(), calendar_claim(int), calendar_finish(uuid, text, text), calendar_sync_all() from public;
grant execute on function calendar_claim(int), calendar_finish(uuid, text, text), calendar_sync_all() to bolt_app;
insert into bolt.schema_migrations (name) values ('007_google_calendar.sql');
reset search_path;

-- ===== 008_calendar_invites.sql =====
-- Calendar invites by email (no Google Cloud needed): each booking change emails an .ics invite to chosen addresses,
-- such as the academy's Gmail, and can attach one to participant emails. Reuses the calendar queue from 007 with a
-- second target, so the Google Calendar API integration ('gcal') and email invites ('ics') are tracked separately.
set local search_path = bolt, pg_temp;

insert into integration_settings (key, enabled, config) values ('ics', false, '{"participants": "yes", "reminder_minutes": "30"}') on conflict (key) do nothing;

alter table calendar_sync add column target text not null default 'gcal' check (target in ('gcal', 'ics'));
alter table calendar_sync drop constraint calendar_sync_pkey, add primary key (reservation_id, target);

create or replace function _cal_queue(p_res uuid) returns void language sql security definer set search_path = bolt, pg_temp as $$
  insert into calendar_sync (reservation_id, target)
  select p_res, i.key from integration_settings i
  where p_res is not null and i.enabled and (i.key = 'gcal' or (i.key = 'ics' and coalesce(i.config->>'recipients', '') <> ''))
  on conflict (reservation_id, target) do update set changed_at = now(), attempts = 0, locked_until = null
$$;

drop function calendar_claim(int);
drop function calendar_finish(uuid, text, text);
drop function calendar_sync_all();

create function calendar_claim(p_limit int, p_target text default 'gcal') returns setof jsonb language plpgsql security definer set search_path = bolt, pg_temp as $$
begin
  if not exists (select 1 from integration_settings where key = p_target and enabled) then return; end if;
  return query
  with due as (
    select reservation_id from calendar_sync
    where target = p_target and (synced_at is null or changed_at > synced_at) and coalesce(locked_until, '-infinity') < now()
    order by changed_at limit p_limit for update skip locked
  ), c as (
    update calendar_sync cs set locked_until = now() + interval '2 minutes' from due
    where cs.reservation_id = due.reservation_id and cs.target = p_target returning cs.*
  )
  select jsonb_build_object('id', r.id, 'changed', c.changed_at::text, 'reference', r.reference, 'participant_name', r.participant_name,
    'mobile', r.mobile, 'email', r.email, 'message', r.message, 'status', r.status, 'event_name', e.name, 'event_type', e.event_type,
    'location', e.location, 'meeting_link', e.meeting_link, 'starts_at', s.starts_at, 'ends_at', s.ends_at, 'staff_name', sp.full_name,
    'attempts', c.attempts, 'idem', r.idempotency_key)
  from c join reservations r on r.id = c.reservation_id join events e on e.id = r.event_id join availability_slots s on s.id = r.slot_id
    left join staff_assignments sa on sa.reservation_id = r.id left join staff st on st.id = sa.staff_id left join profiles sp on sp.id = st.profile_id;
end $$;

create function calendar_finish(p_res uuid, p_changed text, p_error text, p_target text default 'gcal') returns void
language sql security definer set search_path = bolt, pg_temp as $$
  update calendar_sync set
    synced_at = case when p_error is null then p_changed::timestamptz else synced_at end,
    attempts = case when p_error is null then 0 else attempts + 1 end,
    last_error = left(p_error, 500),
    locked_until = case when p_error is null then null else now() + least(power(2, attempts), 60) * interval '1 minute' end
  where reservation_id = p_res and target = p_target
$$;

create function calendar_sync_all(p_target text default 'gcal') returns int language plpgsql security definer set search_path = bolt, pg_temp as $$
declare n int;
begin
  perform require_admin();
  if not exists (select 1 from integration_settings where key = p_target and enabled) then return 0; end if;
  insert into calendar_sync (reservation_id, target)
  select r.id, p_target from reservations r join availability_slots s on s.id = r.slot_id
  where s.ends_at > now() and r.status <> 'cancelled'
  on conflict (reservation_id, target) do update set changed_at = now(), attempts = 0, locked_until = null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function _cal_queue(uuid), calendar_claim(int, text), calendar_finish(uuid, text, text, text), calendar_sync_all(text) from public;
grant execute on function calendar_claim(int, text), calendar_finish(uuid, text, text, text), calendar_sync_all(text) to bolt_app;
insert into bolt.schema_migrations (name) values ('008_calendar_invites.sql');
reset search_path;

-- ===== bolt_app login and administrator =====
do $$ begin execute format('alter role bolt_app with login password %L', (select v from bolt_setup where k = 'app_password')); end $$;
do $$ begin
  if (select rolsuper or rolbypassrls from pg_roles where rolname = 'bolt_app') then raise exception 'bolt_app must not be superuser or BYPASSRLS'; end if;
end $$;
create temp table bolt_invite as
with a as (
  insert into bolt.profiles (email, full_name, role) values (lower((select v from bolt_setup where k = 'admin_email')), 'Administrator', 'admin') returning id
), t as (select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') tok)
select a.id, t.tok from a, t;
insert into bolt.auth_tokens (token_hash, profile_id, expires_at) select sha256(convert_to(tok, 'UTF8')), id, now() + interval '72 hours' from bolt_invite;

commit;

select 'Setup complete' as status,
  (select v from bolt_setup where k = 'site_url') || '/invite?t=' || (select tok from bolt_invite) as admin_set_password_link,
  'Open this link after the site is live to choose your admin password (valid 72 hours).' as next_step;
