import { neon } from "@neondatabase/serverless";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { accessCookieName, roleFromToken } from "@/lib/access";
import { isTournamentLocked, makeCleanTournamentState, mergeSiteSave } from "@/lib/tournament/live-state";
import { makeMockTournamentState } from "@/lib/tournament/mock-state";
import { sanitizeTournamentStateForViewer } from "@/lib/tournament/public-state";
import type { TournamentState } from "@/lib/tournament/state";

export const dynamic = "force-dynamic";
const stateId = "east-coast-big-playas-2026";

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

async function ensureTable(sql: NonNullable<ReturnType<typeof database>>) {
  await sql`CREATE TABLE IF NOT EXISTS tournament_state (
    id text PRIMARY KEY,
    payload jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
}

async function readState(sql: NonNullable<ReturnType<typeof database>>) {
  const rows = await sql`SELECT payload, updated_at FROM tournament_state WHERE id = ${stateId}`;
  return { state: (rows[0]?.payload ?? null) as TournamentState | null, updatedAt: rows[0]?.updated_at ?? null };
}

async function writeState(sql: NonNullable<ReturnType<typeof database>>, state: TournamentState) {
  const rows = await sql`INSERT INTO tournament_state (id, payload, updated_at)
    VALUES (${stateId}, ${JSON.stringify(state)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
    RETURNING updated_at`;
  return rows[0].updated_at;
}

/**
 * Reads the ledger. This handler never writes: a page load must not be able to
 * change, reseed or overwrite a tournament that is in progress.
 */
export async function GET() {
  const role = roleFromToken((await cookies()).get(accessCookieName)?.value);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = database();
  if (!sql) return NextResponse.json({ state: null, shared: false, locked: false });
  await ensureTable(sql);
  const { state, updatedAt } = await readState(sql);
  const locked = isTournamentLocked(state);
  if (!state) return NextResponse.json({ state: null, updatedAt, shared: true, locked });
  return NextResponse.json({
    state: role === "viewer" ? sanitizeTournamentStateForViewer(state) : state,
    updatedAt,
    shared: true,
    locked,
  });
}

export async function PUT(request: Request) {
  const role = roleFromToken((await cookies()).get(accessCookieName)?.value);
  if (role !== "scorekeeper") return NextResponse.json({ error: "Scorekeeper access required" }, { status: 403 });
  const incoming = await request.json() as TournamentState;
  const sql = database();
  if (!sql) return NextResponse.json({ error: "Shared storage is not configured" }, { status: 503 });
  await ensureTable(sql);
  const { state: current } = await readState(sql);

  // A locked tournament ignores any roster or team the browser sends, and refuses
  // score changes to a round that is already posted.
  const { merged, rejected } = mergeSiteSave(current ?? {}, incoming);
  const updatedAt = await writeState(sql, merged);
  return NextResponse.json({
    state: merged,
    updatedAt,
    shared: true,
    locked: isTournamentLocked(merged),
    rejectedRounds: rejected,
  });
}

/**
 * Commissioner lifecycle actions.
 *
 * - `seed-preview` fills the board with throwaway mock scores for testing.
 * - `start-tournament` clears every score, keeps the confirmed roster and the
 *   arranged teams, and locks the ledger. Both refuse to run once locked; from
 *   that point the tournament is only editable from the backend.
 */
export async function POST(request: Request) {
  const role = roleFromToken((await cookies()).get(accessCookieName)?.value);
  if (role !== "scorekeeper") return NextResponse.json({ error: "Scorekeeper access required" }, { status: 403 });
  const { action } = await request.json() as { action?: string };
  const sql = database();
  if (!sql) return NextResponse.json({ error: "Shared storage is not configured" }, { status: 503 });
  await ensureTable(sql);
  const { state: current } = await readState(sql);

  if (isTournamentLocked(current)) {
    return NextResponse.json(
      { error: "The tournament is locked. Unlocking is a backend-only action.", locked: true },
      { status: 409 },
    );
  }

  if (action === "seed-preview") {
    const state = makeMockTournamentState();
    const updatedAt = await writeState(sql, state);
    return NextResponse.json({ state, updatedAt, shared: true, locked: false });
  }

  if (action === "start-tournament") {
    const state = makeCleanTournamentState(current, new Date().toISOString());
    const updatedAt = await writeState(sql, state);
    return NextResponse.json({ state, updatedAt, shared: true, locked: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
