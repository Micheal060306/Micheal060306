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
