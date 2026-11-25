import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { bookingSchema, clean, normalizeMobile, slugify } from '../../src/lib/validate.ts';
import { fmtRange, parseRange, toLocalInput } from '../../src/lib/format.ts';
import { toCsv, toXlsx } from '../../src/lib/export.ts';

test('mobile numbers are normalised', () => {
  for (const v of ['9876543210', '+91 98765 43210', '09876543210', '91-9876543210']) assert.equal(normalizeMobile(v), '+919876543210');
  assert.equal(normalizeMobile('+14155552671'), '+14155552671');
  for (const v of ['12345', '1234567890', 'abc', '+911234567890', '']) assert.equal(normalizeMobile(v), null);
});
test('input is sanitised', () => { assert.equal(clean(' a\u0000b‮c\n '), 'abc'); assert.equal(clean('a\r\nb', true), 'a\nb'); assert.equal(slugify('Career Counselling 2026!'), 'career-counselling-2026'); assert.equal(slugify('தமிழ்'), 'event'); });
test('booking schema', () => {
  const ok = { slot: crypto.randomUUID(), idem: crypto.randomUUID(), name: 'Asha', mobile: '9876543210', email: '', message: '' };
  assert.equal(bookingSchema.safeParse(ok).success, true);
  for (const bad of [{ name: ' ' }, { mobile: '1' }, { email: 'x' }, { slot: 'x' }, { name: 'a'.repeat(400) }, { message: 'a'.repeat(1500) }]) assert.equal(bookingSchema.safeParse({ ...ok, ...bad }).success, false, JSON.stringify(bad).slice(0, 40));
});
test('IST display and date ranges', () => {
  assert.equal(fmtRange('2026-11-28T04:30:00Z', '2026-11-28T05:00:00Z').replace(/\s/g, ' '), '10:00 AM – 10:30 AM');
  assert.equal(toLocalInput('2026-11-27T20:00:00Z'), '2026-11-28T01:30');
  const now = '2026-11-23T19:00:00Z'; // 24 Nov in IST
  assert.deepEqual(parseRange({ range: 'today' }, now), { key: 'today', from: '2026-11-24', to: '2026-11-24' });
  assert.equal(parseRange({ range: 'yesterday' }, now).from, '2026-11-23');
  assert.equal(parseRange({ range: '7d' }, now).from, '2026-11-18');
  assert.equal(parseRange({ range: 'month' }, now).from, '2026-11-01');
  assert.equal(parseRange({ range: 'custom', from: 'x', to: 'y' }, now).key, '30d');
});
test('exports neutralise formulas and stay well formed', () => {
  const t = { name: 'R', columns: ['A', 'B'], rows: [['=1+1', 5], ['a,"b"', '<x>&']] };
  const csv = toCsv(t); assert.ok(csv.includes("'=1+1,5")); assert.ok(csv.includes('"a,""b"""'));
  const x = strFromU8(unzipSync(toXlsx(t))['xl/worksheets/sheet1.xml']);
  assert.ok(x.includes('t="inlineStr"') && x.includes('=1+1') && !x.includes('<f>') && x.includes('&lt;x&gt;&amp;') && x.includes('<v>5</v>'));
});

