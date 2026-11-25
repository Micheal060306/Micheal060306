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
