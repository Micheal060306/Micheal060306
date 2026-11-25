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