test('google sheets client: link parsing, key parsing, signed sign-in, and a full tab rewrite', async () => {
  const http = await import('node:http');
  const { generateKeyPairSync, createVerify } = await import('node:crypto');
  const { parseSpreadsheetId, parseServiceAccount, signJwt, writeSheet, validSheetName } = await import('../../src/lib/gsheet.ts');
  const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abc';
  assert.equal(parseSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`), id);
  assert.equal(parseSpreadsheetId(id), id);
  assert.equal(parseSpreadsheetId('https://example.com/x'), null);
  assert.equal(validSheetName('Reservations'), true); assert.equal(validSheetName("a'b"), false); assert.equal(validSheetName(''), false);

  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  assert.equal(parseServiceAccount('{"client_email":"x"}'), null); assert.equal(parseServiceAccount('nope'), null);
  const sa = parseServiceAccount(JSON.stringify({ type: 'service_account', client_email: 'bolt@proj.iam.gserviceaccount.com', private_key: privateKey }));
  assert.equal(sa.client_email, 'bolt@proj.iam.gserviceaccount.com');
  const jwt = signJwt(sa, 1000), [h, c, sig] = jwt.split('.');
  assert.ok(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, 'base64url')), 'JWT signature verifies');
  const claims = JSON.parse(Buffer.from(c, 'base64url'));
  assert.equal(claims.iss, sa.client_email); assert.equal(claims.scope, 'https://www.googleapis.com/auth/spreadsheets'); assert.equal(claims.exp, 4600);

  const calls = [];
  const srv = http.createServer((req, res) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => {
    calls.push({ method: req.method, url: decodeURIComponent(req.url), auth: req.headers.authorization, body: b });
    res.setHeader('content-type', 'application/json');
    if (req.url === '/token') return res.end('{"access_token":"tok","expires_in":3600}');
    if (req.method === 'GET') return res.end('{"sheets":[{"properties":{"sheetId":0,"title":"Sheet1","gridProperties":{"rowCount":1000,"columnCount":26}}}]}');
    if (req.url.includes(':batchUpdate')) return res.end('{"replies":[{"addSheet":{"properties":{"sheetId":7,"title":"Reservations"}}}]}');
    res.end('{}');
  }); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  process.env.GOOGLE_TOKEN_URL = `${base}/token`; process.env.GOOGLE_SHEETS_URL = base;
  try {
    const n = await writeSheet(sa, id, 'Reservations', ['Booking ID', 'Name'], [['BE-1', '=HYPERLINK("x")'], ['BE-2', null]]);
    assert.equal(n, 2);
    assert.ok(calls[0].body.includes('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer'));
    assert.ok(calls.slice(1).every((x) => x.auth === 'Bearer tok'));
    const add = calls.find((x) => x.body.includes('addSheet')); assert.ok(add, 'missing tab is created');
    const put = calls.find((x) => x.method === 'PUT');
    assert.ok(put.url.endsWith(`/v4/spreadsheets/${id}/values/'Reservations'!A1?valueInputOption=RAW`), 'values are written RAW, never as formulas');
    assert.deepEqual(JSON.parse(put.body).values, [['Booking ID', 'Name'], ['BE-1', '=HYPERLINK("x")'], ['BE-2', '']]);
    const clear = calls.findIndex((x) => x.url.includes(`'Reservations'!A4:ZZ:clear`));
    assert.ok(clear > calls.indexOf(put), 'old rows below are cleared after writing, so the sheet is never empty');
  } finally { srv.close(); delete process.env.GOOGLE_TOKEN_URL; delete process.env.GOOGLE_SHEETS_URL; }
});

test('google calendar: calendar id parsing, event shape, create-then-update with a fixed id, cancel, participant link', async () => {
  const http = await import('node:http');
  const { generateKeyPairSync } = await import('node:crypto');
  const { parseCalendarId, eventId, buildEvent, upsertEvent } = await import('../../src/lib/gcal.ts');
  const { addToCalendarUrl } = await import('../../src/lib/calendar-link.ts');
  assert.equal(parseCalendarId('abc123@group.calendar.google.com'), 'abc123@group.calendar.google.com');
  assert.equal(parseCalendarId('https://calendar.google.com/calendar/embed?src=abc123%40group.calendar.google.com&ctz=Asia%2FKolkata'), 'abc123@group.calendar.google.com');
  assert.equal(parseCalendarId(`https://calendar.google.com/calendar/u/0?cid=${Buffer.from('team@boltacademy.in').toString('base64')}`), 'team@boltacademy.in');
  assert.equal(parseCalendarId('not a calendar'), null);
  const rid = '3f2a9c1e-0b7d-4e55-9a10-6c2d8e4f1a2b';
  assert.match(eventId(rid), /^[0-9a-v]{5,1024}$/, 'event id uses only Google-allowed characters');

  const b = { id: rid, reference: 'BE-TEST1234', participant_name: 'Asha', mobile: '+919876543210', email: 'asha@example.com', message: 'First visit', status: 'confirmed', event_name: 'Career Counselling', event_type: 'offline', location: 'Bolt Academy, Villivakkam', meeting_link: null, starts_at: '2026-12-01T04:30:00Z', ends_at: '2026-12-01T05:00:00Z', staff_name: 'Kavya' };
  const ev = buildEvent(b, { reminderMinutes: 30, adminUrl: 'https://x/admin/reservations/1' });
  assert.equal(ev.summary, 'Asha, Career Counselling (Kavya)'); assert.equal(ev.start.timeZone, 'Asia/Kolkata'); assert.equal(ev.start.dateTime, '2026-12-01T04:30:00.000Z');
  assert.deepEqual(ev.reminders, { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] }); assert.match(ev.description, /BE-TEST1234/); assert.match(ev.description, /\+919876543210/);
  assert.equal(buildEvent({ ...b, status: 'cancelled' }, { reminderMinutes: 0 }).status, 'cancelled');

  const link = new URL(addToCalendarUrl({ title: 'Career Counselling (BE-TEST1234)', start: b.starts_at, end: b.ends_at, location: b.location }));
  assert.equal(link.hostname, 'calendar.google.com'); assert.equal(link.searchParams.get('dates'), '20261201T043000Z/20261201T050000Z'); assert.equal(link.searchParams.get('ctz'), 'Asia/Kolkata');

  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const sa = { client_email: 'bolt@proj.iam.gserviceaccount.com', private_key: privateKey }, store = new Map(), calls = [];
  let deny = false;
  const srv = http.createServer((req, res) => { let body = ''; req.on('data', (d) => (body += d)); req.on('end', () => {
    const u = new URL(req.url, 'http://x'); calls.push({ method: req.method, path: decodeURIComponent(u.pathname), q: u.search }); res.setHeader('content-type', 'application/json');
    if (u.pathname === '/token') return res.end('{"access_token":"cal-tok","expires_in":3600}');
    if (deny) { res.statusCode = 403; return res.end('{"error":{"message":"Forbidden"}}'); }
    const m = decodeURIComponent(u.pathname).match(/^\/calendar\/v3\/calendars\/([^/]+)\/events(?:\/(.+))?$/);
    if (!m) { res.statusCode = 400; return res.end('{}'); }
    if (req.method === 'PUT') { if (!store.has(m[2])) { res.statusCode = 404; return res.end('{"error":{"message":"Not Found"}}'); } store.set(m[2], JSON.parse(body)); return res.end(body); }
    if (req.method === 'POST') { const j = JSON.parse(body); if (store.has(j.id)) { res.statusCode = 409; return res.end('{}'); } store.set(j.id, j); return res.end(body); }
    res.statusCode = 405; res.end('{}');
  }); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`; process.env.GOOGLE_TOKEN_URL = `${base}/token`; process.env.GOOGLE_CALENDAR_URL = base;
  try {
    const cal = 'abc123@group.calendar.google.com';
    assert.equal(await upsertEvent(sa, cal, { ...b, status: 'cancelled' }, { reminderMinutes: 30 }), 'absent', 'a cancelled booking that was never on the calendar creates nothing');
    assert.equal(store.size, 0);
    assert.equal(await upsertEvent(sa, cal, b, { reminderMinutes: 30 }), 'created');
    assert.equal(await upsertEvent(sa, cal, { ...b, starts_at: '2026-12-02T04:30:00Z', ends_at: '2026-12-02T05:00:00Z' }, { reminderMinutes: 30 }), 'updated', 'a retry or reschedule updates the same event');
    assert.equal(store.size, 1); assert.equal(store.get(eventId(rid)).start.dateTime, '2026-12-02T04:30:00.000Z');
    assert.equal(await upsertEvent(sa, cal, { ...b, status: 'cancelled' }, { reminderMinutes: 30 }), 'updated'); assert.equal(store.get(eventId(rid)).status, 'cancelled');
    assert.ok(calls.filter((c) => c.path !== '/token').every((c) => c.q.includes('sendUpdates=none')), 'Google never emails anyone on our behalf');
    assert.ok(calls.some((c) => c.path === '/token'));
    deny = true;
    await assert.rejects(upsertEvent(sa, cal, b, { reminderMinutes: 30 }), (e) => e.permanent && /Share the calendar with bolt@proj/.test(e.message));
  } finally { srv.close(); delete process.env.GOOGLE_TOKEN_URL; delete process.env.GOOGLE_CALENDAR_URL; }
});

test('calendar invites: valid iCalendar request and cancel, escaping, folding, stable uid, increasing sequence, email lists', async () => {
  const { buildIcs, inviteUid, inviteSequence, parseEmails } = await import('../../src/lib/ics.ts');
  const base = { uid: inviteUid('3f2a9c1e-0b7d-4e55-9a10-6c2d8e4f1a2b'), sequence: 5, start: '2026-12-01T04:30:00Z', end: '2026-12-01T05:00:00Z',
    summary: 'Asha, Career Counselling; Room 2', description: 'Booking ID: BE-TEST1234\nMobile: +919876543210, call first', location: 'Bolt Academy, Villivakkam, Chennai',
    organizer: { name: 'Bolt Academy', email: 'events@boltacademy.example' }, attendees: [{ email: 'academy@gmail.com' }], reminderMinutes: 30 };
  const req = buildIcs({ ...base, method: 'REQUEST' });
  assert.ok(req.endsWith('\r\n') && !/[^\r]\n/.test(req), 'CRLF line endings only');
  for (const l of ['METHOD:REQUEST', 'DTSTART:20261201T043000Z', 'DTEND:20261201T050000Z', 'SEQUENCE:5', 'STATUS:CONFIRMED', 'TRIGGER:-PT30M', 'ORGANIZER;CN="Bolt Academy":mailto:events@boltacademy.example']) assert.ok(req.includes(l), l);
  assert.ok(req.replace(/\r\n /g, '').includes('SUMMARY:Asha\\, Career Counselling\; Room 2'), 'text is escaped');
  assert.ok(req.replace(/\r\n /g, '').includes('DESCRIPTION:Booking ID: BE-TEST1234\\nMobile: +919876543210\\, call first'));
  assert.ok(req.split('\r\n').every((l) => Buffer.byteLength(l) <= 75), 'long lines are folded to 75 octets');
  const tamil = buildIcs({ ...base, method: 'REQUEST', summary: 'தமிழ் '.repeat(30) });
  assert.ok(tamil.split('\r\n').every((l) => Buffer.byteLength(l) <= 75) && !tamil.includes('�'), 'folding never splits a UTF-8 character');
  const cancel = buildIcs({ ...base, method: 'CANCEL', sequence: 6 });
  for (const l of ['METHOD:CANCEL', 'STATUS:CANCELLED', 'SEQUENCE:6', `UID:${base.uid}`]) assert.ok(cancel.includes(l), l);
  assert.ok(!cancel.includes('VALARM'));
  assert.equal(inviteUid('x'), inviteUid('x')); assert.notEqual(inviteUid('x'), inviteUid('y')); assert.ok(!inviteUid('secret-key').includes('secret'), 'uid does not expose the booking key');
  assert.ok(inviteSequence(Date.UTC(2027, 0, 1)) > inviteSequence(Date.UTC(2026, 0, 1))); assert.ok(inviteSequence(Date.UTC(2092, 0, 1)) < 2 ** 31);
  assert.deepEqual(parseEmails('Academy@Gmail.com, staff@example.com; staff@example.com\nx@y.in'), ['academy@gmail.com', 'staff@example.com', 'x@y.in']);
  assert.deepEqual(parseEmails(''), []); assert.equal(parseEmails('not-an-email'), null);
});
