# Hermes scoring agent contract

## Goal

Create a dedicated East Coast Big Playas Hermes profile and Telegram bot that
accepts conversational score entry in the same style as the Falk Golf League
agent. The website remains the live board and commissioner control surface.

## Source of truth

Postgres is the only production score ledger. The Hermes agent and website must
call the same authenticated server API; neither may maintain an independent
score file or browser-only production state. Scoring and payout calculations
remain deterministic application code, not model-generated arithmetic.

## Telegram intake loop

1. James sends a typed score, scorecard photo, correction, or CTP winner.
2. Hermes resolves the round and player/team against the active tournament
   roster and shows the parsed holes and calculated total.
3. Ambiguous photos or mismatched totals require confirmation. Clear typed
   entries may use a concise confirm-and-submit flow.
4. The server validates the actor, round status, roster owner, hole range, and
   stroke range, then performs per-hole upserts in one transaction.
5. The response reports exactly what changed and the resulting card total.
6. The site reads the same committed state and updates the live board.

Suggested typed commands are intentionally simple:

```text
Ethan skins: 4 5 4 5 4 3 5 4 3 4 5 4 3 4 4 5 3 4
Team 2 scramble: 5 under
CTP hole 6: James
Correct Ethan hole 7 to 6
Show unverified cards
Lock Thursday skins
```

## Manual override

The commissioner site must support correcting a single score, replacing a full
card, changing a CTP winner, and unlocking/relocking a round. Every override
requires a reason and writes an immutable audit record containing actor, time,
before value, after value, and source (`site` or `telegram`). The UI should show
pending card-total mismatches and the recent audit history before a round is
locked.

## API boundary

The first production slice should expose server-only mutations for:

- player hole score upsert
- scramble team result against par
- official card-total check
- closest-to-pin winner
- round lock/unlock
- commissioner correction with reason

Use a dedicated Hermes service credential stored only in the Hermes profile
environment. Do not put database credentials or a Telegram token in the browser.
Writes should accept an idempotency key so Telegram retries cannot duplicate an
operation.

## Test gates

- Unit: strokes, net scores, dead holes, pots, payout ties, invalid input.
- API: authorization, locked rounds, idempotent retries, transaction rollback,
  audit rows, and concurrent writes to different cards.
- Browser: manual score entry, mismatch warning, override reason, lock behavior,
  reload persistence, and live refresh after an agent write.
- Telegram smoke test: typed full card, correction, CTP, photo ambiguity, retry,
  and unauthorized sender.

## Implemented local-Mac path

The production site is hosted on Vercel and the tournament ledger is stored in
Neon Postgres. The existing Falk Golf Hermes Telegram profile runs continuously
on James's Mac and calls the authenticated scoring endpoint through
`scripts/hermes-score.mjs`. The credential is kept in macOS Keychain and in the
Vercel server environment; it is never exposed to browser code.

Hermes must summarize a mutation and receive confirmation before running it.
Read-only `status` commands do not require confirmation. Use an explicit
`--id` value and reuse it if a Telegram/API attempt needs to be retried.
