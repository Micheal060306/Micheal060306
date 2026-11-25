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
