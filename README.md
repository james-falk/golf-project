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

The preview saves score entry in browser local storage under
`ecbp-2026-scorekeeper-draft-v4`. That is suitable for workflow testing on one browser only;
it is not the production source of truth and cannot be shared with Telegram.

## Production direction

- `db/schema.sql` is the starting Postgres model.
- `docs/PRODUCTION-SETUP.md` describes the intended access roles.
- `docs/HERMES-SCORING-AGENT.md` defines the Telegram/Hermes scoring boundary
  and commissioner override requirements.
