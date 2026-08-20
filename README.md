# East Coast Big Playas — Tournament Central 2026

The 2026 tournament site, now preserved as the permanent record of how it
finished. Every score and payout is hardcoded; see "The 2026 record is final"
below.

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

## The 2026 record is final

The tournament has been played, and the record is permanent. Every score and
payout is hardcoded in `src/lib/tournament/final-2026.ts`, copied verbatim from
the production Neon ledger after the last round was posted on August 10, 2026.
The site serves that module directly: no database is read or written, so the
record cannot drift, expire, or depend on external storage.

- The API always returns the frozen state and reports the board as locked.
- Site saves, lifecycle actions, and Telegram/Hermes scoring commands are all
  refused; nothing can write.
- `npm run tournament:admin` still talks to the retired Neon ledger, which the
  site no longer reads — a change made there will not appear anywhere.

`src/lib/tournament/final-2026.test.ts` pins the payout table the frozen data
produces (Lucas won the money at $242, and the full $2,200 pool is accounted
for). Correcting a proven transcription error means editing `final-2026.ts`,
updating the pinned table, and letting `npm test` prove the arithmetic still
adds up.

## Historical documents

These describe how the live 2026 tournament operated, and are kept as history:

- `db/schema.sql` was the starting Postgres model.
- `docs/PRODUCTION-SETUP.md` describes the access roles the live site used.
- `docs/HERMES-SCORING-AGENT.md` defines the Telegram/Hermes scoring boundary
  the live site enforced.
