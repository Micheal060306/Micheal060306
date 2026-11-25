# Put Bolt Events live on Hostinger

Plain step-by-step guide. You need about 45 minutes and no programming tools on your computer.

**What you need**
- A Hostinger plan that runs **Node.js apps**: Business, Cloud Startup or higher. (Single and Premium web hosting cannot run this app.)
- A web address for the booking site, for example `events.boltacademy.in` (a subdomain of your existing domain is fine).
- A free **Supabase** account (https://supabase.com). It holds the database. Hostinger web hosting only offers MySQL, and this app needs PostgreSQL.
- This zip file.

---

## Part 1. Create the database (Supabase, about 10 minutes)

1. Sign in at https://supabase.com and click **New project**.
   - **Name:** `bolt-events`
   - **Database password:** click **Generate a password**, then copy and save it somewhere safe.
   - **Region:** **South Asia (Mumbai)**.
   - Click **Create new project** and wait about 2 minutes.
2. Open **SQL Editor** (left menu), then **New query**.
3. Open the file `db/setup-all-in-one.sql` from this zip in Notepad. Select all and copy it.
4. Paste it into the Supabase query box. Near the top, in the **SETTINGS** block, change the three values:
   - `admin_email`: the email you will sign in with, for example the academy Gmail.
   - `app_password`: a new random password of 20 to 40 characters, using only **letters and digits**. This is the password the website uses to talk to the database, not your Supabase password. Save it; you need it in Part 2.
   - `site_url`: your website address, for example `https://events.boltacademy.in` (no `/` at the end).
5. Click **Run**. After a few seconds you see **Setup complete** and an **admin_set_password_link**. Copy that link and keep it; you will open it in Part 4. It works for 72 hours. If it expires, ask for help to make a new one.

If you see an error such as "Edit admin_email in the SETTINGS block first", fix that value and click Run again. If it says the database already has Bolt Events, the setup already ran.

## Part 2. Collect the database details (Supabase, about 5 minutes)

1. Click **Connect** (top of the project page). Choose the **Transaction pooler** tab. You will see a line like:
   `postgresql://postgres.abcdefghijkl:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`
2. Build your **DATABASE_URL** from it:
   - change `postgres.abcdefghijkl` to `bolt_app.abcdefghijkl` (keep your own letters after the dot),
   - change `[YOUR-PASSWORD]` to the `app_password` from Part 1.

   Result: `postgresql://bolt_app.abcdefghijkl:YourAppPassword@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`
3. Download the **SSL certificate**: **Project Settings**, then **Database**, then **SSL Configuration**, then **Download certificate**. Open the downloaded `.crt` file in Notepad.

## Part 3. Make two secret keys (2 minutes)

The site needs two random values: `APP_SECRET` (exactly 64 characters) and `CRON_SECRET`. Make each one separately, and never share them.

- **Windows:** open **PowerShell** and paste:
  `$b=New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b|%{$_.ToString('x2')}) -join ''`
  Run it twice. Use the first result for `APP_SECRET` and the second for `CRON_SECRET`.
- **Mac:** open **Terminal** and run `openssl rand -hex 32` twice.

Keep `APP_SECRET` safe and never change it after going live. Changing it breaks existing booking links and you would need to paste the Google key again.

## Part 4. Upload the website (Hostinger, about 15 minutes)

1. In **hPanel**, go to **Websites**, then **Add website**, then **Node.js Apps** (some accounts call it **Deploy Node.js app**).
2. Choose **Upload your website files** and upload this zip, or connect the GitHub repository if you prefer.
3. **Build settings:**
   - **Framework:** Next.js
   - **Node version:** 22.x (or 24.x)
   - **Root directory:** `/` (the zip already has `package.json` at the top)
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
4. **Environment variables:** add each of these.

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the line you built in Part 2 |
   | `DATABASE_CA_CERT` | the whole certificate text from Part 2. If the box takes only one line, replace each line break with `\n` |
   | `DATABASE_POOL_MAX` | `5` |
   | `APP_URL` | your site address, the same as `site_url` in Part 1, for example `https://events.boltacademy.in` |
   | `APP_SECRET` | the first value from Part 3 |
   | `CRON_SECRET` | the second value from Part 3 |

   Do not add `ALLOW_INSECURE_WEBHOOKS` or any test settings.
5. Click **Deploy**. The first build takes a few minutes.
6. Connect your domain or subdomain to the app (hPanel, **Domains**) and make sure **SSL** is on, so the address starts with `https://`.
7. Open `https://your-site/api/health`. It must show `{"status":"ok"}`.
   - If it shows `unavailable`, check `DATABASE_URL` (the `bolt_app.` part and the `app_password`) and `DATABASE_CA_CERT`.
8. Open the **admin_set_password_link** from Part 1, choose your admin password (at least 10 characters), then sign in at `https://your-site/login`.

## Part 5. Reminders and retries (5 minutes)

Booking confirmations go out immediately. Reminders, retries and the Google Sheets and Calendar catch-up need a timer that calls the site every 5 minutes. Choose one option.

- **Supabase (recommended):**
  1. Go to **Database**, then **Extensions**, and enable **pg_cron** and **pg_net**.
  2. Open `docs/supabase-cron.sql` from the zip and change the two values: your site address, and your `CRON_SECRET`.
  3. Run it in the SQL Editor.
- **Hostinger Cron Jobs** (hPanel, **Advanced**, **Cron Jobs**), every 5 minutes:
  `curl -s -H "Authorization: Bearer YOUR-CRON_SECRET" https://your-site/api/cron/notifications`

## Part 6. Connect Google and test (10 minutes)

1. Sign in, then go to **Settings**, then **Integrations**.
2. **Google Calendar:**
   - paste your Calendar ID;
   - set the reminder to 30;
   - paste the whole service-account `.json` key file;
   - tick **Enabled**, click **Save**, then press **Sync upcoming bookings**.
3. **Google Sheets:**
   - paste the spreadsheet link;
   - leave the tab name as `Reservations`;
   - tick **Use the same key** or paste the key again;
   - tick **Enabled**, click **Save**, then press **Sync now**.
4. Go to **Events**, then **Create event**, make a test event and publish it.
5. On your phone, open the site, book a slot, and check:
   - the booking appears in Admin, then **Reservations**;
   - it appears in Google Calendar and in the sheet within a minute;
   - cancelling it from **Manage booking** updates both.
6. **Visitor limits:** each booking is rate-limited per visitor, so the site needs to see each visitor's real address.
   1. Book once from mobile data and once from Wi-Fi.
   2. In Supabase **SQL Editor**, run: `select key, hits from bolt.rate_limits where key like 'book:ip:%';`
   3. If you see **two different** addresses, all is well.
   4. If you see only one shared address, add the environment variable `TRUSTED_PROXY_HOPS` = `2` in Hostinger, redeploy, and test again.
7. In Supabase, turn on backups (**Database**, then **Backups**). Daily backups are included on paid plans.

## Updating later

- **Code updates:** upload the new zip, or push to GitHub if connected, and Hostinger rebuilds.
- **Database updates:** if an update adds a file in `db/migrations`, apply it with `npm run db:migrate` from a computer that has Node.js 22. Set `MIGRATION_DATABASE_URL` (the **Session pooler** line from Supabase, with your Supabase password) and `BOLT_APP_PASSWORD` (the same `app_password` as before) in `.env.local`. That command also sets the `bolt_app` password from `BOLT_APP_PASSWORD`, so keep it identical to the one in `DATABASE_URL`.

## Quick fixes

| Problem | Fix |
|---|---|
| `/api/health` shows `unavailable` | Wrong `DATABASE_URL`, wrong `app_password`, or a missing or broken `DATABASE_CA_CERT` |
| Build fails | Node version must be 22 or newer; the build command is `npm run build` |
| Sign-in page keeps reloading | `APP_URL` must be the exact `https://` address you are using |
| "Google Calendar refused access" | Share the calendar with the service-account email using **Make changes to events** |
| "Google Sheets refused access" | Share the sheet with the service-account email as **Editor** |
| Set-password link expired | A new one can be made in the Supabase SQL Editor; ask for help |
