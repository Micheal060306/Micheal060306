# Bolt Events

Event creation and individual appointment booking for Bolt Academy. Next.js 16, React 19, TypeScript, PostgreSQL.

## Run locally
Needs Node.js 22.18 or newer. PostgreSQL is included for development.

1. `npm install` (if npm reports blocked install scripts on macOS or Linux, approve `embedded-postgres`)
2. Copy `.env.example` to `.env.local`; fill in `APP_SECRET` and `CRON_SECRET`
3. `npm run db:dev` (keep it open in its own terminal)
4. `npm run db:migrate`
5. `npm run admin:create`
6. `npm run dev`, then open http://localhost:3000/login

## Test
With `db:dev` running: `npm test` (database and units), then `npm run build` and `npm run test:http`. Tests rebuild the separate `bolt_test` database and refuse any database without "test" in its name.

## Where things are
| Path | Purpose |
|---|---|
| `db/migrations/001_schema.sql` | Tables, constraints, indexes |
| `db/migrations/002_security.sql` | Roles, Row Level Security, authentication functions |
| `db/migrations/003_booking.sql` | Booking engine, slots, staff operations, notification queue |
| `db/migrations/004_defaults.sql` | Default templates and integration rows |
| `db/migrations/005_slot_timing.sql` | Booked slots cannot change time |
| `db/migrations/006_google_sheets.sql` | Change tracking and sync state for the Google Sheets mirror |
| `db/migrations/007_google_calendar.sql` | Per-booking queue for the Google Calendar integration |
| `scripts/` | Migrate, local database, create administrator |
| `src/lib/` | Database access, authentication, validation, notifications, reports, exports |
| `src/components/` | Shared interface components |
| `src/app/(public)/` | Event directory, booking, confirmation, manage booking |
| `src/app/admin/`, `src/app/staff/` | Admin and staff interfaces |
| `src/app/api/` | Booking API, exports, webhooks, scheduler, health |
| `src/proxy.ts` | Route guard and content security policy |
| `tests/` | Database, unit and HTTP tests |
| `docs/DEPLOYMENT.md` | Production setup |

## How overbooking is prevented
`book_slot()` locks the slot row, counts active reservations, then inserts. Independently, a trigger maintains `booked_count` and the constraint `slot_not_overbooked` rejects any transaction beyond capacity. Retried submissions reuse an idempotency key and return the same booking.

## Interface
Desktop-first web layout that still works on phones:
- Admin and staff: grouped sidebar (collapsible to icons; the choice is kept in the `bolt_sidebar` cookie), a top bar with breadcrumbs, a link to the booking site and the signed-in user, toolbar-style filters, and denser tables with row action menus. Below 900px the sidebar becomes a drawer.
- Public site: website header and footer, a hero with search on the events page, and a sticky booking panel beside the event details. Below 600px tables turn into cards.

## Google Sheets
Settings, Integrations, Google Sheets mirrors all reservations into a spreadsheet tab using a Google service account (setup steps in `docs/DEPLOYMENT.md`). Database triggers mark the sheet out of date on any booking, attendance, staff or event-name change; the notification dispatcher (`src/lib/notify.ts`, which runs after each booking and on the scheduler) then rewrites the tab via `src/lib/sheet-sync.ts` and `src/lib/gsheet.ts`. Values are written RAW so nothing becomes a formula. One writer at a time; failures back off for 5 minutes and show on the settings card.

## Google Calendar
Settings, Integrations, Google Calendar writes one event per booking to a shared calendar (same service-account sign-in as Sheets, `src/lib/google.ts`). Triggers queue a booking in `calendar_sync` when it is created, rescheduled, cancelled, edited or assigned; the dispatcher writes it via `src/lib/calendar-sync.ts` and `src/lib/gcal.ts` using a fixed event ID derived from the reservation, so retries update rather than duplicate. Participants get an "Add to Google Calendar" button and a `{{calendar_link}}` template variable (`src/lib/calendar-link.ts`).

## Rules worth knowing
- Staff see bookings assigned to them, plus bookings of their events not assigned to someone else. Rescheduling by staff needs the permission on their profile.
- A booked slot's time cannot be edited; reschedule its participants first. Capacity cannot go below what is booked.
- Events with reservation records cannot be deleted; cancel them. Cancelling an event cancels its upcoming bookings.
- Participants manage a booking by private link, or by booking ID plus mobile number (rate limited).
- The same person (name and mobile) cannot hold one slot twice; siblings sharing a mobile can.
- Besides the eleven requested tables there are supporting ones: `sessions`, `auth_tokens`, `event_banners`, `notification_templates`, `webhook_events`, `rate_limits`, `schema_migrations`.
