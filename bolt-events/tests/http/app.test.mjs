// End-to-end HTTP tests. Build first (npm run build). Uses the TEST database and local stand-ins for external providers.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createCipheriv, createHmac, hkdfSync, randomBytes, randomUUID } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import pg from 'pg';
import { migrate } from '../../scripts/migrate.mjs';

const OWNER = process.env.TEST_OWNER_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54329/bolt_test';
if (!/test/.test(new URL(OWNER).pathname)) throw new Error('TEST_OWNER_URL must point to a database whose name contains "test"');
const APP = OWNER.replace(/\/\/[^@]+@/, '//bolt_app:local-dev-only@');
const PORT = 3105, BASE = `http://localhost:${PORT}`, SECRET = 'a'.repeat(64), CRON = 'cron-secret-for-tests';
let owner, app, server, mock, smtp, admin, staffTok, staff, calls = [], mails = [], waStatus = 200;
const q = (s, p) => owner.query(s, p).then((r) => r.rows);
const as = async (tok, s, p) => { const c = await app.connect(); try { await c.query('begin'); await c.query(`select set_config('app.session',$1,true)`, [tok]); const r = await c.query(s, p); await c.query('commit'); return r.rows; } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); } };
const session = async (id) => { const t = randomBytes(16).toString('hex'); await app.query('select bolt.create_session($1,$2,null,null)', [id, t]); return t; };
const get = (p, tok, o = {}) => fetch(BASE + p, { redirect: 'manual', ...o, headers: { ...(tok ? { cookie: `bolt_session=${tok}` } : {}), ...o.headers } });
const post = (p, body, headers = {}) => fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
let n = 0; const person = (slot, o = {}) => ({ slot, name: `Person ${++n}`, mobile: `98${String(10000000 + n)}`, idem: randomUUID(), ...o });
async function event(o = {}) {
  const [e] = await as(admin, `insert into bolt.events (slug,name,start_date,end_date,daily_start_time,daily_end_time,slot_duration_min,capacity_per_slot,visibility) values ($1,$2,current_date+3,current_date+3,'10:00','12:00',30,$3,$4) returning id,slug`, [`h-${randomBytes(4).toString('hex')}`, o.name ?? 'HTTP Event', o.cap ?? 5, o.vis ?? 'public']);
  await as(admin, 'select bolt.sync_event_dates($1,null,false)', [e.id]); await as(admin, `select bolt.set_event_status($1,'published')`, [e.id]);
  return { ...e, slots: await q('select id from bolt.availability_slots where event_id=$1 order by starts_at', [e.id]) };
}
function encrypt(o) { const k = Buffer.from(hkdfSync('sha256', SECRET, 'bolt-events', 'secrets', 32)), iv = randomBytes(12), c = createCipheriv('aes-256-gcm', k, iv), d = Buffer.concat([c.update(JSON.stringify(o)), c.final()]); return Buffer.concat([iv, c.getAuthTag(), d]).toString('base64'); }
const integ = (key, enabled, config, secrets) => q('update bolt.integration_settings set enabled=$2, config=$3, secrets_encrypted=$4 where key=$1', [key, enabled, config, secrets ? encrypt(secrets) : null]);
const listen = (s) => new Promise((r) => s.listen(0, '127.0.0.1', () => r(s.address().port)));

