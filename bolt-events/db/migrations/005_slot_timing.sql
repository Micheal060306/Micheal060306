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
