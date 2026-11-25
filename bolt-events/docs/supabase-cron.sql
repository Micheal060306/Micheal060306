-- Run once in the Supabase SQL editor AFTER the site is live. Sends reminders and retries every 5 minutes.
-- (Vercel's free plan only allows one scheduled run per day, so Supabase does the scheduling.)
-- 1. Enable the pg_cron and pg_net extensions under Database, Extensions.
-- 2. Replace the two values below with your own.
select vault.create_secret('https://YOUR-SITE/api/cron/notifications', 'bolt_cron_url');
select vault.create_secret('YOUR-CRON_SECRET', 'bolt_cron_secret');

select cron.schedule('bolt-notifications', '*/5 * * * *', $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'bolt_cron_url'),
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'bolt_cron_secret')),
    timeout_milliseconds := 55000
  );
$$);
