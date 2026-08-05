# East Coast Big Playas — Tournament Central 2026

Local preview and rules engine for the 2026 tournament.

## Run locally

```bash
npm install
npm run dev
```

Open the `Local` URL printed by Next.js. It uses port 3000 when available and
automatically chooses another port when it is not.

Local development passcodes:

- Viewer: `duckblind`
- Commissioner/scorekeeper: `commissioner`

The active experience is the designed clubhouse site: access gate, lodge
homepage, five-round scoring hub, commissioner entry surfaces, and the gallery
preview. The retired scrolling-story video is not part of the active app.

## Generate Jeff's reaction audio

Add `ELEVENLABS_API_KEY` to `.env.local`, then run:

```bash
npm run audio:jeff
```

This generates `public/audio/jeff-poke.mp3` once. The browser plays that local
file on every poke; the ElevenLabs key is never shipped to the client. Set the
optional `ELEVENLABS_VOICE_ID` to replace the prototype voice.

## Verify before changing scoring

```bash
npm test
npm run lint
npm run build
```

## Deployment

The production Vercel project is connected to the `main` branch of
[`james-falk/golf-project`](https://github.com/james-falk/golf-project).
Pushing a verified commit to `main` deploys it to
[`eastcoastbigplayas.com`](https://eastcoastbigplayas.com).

A browser draft is kept under `ecbp-2026-scorekeeper-draft-v5`, but it is only
used when there is no shared database at all. Once Postgres answers, the stored
ledger is the single source of truth and a stale local draft can never be
replayed over it.

## Tournament lifecycle

The board has two states, and the move between them is one-way from the site.

**Not started.** Everything is disposable. Commissioner setup can rearrange the
roster and both days of teams, and `Load preview data for testing` fills the
board with throwaway scores so the whole workflow can be rehearsed.

**Started and locked.** `Start the tournament & lock the field` clears every
score, keeps the confirmed 23-player roster and the teams as arranged, and marks
the ledger locked. From that moment:

- nothing reseeds or regenerates the board — a page load only ever reads
- the site cannot change the roster or the teams, and ignores any attempt to
- a posted round refuses further scores, from the site and from Telegram alike,
  until the commissioner returns it to review
- score entry is otherwise unchanged

Changing a locked tournament is deliberately a backend-only action:

```bash
npx vercel env pull .env.local
npm run tournament:admin status
```

`tournament:admin` can move a stroke band, correct a name, reopen a posted
round, and unlock or re-lock the tournament. Every write prints the change first
and does nothing without `--yes`.

## Production direction

- `db/schema.sql` is the starting Postgres model.
- `docs/PRODUCTION-SETUP.md` describes the intended access roles.
- `docs/HERMES-SCORING-AGENT.md` defines the Telegram/Hermes scoring boundary
  and commissioner override requirements.