before(async () => {
  const c = new pg.Client(OWNER); await c.connect(); await c.query('drop schema if exists bolt cascade'); await c.end();
  await migrate({ url: OWNER, appPassword: 'local-dev-only', log() {} });
  owner = new pg.Pool({ connectionString: OWNER, max: 3 }); app = new pg.Pool({ connectionString: APP, max: 5 });
  mock = http.createServer((req, res) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => { calls.push({ url: req.url, body: JSON.parse(b), auth: req.headers.authorization }); res.setHeader('content-type', 'application/json'); if (req.url.includes('/messages')) { res.statusCode = waStatus; res.end(waStatus === 200 ? '{"messages":[{"id":"wamid.1"}]}' : '{"error":"bad"}'); } else res.end('{"success":"true","submitted_message_id":"ais1"}'); }); });
  smtp = net.createServer((s) => { let data = false, buf = ''; s.write('220 mock\r\n'); s.on('error', () => {}); s.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\r\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 2); if (data) { if (l === '.') { data = false; s.write('250 ok\r\n'); } else mails[mails.length - 1] += l + '\n'; } else if (/^EHLO/i.test(l)) s.write('250-mock\r\n250 AUTH PLAIN\r\n'); else if (/^AUTH/i.test(l)) s.write('235 ok\r\n'); else if (/^DATA/i.test(l)) { data = true; mails.push(''); s.write('354 go\r\n'); } else if (/^QUIT/i.test(l)) { s.write('221 bye\r\n'); s.end(); } else s.write('250 ok\r\n'); } }); });
  mock.port = await listen(mock); smtp.port = await listen(smtp);
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], { env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: APP, APP_URL: BASE, APP_SECRET: SECRET, CRON_SECRET: CRON, BOOKING_LIMIT_PER_IP: '100000', ALLOW_INSECURE_WEBHOOKS: '1', WHATSAPP_BASE_URL: `http://127.0.0.1:${mock.port}`, AISENSY_URL: `http://127.0.0.1:${mock.port}/aisensy` }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => { log += d; });
  server.dump = () => log;
  for (let i = 0; ; i++) { try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch { /* starting */ } if (i > 120) throw new Error(`server did not start\n${log}`); await new Promise((r) => setTimeout(r, 250)); }
  const [a] = await q(`insert into bolt.profiles(email,full_name,role) values('admin@example.test','Admin User','admin') returning id`); admin = await session(a.id);
  [staff] = await as(admin, `select * from bolt.admin_create_staff('s@example.test','Staff User','x')`); staffTok = await session(staff.profile_id);
});
after(async () => { server?.kill(); mock?.close(); smtp?.close(); await owner?.end(); await app?.end(); if (/⨯|Error:/.test(server?.dump() ?? '')) console.log(server.dump()); });

