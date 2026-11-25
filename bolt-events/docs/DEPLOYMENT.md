# Deploying Bolt Events

Bolt Events is a Next.js application plus a PostgreSQL 15+ database. Any Node.js 22+ host works. The steps below use Supabase and Vercel as the example.

## 1. Database
1. Create a PostgreSQL database (for example a Supabase project in Mumbai, `ap-south-1`).
2. On your computer, create `.env.local` from `.env.example` and set:
   - `MIGRATION_DATABASE_URL`: the owner connection (Supabase: Connect, Session pooler, port 5432, user `postgres.<project-ref>`; copy the host, do not guess it). Download the CA from Database Settings, SSL Configuration and set `DATABASE_CA_FILE` to its path.
   - `BOLT_APP_PASSWORD`: a long random password for the restricted `bolt_app` login.
3. Run `npm install`, then `npm run db:migrate`. Re-running is safe; each migration is applied once.
4. Set `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD`, and run `npm run admin:create`. Remove these values afterwards.

Everything is in the `bolt` schema. Do not add it to Supabase's exposed API schemas.

## 2. Application settings
Set these on the host. Do not set `MIGRATION_DATABASE_URL` there.

| Variable | Value |
|---|---|
| `DATABASE_URL` | Connection string for **bolt_app** (Supabase: Transaction pooler, port 6543, user `bolt_app.<project-ref>`, password `BOLT_APP_PASSWORD`) |
| `DATABASE_CA_CERT` | The database provider's CA certificate (PEM), if it is not publicly trusted. Supabase: Project settings, Database, SSL |
| `DATABASE_POOL_MAX` | `5` on serverless hosts |
| `APP_URL` | Public address, for example `https://events.example.com` (https turns on secure cookies) |
| `APP_SECRET` | 32 random bytes in hex. Keep it safe: changing it invalidates booking links and saved integration secrets |
| `CRON_SECRET` | At least 16 random characters |

Never set `ALLOW_INSECURE_WEBHOOKS`, `WHATSAPP_BASE_URL` or `AISENSY_URL` in production; they exist for tests.

## 3. Deploy
- **Vercel:** import the repository, add the variables, deploy.
- **Hostinger Business, Unlimited or Cloud:** import the GitHub repository or upload the zip; framework Next.js, Node 22 or 24, build `npm run build`, start `npm start`; add the variables. Run migrations from your own computer. If the certificate field accepts one line only, replace its line breaks with `\n`. After deploying, book from two networks and run `select key, hits from bolt.rate_limits where key like 'book:ip:%'`: two visitor addresses should appear. If one shared address appears, set `TRUSTED_PROXY_HOPS=2` and redeploy. Use the lowest value that shows real addresses; too high lets visitors forge theirs.
- **Own server:** `npm ci`, `npm run build`, `npm start` behind one HTTPS reverse proxy that appends the client address to `X-Forwarded-For` (rate limits use the right-most entry). Do not expose the Node port directly. With a CDN in front of the proxy, make the proxy forward the real client address.

## 4. Reminders and retries
Bookings send their notifications straight away. Reminders and retries need a scheduler that calls, every 5 minutes:

```
GET https://YOUR-SITE/api/cron/notifications
Authorization: Bearer <CRON_SECRET>
```

On Supabase, run [supabase-cron.sql](supabase-cron.sql). Vercel Cron also works on paid plans; the free plan only allows daily runs, and a more frequent schedule makes the deployment fail.

## 5. Integrations (Admin, Settings, Integrations)
- **Email:** SMTP details. **WhatsApp:** phone number ID, access token, and approved template names under Templates (five body variables: name, event, booking ID, date, time). **AiSensy:** API key plus campaign names under Templates.
- **Pabbly out:** your Pabbly webhook URL. **Pabbly in:** POST JSON to `/api/webhooks/pabbly` with header `X-Bolt-Secret`.
- **Google Sheets:** mirrors every reservation into one tab of a spreadsheet (same columns as the Reservations export).
  1. In [Google Cloud Console](https://console.cloud.google.com/), create or pick a project and enable the **Google Sheets API**.
  2. Under IAM and Admin, Service accounts, create a service account (no roles needed), then Keys, Add key, JSON. A `.json` file downloads.
  3. In Bolt Events, paste the spreadsheet link and the whole contents of that file, tick Enabled and save.
  4. Open the spreadsheet in Google Sheets, click Share and add the service account email shown on the card as **Editor**. Then press **Sync now**.

  The tab (default "Reservations") is created if missing and fully rewritten by the app, so keep your own formulas and notes on other tabs. New bookings, cancellations, reschedules, attendance and staff changes sync within seconds; anything missed (for example while Google was unreachable) is retried after 5 minutes by the scheduler in step 4. The server needs outbound HTTPS to `oauth2.googleapis.com` and `sheets.googleapis.com`.
- **Meta Lead Ads:** callback `/api/webhooks/meta` with your verify token and app secret. Leads are verified and stored; turning them into bookings is left for a later phase.
- **Ad links:** add `?utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}` to the event link. Attribution is kept in the visitor's browser for 30 days.

"Sent" in the log means the provider accepted the message, not that it was read.

## 6. After deploying
1. `/api/health` returns `{"status":"ok"}`.
2. Sign in, create an event, book it from a phone, cancel it.
3. Turn on automatic database backups.
4. Monitor `/api/health`.
