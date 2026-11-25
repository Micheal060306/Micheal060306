// Database tests against a real PostgreSQL server. The bolt schema of the TEST database is rebuilt on each run.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import pg from 'pg';
import { migrate } from '../../scripts/migrate.mjs';

const OWNER = process.env.TEST_OWNER_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54329/bolt_test';
if (!/test/.test(new URL(OWNER).pathname)) throw new Error('TEST_OWNER_URL must point to a database whose name contains "test"');
const APP = process.env.TEST_APP_URL ?? OWNER.replace(/\/\/[^@]+@/, '//bolt_app:local-dev-only@');
let owner, app, admin, s1, s2, staff1, staff2;

const q = (sql, p) => owner.query(sql, p).then((r) => r.rows);
async function as(token, sql, p = []) {
  const c = await app.connect();
  try {
    await c.query('begin');
    await c.query(`select set_config('app.session', $1, true)`, [token ?? '']);
    const r = await c.query(sql, p);
    await c.query('commit');
    return r.rows;
  } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
}
const code = (c) => (e) => { assert.equal(e.code, c, `${e.code} ${e.message}`); return true; };
let n = 0;
const book = (slot, o = {}) => app.query('select bolt.book_slot($1,$2,$3,$4,$5,$6,$7,$8) b',
  [slot, o.name ?? `Person ${++n}`, o.mobile ?? `+9198${String(10000000 + ++n)}`, o.email ?? null, null, o.idem ?? randomUUID(), o.token ?? randomBytes(16).toString('hex'), o.m ?? {}]).then((r) => r.rows[0].b);
const session = async (id) => { const t = randomBytes(16).toString('hex'); await app.query('select bolt.create_session($1,$2,null,null)', [id, t]); return t; };
async function event(o = {}) {
  const [{ id }] = await as(admin, `insert into bolt.events (slug,name,start_date,end_date,daily_start_time,daily_end_time,slot_duration_min,buffer_min,capacity_per_slot,visibility,auto_assign_staff,registration_deadline)
    values ($1,'Career Counselling',current_date+3,current_date+4,'10:00','12:00',30,$2,$3,$4,$5,$6) returning id`,
    [`e-${randomBytes(5).toString('hex')}`, o.buffer ?? 0, o.cap ?? 5, o.vis ?? 'public', o.auto ?? false, o.deadline ?? null]);
  await as(admin, 'select bolt.sync_event_dates($1,null,false)', [id]);
  if (o.publish !== false) await as(admin, `select bolt.set_event_status($1,'published')`, [id]);
  const slots = await q('select * from bolt.availability_slots where event_id=$1 order by starts_at', [id]);
  return { id, slots };
}
const active = async (slot) => Number((await q(`select count(*) from bolt.reservations where slot_id=$1 and status<>'cancelled'`, [slot]))[0].count);
const rid = async (ref) => (await q('select id from bolt.reservations where reference=$1', [ref]))[0].id;

before(async () => {
  const c = new pg.Client(OWNER); await c.connect(); await c.query('drop schema if exists bolt cascade'); await c.end();
  await migrate({ url: OWNER, appPassword: decodeURIComponent(new URL(APP).password), log() {} });
  owner = new pg.Pool({ connectionString: OWNER, max: 5 }); app = new pg.Pool({ connectionString: APP, max: 60 });
  const [a] = await q(`insert into bolt.profiles(email,full_name,role) values('admin@example.test','Admin','admin') returning id`);
  admin = await session(a.id);
  [staff1] = await as(admin, `select * from bolt.admin_create_staff('s1@example.test','Staff One','x')`);
  [staff2] = await as(admin, `select * from bolt.admin_create_staff('s2@example.test','Staff Two','x')`);
  s1 = await session(staff1.profile_id); s2 = await session(staff2.profile_id);
});
after(async () => { await owner?.end(); await app?.end(); });

test('slot generation honours hours, duration, buffer and IST', async () => {
  const a = await event(); assert.equal(a.slots.length, 8);
  const b = await event({ buffer: 10 }); assert.equal(b.slots.length, 6); // 10:00 10:40 11:20 per day
  assert.equal(new Date(a.slots[0].starts_at).toISOString().slice(11, 16), '04:30');
});

