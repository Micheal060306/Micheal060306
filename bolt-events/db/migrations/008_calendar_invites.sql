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
