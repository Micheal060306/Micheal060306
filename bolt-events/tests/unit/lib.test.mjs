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