test('five individual bookings fill a slot of five, the sixth is refused', async () => {
  const { slots } = await event(); const refs = new Set();
  for (let i = 0; i < 5; i++) refs.add((await book(slots[0].id)).reference);
  assert.equal(refs.size, 5);
  await assert.rejects(book(slots[0].id), code('BE409'));
});

test('60 simultaneous bookings never exceed capacity', async () => {
  const { slots } = await event();
  const r = await Promise.allSettled(Array.from({ length: 60 }, () => book(slots[0].id)));
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 5);
  assert.ok(r.filter((x) => x.status === 'rejected').every((x) => x.reason.code === 'BE409'));
  assert.equal(await active(slots[0].id), 5);
  assert.equal((await q('select booked_count from bolt.availability_slots where id=$1', [slots[0].id]))[0].booked_count, 5);
});

test('database constraint blocks overbooking even for the owner bypassing the function, at any isolation level', async () => {
  const { id, slots } = await event({ cap: 1 });
  const raw = (c, i) => c.query(`insert into bolt.reservations(reference,event_id,slot_id,participant_name,mobile,idempotency_key,manage_token_hash)
    values($1,$2,$3,'Raw Insert',$4,gen_random_uuid(),sha256($1::text::bytea))`, [`RAW-${randomUUID()}`, id, slots[0].id, `+91900000000${i}`]);
  const [c1, c2] = [await owner.connect(), await owner.connect()];
  await c1.query('begin isolation level repeatable read'); await c2.query('begin isolation level repeatable read');
  await c1.query('select 1'); await c2.query('select count(*) from bolt.reservations');
  await raw(c1, 1); const p = raw(c2, 2).then(() => 'ok', (e) => e.code);
  await c1.query('commit'); const res = await p; await c2.query('rollback'); c1.release(); c2.release();
  assert.ok(['40001', '23514'].includes(res), res); assert.equal(await active(slots[0].id), 1);
});

test('duplicate submissions: same key returns the same booking; same person cannot double book', async () => {
  const { slots } = await event(); const o = { idem: randomUUID(), token: 'tok-' + randomUUID(), name: 'Asha', mobile: '+919812345678' };
  const r = await Promise.all(Array.from({ length: 10 }, () => book(slots[0].id, o)));
  assert.equal(new Set(r.map((x) => x.reference)).size, 1); assert.equal(await active(slots[0].id), 1);
  await assert.rejects(book(slots[0].id, { name: 'ASHA', mobile: o.mobile }), code('BE409'));
  await assert.rejects(book(slots[1].id, o), code('BE409'));
  await assert.rejects(book(slots[0].id, { idem: o.idem, token: 'attacker' }), code('BE409'));
  await book(slots[0].id, { name: 'Sibling', mobile: o.mobile });
});

test('cancel releases capacity, is recorded, and cannot be repeated', async () => {
  const { slots } = await event({ cap: 1 }); const token = randomUUID(); const b = await book(slots[0].id, { token });
  await assert.rejects(book(slots[0].id), code('BE409'));
  await app.query('select bolt.participant_cancel($1,$2)', [token, 'busy']);
  await book(slots[0].id);
  await assert.rejects(app.query('select bolt.participant_cancel($1,null)', [token]), code('BE409'));
  await assert.rejects(app.query('select bolt.participant_reschedule($1,$2)', [token, slots[1].id]), code('BE422'));
  const h = await q('select action from bolt.booking_history where reservation_id=$1 order by id', [await rid(b.reference)]);
  assert.deepEqual(h.map((x) => x.action), ['booked', 'cancelled']);
});

