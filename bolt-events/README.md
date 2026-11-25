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

## Rules worth knowing
- Staff see bookings assigned to them, plus bookings of their events not assigned to someone else. Rescheduling by staff needs the permission on their profile.
- A booked slot's time cannot be edited; reschedule its participants first. Capacity cannot go below what is booked.
- Events with reservation records cannot be deleted; cancel them. Cancelling an event cancels its upcoming bookings.
- Participants manage a booking by private link, or by booking ID plus mobile number (rate limited).
- The same person (name and mobile) cannot hold one slot twice; siblings sharing a mobile can.
- Besides the eleven requested tables there are supporting ones: `sessions`, `auth_tokens`, `event_banners`, `notification_templates`, `webhook_events`, `rate_limits`, `schema_migrations`.