const ADMIN = ['dashboard', 'events', 'events/create', 'reservations', 'calendar', 'slots', 'staff', 'reports', 'reports?tab=marketing', 'reports?tab=staff', 'reports?tab=attendance', 'settings', 'settings?tab=integrations', 'settings?tab=templates', 'settings?tab=notifications', 'settings?tab=webhooks', 'settings?tab=account'];
const STAFF = ['dashboard', 'events', 'reservations', 'calendar', 'attendance', 'profile'];
test('every page is guarded by role', async () => {
  for (const p of ADMIN) { const u = `/admin/${p}`; assert.match((await get(u)).headers.get('location') ?? '', /\/login/, u); const s = await get(u, staffTok); assert.ok(!(await s.text()).includes('Admin User'), u); assert.ok(s.status === 307 ? /staff\/dashboard/.test(s.headers.get('location')) : s.status === 200, u); const f = await get(u, 'forged'); assert.match(f.headers.get('location') ?? '', /\/login/); assert.equal((await get(u, admin)).status, 200, u); }
  for (const p of STAFF) { const u = `/staff/${p}`; assert.match((await get(u)).headers.get('location') ?? '', /\/login/, u); assert.equal((await get(u, staffTok)).status, 200, u); assert.match((await get(u, admin)).headers.get('location') ?? '', /admin\/dashboard/); }
  for (const f of ['reservations', 'events', 'marketing', 'staff', 'attendance']) { assert.equal((await get(`/api/export/${f}`)).status, 401); assert.equal((await get(`/api/export/${f}`, staffTok)).status, 403); }
  for (const u of ['/events', '/login', '/booking/manage', '/booking/confirmation', '/invite']) assert.equal((await get(u)).status, 200, u);
  assert.equal((await get('/events/nope')).status, 404);
});
test('security headers', async () => {
  const h = (await get('/events')).headers; assert.match(h.get('content-security-policy'), /nonce-/); assert.equal(h.get('x-frame-options'), 'DENY'); assert.equal(h.get('x-powered-by'), null);
  assert.equal((await get('/booking/manage')).headers.get('referrer-policy'), 'no-referrer');
});
test('40 simultaneous HTTP bookings fill exactly the capacity', async () => {
  const e = await event(); const r = await Promise.all(Array.from({ length: 40 }, () => post('/api/public/book', person(e.slots[0].id))));
  assert.equal(r.filter((x) => x.status === 201).length, 5); assert.equal(r.filter((x) => x.status === 409).length, 35);
  const refs = new Set(); for (const x of r) { const j = await x.json(); if (x.status === 201) { assert.match(j.reference, /^BE-[2-9A-Z]{8}$/); refs.add(j.reference); } else assert.match(j.error, /fully booked/); }
  assert.equal(refs.size, 5);
  const j = await (await get(`/api/public/events/${e.slug}`)).json(); assert.equal(j.slots[0].remaining, 0);
});
test('a retried submission returns the same booking', async () => {
  const e = await event(), b = person(e.slots[0].id); const r = await Promise.all([1, 2, 3, 4].map(() => post('/api/public/book', b))); const refs = await Promise.all(r.map(async (x) => (await x.json()).reference));
  assert.equal(new Set(refs).size, 1); assert.deepEqual(r.map((x) => x.status).sort(), [200, 200, 200, 201]);
});
test('booking input is validated on the server and other sites are refused', async () => {
  const e = await event(), s = e.slots[0].id;
  for (const bad of [{ name: '' }, { mobile: '12' }, { email: 'nope' }, { slot: 'x' }, { idem: 'x' }]) assert.equal((await post('/api/public/book', person(s, bad))).status, 422);
  assert.equal((await post('/api/public/book', 'not json')).status, 422); assert.equal((await post('/api/public/book', person(s, { message: 'x'.repeat(30000) }))).status, 422);
  assert.equal((await post('/api/public/book', person(s), { origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('/api/public/book', person(randomUUID()))).status, 404);
  const r = await post('/api/public/book', person(s, { name: `<script>alert(1)</script>'; drop table x;--` })); assert.equal(r.status, 201);
  const html = await (await get(`/booking/confirmation?t=${(await r.json()).token}`)).text(); assert.ok(!html.includes('<script>alert(1)'));
});
test('participant finds, reschedules and cancels only their own booking', async () => {
  const e = await event({ cap: 1 }); const a = person(e.slots[0].id), b = person(e.slots[1].id, { name: 'Other Private Person' });
  const ra = await (await post('/api/public/book', a)).json(), rb = await (await post('/api/public/book', b)).json();
  const lk = (reference, mobile) => post('/api/public/manage', { action: 'lookup', reference, mobile });
  assert.equal((await lk(ra.reference, b.mobile)).status, 404); const ok = await lk(ra.reference.toLowerCase(), a.mobile); assert.equal((await ok.json()).token, ra.token);
  const html = await (await get(`/booking/manage?t=${ra.token}`)).text(); assert.ok(html.includes(ra.reference) && !html.includes('Other Private') && !html.includes(rb.reference));
  assert.equal((await post('/api/public/manage', { action: 'reschedule', token: ra.token, slot: e.slots[1].id })).status, 409);
  assert.equal((await post('/api/public/manage', { action: 'reschedule', token: ra.token, slot: e.slots[2].id })).status, 200);
  assert.equal((await post('/api/public/book', person(e.slots[0].id))).status, 201); // released
  assert.equal((await post('/api/public/manage', { action: 'cancel', token: 'x'.repeat(43) })).status, 404);
  assert.equal((await post('/api/public/manage', { action: 'cancel', token: ra.token })).status, 200); assert.equal((await post('/api/public/manage', { action: 'cancel', token: ra.token })).status, 409);
  assert.equal((await post('/api/public/book', person(e.slots[2].id))).status, 201);
});
test('lookups and repeated bookings are rate limited', async () => {
  const s = []; for (let i = 0; i < 8; i++) s.push((await post('/api/public/manage', { action: 'lookup', reference: 'BE-GUESSED1', mobile: `98765432${10 + i}` })).status); assert.ok(s.includes(429), s.join());
  const e = await event({ cap: 50 }), t = []; for (let i = 0; i < 17; i++) t.push((await post('/api/public/book', person(e.slots[0].id, { mobile: '9000012345' }))).status); assert.equal(t.filter((x) => x === 201).length, 15); assert.equal(t.at(-1), 429);
});
test('unlisted events are hidden from the directory but open by link', async () => {
  const u = await event({ vis: 'unlisted', name: 'Hidden Gathering' }); assert.ok(!(await (await get('/events')).text()).includes('Hidden Gathering'));
  const h = await (await get(`/events/${u.slug}`)).text(); assert.ok(h.includes('Hidden Gathering') && h.includes('noindex'));
});
test('marketing data reaches the report and exports', async () => {
  const e = await event({ name: 'Ads Event' }); await post('/api/public/book', person(e.slots[0].id, { name: 'Ad Click', marketing: { utm_source: 'instagram', utm_campaign: 'winter', fbclid: 'f1', ad_id: '77', landing_page: '/events/x?utm_source=instagram' } }));
  const csv = await (await get('/api/export/marketing', admin)).text(); assert.match(csv, /Ads Event,instagram,,winter,,,77,1,0,0/);
  const r = await get(`/api/export/reservations?format=xlsx&event=${e.id}`, admin); const x = strFromU8(unzipSync(new Uint8Array(await r.arrayBuffer()))['xl/worksheets/sheet1.xml']); assert.ok(x.includes('Ad Click') && x.includes('instagram'));
  assert.ok((await (await get(`/api/export/reservations?event=${e.id}`, admin)).text()).includes("'+91"));
  const html = await (await get(`/admin/reports?tab=marketing&event=${e.id}`, admin)).text(); assert.ok(html.includes('winter'));
});
test('staff pages and detail URLs show only authorised bookings', async () => {
  const e = await event({ name: 'Staff Scope' }); const r = await (await post('/api/public/book', person(e.slots[0].id, { name: 'Scoped Participant' }))).json(); const [{ id }] = await q('select id from bolt.reservations where reference=$1', [r.reference]);
  assert.equal((await get(`/staff/reservations/${id}`, staffTok)).status, 404); assert.ok(!(await (await get('/staff/reservations', staffTok)).text()).includes('Scoped Participant'));
  await as(admin, 'insert into bolt.staff_assignments(staff_id,event_id) values($1,$2)', [staff.staff_id, e.id]);
  assert.equal((await get(`/staff/reservations/${id}`, staffTok)).status, 200); assert.ok((await (await get('/staff/reservations', staffTok)).text()).includes('Scoped Participant'));
  for (const u of [`/admin/reservations/${id}`, `/admin/events/${e.id}`, `/admin/events/${e.id}/edit`, `/admin/slots?event=${e.id}`, `/admin/staff/${staff.staff_id}`, `/admin/reservations?q=Scoped&status=confirmed&staff=none&attendance=not_checked_in`, '/admin/reservations?date=bad&event=%27&page=-3', '/admin/calendar?day=2026-99-99']) assert.equal((await get(u, admin)).status, 200, u);
});
test('notifications are sent only through configured providers, and only confirmed ones are marked sent', async () => {
  const e = await event({ name: 'Notify Event' }); await integ('whatsapp', true, { phone_number_id: '123' }, { access_token: 'tok' }); await integ('aisensy', true, {}, { api_key: 'k' }); await integ('pabbly', true, { webhook_url: `http://127.0.0.1:${mock.port}/pabbly` }); await integ('email', true, { host: '127.0.0.1', port: String(smtp.port), user: 'u', from: 'Bolt <b@example.test>' }, { pass: 'p' });
  await q(`update bolt.notification_templates set provider_template='booking_ok' where type='booking_confirmation' and channel in ('whatsapp','aisensy')`);
  const book = async () => { const r = await (await post('/api/public/book', person(e.slots[0].id, { email: 'p@example.test' }))).json(); let rows; for (let i = 0; i < 40; i++) { rows = await q(`select n.channel,n.status,n.error,n.provider_message_id from bolt.notifications n join bolt.reservations r on r.id=n.reservation_id where r.reference=$1 and n.type='booking_confirmation'`, [r.reference]); if (rows.every((x) => !['pending', 'sending'].includes(x.status))) break; await new Promise((k) => setTimeout(k, 150)); } return Object.fromEntries(rows.map((x) => [x.channel, x])); };
  const s = await book(); for (const ch of ['whatsapp', 'aisensy', 'pabbly', 'email']) assert.equal(s[ch].status, 'sent', `${ch} ${s[ch].error}`);
  assert.equal(s.whatsapp.provider_message_id, 'wamid.1'); const wa = calls.find((c) => c.url.includes('/messages')); assert.equal(wa.body.template.name, 'booking_ok'); assert.equal(wa.auth, 'Bearer tok'); assert.ok(calls.some((c) => c.url === '/pabbly' && /manage\?t=/.test(c.body.manage_link) && !('idem' in c.body))); assert.ok(mails[0].includes('Notify Event'));
  waStatus = 400; const f = await book(); assert.equal(f.whatsapp.status, 'failed'); assert.match(f.whatsapp.error, /400/); waStatus = 200;
  await integ('whatsapp', false, {}); const z = await book(); assert.equal(z.whatsapp.status, 'not_configured');
  for (const k of ['aisensy', 'pabbly', 'email']) await integ(k, false, {});
});
test('cron and webhooks require their secrets', async () => {
  assert.equal((await get('/api/cron/notifications')).status, 401); assert.equal((await get('/api/cron/notifications', null, { headers: { authorization: `Bearer ${CRON}` } })).status, 200);
  assert.equal((await post('/api/webhooks/pabbly', { id: 1 }, { 'x-bolt-secret': '' })).status, 401); assert.equal((await post('/api/webhooks/meta', {})).status, 401);
  await integ('pabbly', true, { webhook_url: 'https://x.example' }, { inbound_secret: 's3' }); await integ('meta', true, {}, { verify_token: 'vt', app_secret: 'as' });
  assert.equal((await post('/api/webhooks/pabbly', { id: 1 }, { 'x-bolt-secret': 'bad' })).status, 401); assert.equal((await post('/api/webhooks/pabbly', { id: 1 }, { 'x-bolt-secret': 's3' })).status, 200); assert.equal((await (await post('/api/webhooks/pabbly', { id: 1 }, { 'x-bolt-secret': 's3' })).json()).duplicate, true);
  const hs = await get('/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=777'); assert.equal(await hs.text(), '777'); assert.equal((await get('/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=no&hub.challenge=7')).status, 403);
  const b = JSON.stringify({ entry: [{ changes: [{ field: 'leadgen', value: { leadgen_id: 5 } }] }] }); assert.equal((await post('/api/webhooks/meta', b, { 'x-hub-signature-256': `sha256=${createHmac('sha256', 'as').update(b).digest('hex')}` })).status, 200); assert.equal((await post('/api/webhooks/meta', b, { 'x-hub-signature-256': 'sha256=00' })).status, 401);
  assert.equal((await q(`select 1 from bolt.webhook_events where source='meta' and external_id='5'`)).length, 1);
});