test('reschedule is atomic: releases the old slot, or changes nothing when the new one is full', async () => {
  const { slots } = await event({ cap: 1 }); const token = randomUUID(); await book(slots[0].id, { token }); await book(slots[1].id);
  await assert.rejects(app.query('select bolt.participant_reschedule($1,$2)', [token, slots[1].id]), code('BE409'));
  assert.equal(await active(slots[0].id), 1);
  const { rows } = await app.query('select bolt.participant_reschedule($1,$2) b', [token, slots[2].id]);
  assert.equal(rows[0].b.status, 'rescheduled');
  assert.equal(await active(slots[0].id), 0); assert.equal(await active(slots[2].id), 1);
  await book(slots[0].id);
  const other = await event();
  await assert.rejects(app.query('select bolt.participant_reschedule($1,$2)', [token, other.slots[0].id]), code('BE422'));
});

test('concurrent swaps, reschedules, bookings and cancellations: no deadlock, no overbooking', async () => {
  const { id, slots } = await event({ cap: 3 }); const t = Array.from({ length: 12 }, () => randomUUID());
  for (let i = 0; i < 12; i++) await book(slots[i % 4].id, { token: t[i] });
  const ops = [];
  for (let k = 0; k < 120; k++) {
    const tok = t[k % 12], slot = slots[(k * 5 + 1) % 8].id;
    ops.push(k % 5 === 4 ? book(slot) : k % 17 === 0 ? app.query('select bolt.participant_cancel($1,null)', [tok]) : app.query('select bolt.participant_reschedule($1,$2)', [tok, slot]));
  }
  const bad = (await Promise.allSettled(ops)).filter((x) => x.status === 'rejected' && !/^BE/.test(x.reason.code));
  assert.deepEqual(bad.map((x) => x.reason.message), []);
  const over = await q(`select s.id from bolt.availability_slots s left join bolt.reservations r on r.slot_id=s.id and r.status<>'cancelled' where s.event_id=$1 group by s.id having count(r.id)>s.capacity or count(r.id)<>s.booked_count`, [id]);
  assert.equal(over.length, 0);
});

test('draft, deadline, blocked slot/date, disabled date, past slot, cancelled event are refused', async () => {
  const draft = await event({ publish: false }); await assert.rejects(book(draft.slots[0].id), code('BE422'));
  const late = await event({ deadline: new Date(Date.now() - 1000) }); await assert.rejects(book(late.slots[0].id), code('BE422'));
  const e = await event();
  await as(admin, `update bolt.availability_slots set status='blocked' where id=$1`, [e.slots[0].id]); await assert.rejects(book(e.slots[0].id), code('BE409'));
  await as(admin, 'update bolt.event_dates set is_blocked=true where id=$1', [e.slots[1].event_date_id]); await assert.rejects(book(e.slots[1].id), code('BE409'));
  await as(admin, 'update bolt.event_dates set is_blocked=false, booking_enabled=false where id=$1', [e.slots[1].event_date_id]); await assert.rejects(book(e.slots[1].id), code('BE409'));
  await q(`update bolt.availability_slots set starts_at=now()-interval '1 hour' where id=$1`, [e.slots[6].id]); await assert.rejects(book(e.slots[6].id), code('BE409'));
  const b = await book(e.slots[5].id);
  await as(admin, `select bolt.set_event_status($1,'cancelled')`, [e.id]);
  assert.equal((await q('select status from bolt.reservations where reference=$1', [b.reference]))[0].status, 'cancelled');
  await assert.rejects(book(e.slots[5].id), code('BE422'));
});

test('capacity can be raised, and lowered only down to what is booked', async () => {
  const { slots } = await event({ cap: 2 }); await book(slots[0].id); await book(slots[0].id);
  await assert.rejects(as(admin, 'update bolt.availability_slots set capacity=1 where id=$1', [slots[0].id]), code('23514'));
  await as(admin, 'update bolt.availability_slots set capacity=3 where id=$1', [slots[0].id]); await book(slots[0].id);
});

