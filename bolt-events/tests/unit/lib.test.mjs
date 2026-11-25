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
