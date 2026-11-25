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