test('regenerating slots keeps booked ones; different dates can have different schedules', async () => {
  const { slots } = await event(); await book(slots[1].id);
  await as(admin, 'update bolt.event_dates set slot_duration_min=60 where id=$1', [slots[0].event_date_id]);
  await as(admin, 'select bolt.generate_slots($1,true)', [slots[0].event_date_id]);
  const left = await q('select id from bolt.availability_slots where event_date_id=$1', [slots[0].event_date_id]);
  assert.ok(left.some((x) => x.id === slots[1].id)); assert.equal(left.length, 2);
  const day2 = await q('select id from bolt.availability_slots where event_date_id=$1', [slots[7].event_date_id]); assert.equal(day2.length, 4);
});

test('regenerating slots keeps blocked times blocked', async () => {
  const { slots } = await event();
  await as(admin, `update bolt.availability_slots set status='blocked' where id=$1`, [slots[0].id]);
  await as(admin, 'select bolt.generate_slots($1,true)', [slots[0].event_date_id]);
  const r = await q('select id, status from bolt.availability_slots where event_date_id=$1 order by starts_at', [slots[0].event_date_id]);
  assert.equal(r.length, 4); assert.deepEqual(r[0], { id: slots[0].id, status: 'blocked' });
});

test('duplicate event copies schedule as draft without reservations', async () => {
  const { id, slots } = await event(); await book(slots[0].id);
  const [{ duplicate_event: d }] = await as(admin, 'select bolt.duplicate_event($1,$2)', [id, `dup-${randomBytes(4).toString('hex')}`]);
  const [x] = await q(`select e.status, count(s.id)::int n, sum(s.booked_count)::int b from bolt.events e join bolt.availability_slots s on s.event_id=e.id where e.id=$1 group by e.id`, [d]);
  assert.deepEqual(x, { status: 'draft', n: 8, b: 0 });
});

test('anonymous and forged sessions read nothing; sensitive columns are never readable', async () => {
  for (const t of [null, 'forged'])
    for (const tb of ['events', 'event_dates', 'availability_slots', 'attendance', 'booking_history', 'notifications', 'integration_settings', 'staff', 'staff_assignments', 'webhook_events'])
      assert.equal((await as(t, `select * from bolt.${tb}`)).length, 0, tb);
  assert.equal((await as(null, 'select id from bolt.reservations')).length, 0);
  for (const s of ['select * from bolt.sessions', 'select password_hash from bolt.profiles', 'select manage_token_hash from bolt.reservations', 'select * from bolt.auth_tokens',
    `update bolt.reservations set status='cancelled'`, 'delete from bolt.reservations', 'update bolt.availability_slots set booked_count=0', `update bolt.attendance set status='attended'`,
    `update bolt.profiles set role='admin'`, `select bolt._cancel(gen_random_uuid(),'admin',null)`])
    await assert.rejects(as(admin, s), code('42501'), s);
});

test('every table has RLS and bolt_app is unprivileged', async () => {
  assert.equal((await q(`select relname from pg_class c join pg_namespace n on n.oid=relnamespace where nspname='bolt' and relkind='r' and not relrowsecurity`)).length, 0);
  assert.equal((await q(`select 1 from pg_roles where rolname='bolt_app' and (rolsuper or rolbypassrls)`)).length, 0);
  assert.equal((await q(`select proname from pg_proc p join pg_namespace n on n.oid=pronamespace where nspname='bolt' and has_function_privilege('public', p.oid, 'execute')`)).length, 0);
});

