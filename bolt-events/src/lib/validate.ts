import { z } from 'zod';

/** Trims and removes control characters; line breaks survive only when multiline. */
export const clean = (s: string, multiline = false) =>
  s.normalize('NFC').replace(multiline ? /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g : /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\r\n?/g, '\n').trim();
/** Indian 10-digit numbers get +91; anything else must be international format. */
export function normalizeMobile(v: string): string | null {
  const s = v.replace(/[\s().-]/g, '');
  const m = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(s);
  if (m) return `+91${m[1]}`;
  return /^\+[1-9]\d{7,14}$/.test(s) && !s.startsWith('+91') ? s : null;
}
export const text = (min: number, max: number, label: string, multiline = false) =>
  z.string().max(max * 2 + 100, `${label} is too long.`).transform((s) => clean(s, multiline))
    .pipe(z.string().min(min, min ? `${label} is required.` : undefined).max(max, `${label} must be at most ${max} characters.`));
export const email = z.string().max(254).transform((s) => clean(s).toLowerCase()).pipe(z.email('Enter a valid email address.'));
export const optional = <T extends z.ZodType>(t: T) => z.preprocess((v) => (v === '' || v == null ? undefined : v), t.optional());
export const mobile = z.string().max(40).transform((s, ctx) => {
  const m = normalizeMobile(clean(s));
  if (!m) { ctx.addIssue({ code: 'custom', message: 'Enter a valid mobile number.' }); return z.NEVER; }
  return m;
});
export const uuid = z.guid('Invalid request.');
export const date = z.iso.date('Enter a valid date.');
export const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:\d\d)?$/, 'Enter a valid time.');
export const int = (min: number, max: number, label: string) => z.coerce.number(`${label} must be a number.`).int().min(min, `${label} must be at least ${min}.`).max(max, `${label} must be at most ${max}.`);
export const password = z.string().min(10, 'Password must be at least 10 characters.').max(200);
export const bool = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());

export const MARKETING = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'campaign_id', 'adset_id', 'ad_id', 'landing_page'] as const;
export const bookingSchema = z.object({
  slot: uuid, name: text(2, 100, 'Full name'), mobile, email: optional(email), message: optional(text(0, 1000, 'Message', true)), idem: uuid,
  marketing: z.partialRecord(z.enum(MARKETING), z.string().max(1000).transform((s) => clean(s))).optional(),
});
export const firstIssue = (e: z.ZodError) => e.issues[0]?.message || 'Please check the form.';
export const slugify = (s: string) => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'event';
