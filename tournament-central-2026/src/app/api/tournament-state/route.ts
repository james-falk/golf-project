import { neon } from "@neondatabase/serverless";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { accessCookieName, roleFromToken } from "@/lib/access";
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

export async function GET() {
  const role = roleFromToken((await cookies()).get(accessCookieName)?.value);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = database();
  if (!sql) return NextResponse.json({ state: null, shared: false });
  await ensureTable(sql);
  const rows = await sql`SELECT payload, updated_at FROM tournament_state WHERE id = ${stateId}`;
  return NextResponse.json({ state: rows[0]?.payload ?? null, updatedAt: rows[0]?.updated_at ?? null, shared: true });
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
  };
  const result = await sql`INSERT INTO tournament_state (id, payload, updated_at)
    VALUES (${stateId}, ${JSON.stringify(merged)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
    RETURNING updated_at`;
  return NextResponse.json({ state: merged, updatedAt: result[0].updated_at, shared: true });
}