test('staff only see and change authorised events and bookings', async () => {
  const e = await event(); const b1 = await book(e.slots[0].id), b2 = await book(e.slots[0].id);
  const [r1, r2] = [await rid(b1.reference), await rid(b2.reference)];
  const seen = async (t) => (await as(t, 'select id from bolt.reservations where event_id=$1', [e.id])).map((x) => x.id);
  assert.deepEqual(await seen(s1), []);
  await assert.rejects(as(s1, `select bolt.set_attendance($1,'checked_in')`, [r1]), code('BE403'));
  await as(admin, 'insert into bolt.staff_assignments(staff_id,event_id) values($1,$2)', [staff1.staff_id, e.id]);
  assert.equal((await seen(s1)).length, 2); assert.deepEqual(await seen(s2), []);
  await as(admin, 'select bolt.assign_reservation($1,$2)', [r2, staff2.staff_id]);
  assert.deepEqual(await seen(s1), [r1]); assert.deepEqual(await seen(s2), [r2]);
  await as(s1, `select bolt.set_attendance($1,'checked_in')`, [r1]); await as(s1, `select bolt.add_note($1,'hello')`, [r1]);
  await assert.rejects(as(s1, `select bolt.set_attendance($1,'no_show')`, [r1]), code('BE422'));
  await assert.rejects(as(s1, 'select bolt.manage_cancel($1,null)', [r2]), code('BE403'));
  await assert.rejects(as(s1, 'select bolt.manage_cancel($1,null)', [r1]), code('BE422')); // checked in
  await assert.rejects(as(s2, 'select bolt.manage_reschedule($1,$2)', [r2, e.slots[1].id]), code('BE403'));
  await as(admin, 'update bolt.staff set can_reschedule=true where id=$1', [staff2.staff_id]);
  await as(s2, 'select bolt.manage_reschedule($1,$2)', [r2, e.slots[1].id]);
  for (const [s, p] of [[`select bolt.set_event_status($1,'cancelled')`, [e.id]], [`select bolt.admin_create_staff('x@y.zz','Xx','p')`, []], ['select bolt.assign_reservation($1,null)', [r2]], ['select bolt.generate_slots($1,true)', [e.slots[0].event_date_id]], ['select bolt.admin_create_auth_token($1,$2)', [staff2.profile_id, 't']]])
    await assert.rejects(as(s1, s, p), code('BE403'));
  assert.equal((await as(s1, `update bolt.events set name='Hacked' returning id`)).length, 0);
  assert.equal((await as(s1, `update bolt.staff set can_reschedule=true returning id`)).length, 0);
  await assert.rejects(as(s1, 'insert into bolt.staff_assignments(staff_id,event_id) values($1,$2)', [staff2.staff_id, e.id]), code('42501'));
});

test('deactivating staff ends access immediately; invite tokens are single use', async () => {
  const [x] = await as(admin, `select * from bolt.admin_create_staff('tmp@example.test','Temp Staff',null)`); const t = await session(x.profile_id);
  assert.equal((await as(t, 'select * from bolt.whoami()')).length, 1);
  await as(admin, 'select bolt.admin_create_auth_token($1,$2)', [x.profile_id, 'invite']);
  await app.query(`select bolt.consume_auth_token('invite','h')`);
  await assert.rejects(app.query(`select bolt.consume_auth_token('invite','h2')`), code('BE404'));
  const t2 = await session(x.profile_id);
  await as(admin, `select bolt.admin_update_staff_account($1,'tmp@example.test','Temp Staff',false)`, [x.staff_id]);
  assert.equal((await as(t2, 'select * from bolt.whoami()')).length, 0);
});

test('automatic assignment balances workload and respects availability', async () => {
  const e = await event({ auto: true, cap: 10 });
  for (const s of [staff1, staff2]) await as(admin, 'insert into bolt.staff_assignments(staff_id,event_id) values($1,$2)', [s.staff_id, e.id]);
  for (let i = 0; i < 4; i++) await book(e.slots[0].id);
  const load = () => q(`select a.staff_id, count(*)::int n from bolt.staff_assignments a join bolt.reservations r on r.id=a.reservation_id where r.event_id=$1 group by 1 order by 1`, [e.id]);
  assert.deepEqual((await load()).map((x) => x.n), [2, 2]);
  await as(admin, `update bolt.staff set unavailable_dates=array[(now() at time zone 'Asia/Kolkata')::date+3, current_date+3] where id=$1`, [staff1.staff_id]);
  await book(e.slots[0].id); await book(e.slots[0].id);
  assert.equal((await load()).find((x) => x.staff_id === staff2.staff_id).n, 4);
});

