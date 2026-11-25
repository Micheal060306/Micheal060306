import 'server-only';
import nodemailer from 'nodemailer';
/** SMTP transport from the Email integration's settings. */
export const mailer = (c: Record<string, string>) => nodemailer.createTransport({ host: c.host, port: Number(c.port), secure: Number(c.port) === 465, requireTLS: process.env.ALLOW_INSECURE_WEBHOOKS !== '1' && Number(c.port) !== 465, auth: { user: c.user, pass: c.pass }, connectionTimeout: 15_000 });
/** The bare address from a "Name <email>" From setting. */
export const fromAddress = (from: string) => (from.match(/<([^>]+)>/)?.[1] ?? from).trim();
export const fromName = (from: string) => (from.match(/^\s*"?([^"<]+?)"?\s*</)?.[1] ?? '').trim();
