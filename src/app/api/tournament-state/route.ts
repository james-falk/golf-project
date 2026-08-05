import { neon } from "@neondatabase/serverless";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { accessCookieName, roleFromToken } from "@/lib/access";
import { makeMockTournamentState } from "@/lib/tournament/mock-state";
import { sanitizeTournamentStateForViewer } from "@/lib/tournament/public-state";
import { startingRoster } from "@/lib/tournament/seed";
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

function hasCurrentRoster(state: TournamentState | null) {
  if (!state || state.players.length !== startingRoster.length) return false;
  const currentIds = new Set(startingRoster.map((player) => player.id));
  return state.players.every((player) => currentIds.has(player.id));
}

async function seedCurrentMockState(sql: NonNullable<ReturnType<typeof database>>) {
  const state = makeMockTournamentState();
  const rows = await sql`INSERT INTO tournament_state (id, payload, updated_at)
    VALUES (${stateId}, ${JSON.stringify(state)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
    RETURNING updated_at`;
  return { state, updatedAt: rows[0].updated_at };
}

export async function GET() {
  const role = roleFromToken((await cookies()).get(accessCookieName)?.value);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = database();
  if (!sql) return NextResponse.json({ state: null, shared: false });
  await ensureTable(sql);
  const rows = await sql`SELECT payload, updated_at FROM tournament_state WHERE id = ${stateId}`;
  let state = (rows[0]?.payload ?? null) as TournamentState | null;
  let updatedAt = rows[0]?.updated_at ?? null;
  if (!hasCurrentRoster(state)) {
    const seeded = await seedCurrentMockState(sql);
    state = seeded.state;
    updatedAt = seeded.updatedAt;
  }
  if (!state) return NextResponse.json({ state: null, updatedAt, shared: true });
  return NextResponse.json({ state: role === "viewer" ? sanitizeTournamentStateForViewer(state) : state, updatedAt, shared: true });
}

export async function PUT(request: Request) {
  const role = roleFromToken((await cookies()).get(accessCookieName)?.value);
  if (role !== "scorekeeper") return NextResponse.json({ error: "Scorekeeper access required" }, { status: 403 });
  const incoming = await request.json() as TournamentState;
  const sql = database();
  if (!sql) return NextResponse.json({ error: "Shared storage is not configured" }, { status: 503 });
  await ensureTable(sql);
  const rows = await sql`SELECT payload FROM tournament_state WHERE id = ${stateId}`;
  const current = (rows[0]?.payload ?? {}) as Partial<TournamentState>;
  const merged: TournamentState = {
    players: incoming.players,
    teamsByDay: incoming.teamsByDay,
    skinScores: { ...(current.skinScores ?? {}), ...(incoming.skinScores ?? {}) },
    skinOfficialTotals: { ...(current.skinOfficialTotals ?? {}), ...(incoming.skinOfficialTotals ?? {}) },
    closestToPin: { ...(current.closestToPin ?? {}), ...(incoming.closestToPin ?? {}) },
    scrambleScores: { ...(current.scrambleScores ?? {}), ...(incoming.scrambleScores ?? {}) },
    scrambleOfficialTotals: { ...(current.scrambleOfficialTotals ?? {}), ...(incoming.scrambleOfficialTotals ?? {}) },
    postings: { ...(current.postings ?? {}), ...(incoming.postings ?? {}) },
  };
  const result = await sql`INSERT INTO tournament_state (id, payload, updated_at)
    VALUES (${stateId}, ${JSON.stringify(merged)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
    RETURNING updated_at`;
  return NextResponse.json({ state: merged, updatedAt: result[0].updated_at, shared: true });
}