test('public functions expose no participant data and hide unlisted/draft events', async () => {
  const p = await event(), u = await event({ vis: 'unlisted' }), d = await event({ publish: false }); await book(p.slots[0].id, { name: 'Secret Person' });
  const list = (await app.query('select bolt.public_events() j')).rows[0].j; const ids = list.map((x) => x.id);
  assert.ok(ids.includes(p.id) && !ids.includes(u.id) && !ids.includes(d.id));
  const get = async (id) => (await app.query('select bolt.public_event((select $1::text)) j', [(await q('select slug from bolt.events where id=$1', [id]))[0].slug])).rows[0]?.j;
  assert.ok(await get(u.id)); assert.ok(!(await get(d.id)));
  const ev = await get(p.id); assert.equal(ev.slots[0].remaining, 4); assert.ok(!JSON.stringify(ev).includes('Secret'));
});

test('tokens: wrong ones find nothing; reference needs the matching mobile', async () => {
  const { slots } = await event(); const b = await book(slots[0].id, { mobile: '+919811111111' });
  await assert.rejects(app.query(`select bolt.booking_by_token('nope')`), code('BE404'));
  const f = async (m) => (await app.query('select bolt.booking_idem_by_reference($1,$2) i', [b.reference, m])).rows[0].i;
  assert.equal(await f('+919822222222'), null); assert.ok(await f('+919811111111'));
});

test('notifications: not_configured by default, pending when enabled, reminders follow the booking', async () => {
  const { slots } = await event(); const b = await book(slots[0].id, { email: 'p@example.test' });
  const st = async (ref) => q('select type, channel, status from bolt.notifications where reservation_id=$1', [await rid(ref)]);
  assert.ok((await st(b.reference)).every((x) => x.status === 'not_configured'));
  await as(admin, `update bolt.integration_settings set enabled=true where key='email'`);
  const token = randomUUID(); const c = await book(slots[0].id, { email: 'p@example.test', token });
  assert.equal((await st(c.reference)).filter((x) => x.channel === 'email' && x.status === 'pending').length, 3);
  const claimed = (await app.query('select bolt.claim_notifications(50) j')).rows.map((r) => r.j);
  assert.equal(claimed.length, 1); assert.equal(claimed[0].type, 'booking_confirmation');
  assert.equal((await app.query('select bolt.claim_notifications(50) j')).rowCount, 0);
  await app.query('select bolt.participant_cancel($1,null)', [token]);
  assert.ok((await st(c.reference)).filter((x) => /reminder/.test(x.type)).every((x) => x.status === 'cancelled'));
});

test('marketing attribution is stored; rate limiter counts atomically', async () => {
  const { slots } = await event(); const b = await book(slots[0].id, { m: { utm_source: 'facebook', fbclid: 'abc', ad_id: '9', landing_page: '/x', evil: 'no' } });
  const [r] = await q('select utm_source, fbclid, ad_id, landing_page from bolt.reservations where reference=$1', [b.reference]);
  assert.deepEqual(r, { utm_source: 'facebook', fbclid: 'abc', ad_id: '9', landing_page: '/x' });
  const k = randomUUID(); const rs = await Promise.all(Array.from({ length: 20 }, () => app.query('select bolt.rate_limit_hit($1,5,60) ok', [k])));
  assert.equal(rs.filter((x) => x.rows[0].ok).length, 5);
});

test('admin can replace a banner; draft banners stay private', async () => {
  const { id } = await event({ publish: false });
  for (let i = 0; i < 2; i++) { await as(admin, 'delete from bolt.event_banners where event_id=$1', [id]); await as(admin, 'insert into bolt.event_banners(event_id,mime,data) values($1,$2,$3)', [id, 'image/png', Buffer.from([1])]); }
  assert.equal((await as(null, 'select * from bolt.event_banner($1)', [id])).length, 0); assert.equal((await as(admin, 'select * from bolt.event_banner($1)', [id])).length, 1);
});

test('events with reservations cannot be deleted', async () => {
  const { id, slots } = await event(); await book(slots[0].id);
  await assert.rejects(as(admin, 'delete from bolt.events where id=$1', [id]), (e) => ['23503', '23001'].includes(e.code));
  const e2 = await event(); await as(admin, 'delete from bolt.events where id=$1', [e2.id]);
});
