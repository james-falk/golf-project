# Production setup

The preview currently uses browser storage so the tournament workflow can be
reviewed before any account or roster is supplied. Production must use the
Postgres schema in `db/schema.sql`; browser storage is never the source of truth
for score entry.

## Required deployment setup

1. Create a distinct Vercel project for `tournament-central-2026`.
2. Add Neon Postgres through the Vercel Marketplace. This injects `DATABASE_URL`.
3. Apply `db/schema.sql` once against that database.
4. Set the four secrets described in `.env.example` in Vercel's Production
   environment. Passcodes are stored/compared server-side and are never sent to
   the browser.
5. Deploy the 2025 archive as a separate project with `ARCHIVE_MODE=true` and
   `NEXT_PUBLIC_ARCHIVE_MODE=true`. Do not attach the 2026 database to it.

## Access model

- **Viewer:** passcode-only, dashboard and Big Playas Desk.
- **Helper:** named code, only assigned playing groups/scorecards.
- **Commissioner:** roster, groups, teams, CTP winners, overrides, locks, and
  audit history.

Every score mutation is an upsert for one player/team and one hole. This avoids
the legacy application's single-record overwrite problem when multiple helpers
are working simultaneously.
