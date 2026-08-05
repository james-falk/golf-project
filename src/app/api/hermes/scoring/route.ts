import { timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { applyHermesScoringCommand, type HermesScoringCommand } from "@/lib/tournament/hermes-command";
import type { TournamentState } from "@/lib/tournament/state";

export const dynamic = "force-dynamic";
const stateId = "east-coast-big-playas-2026";

function authorized(request: Request) {
  const expected = process.env.HERMES_SCORING_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Shared storage is not configured");
  return neon(url);
}

async function ensureCommandTable(sql: ReturnType<typeof database>) {
  await sql`CREATE TABLE IF NOT EXISTS hermes_score_commands (
    idempotency_key text PRIMARY KEY,
    command jsonb NOT NULL,
    summary text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sql = database();
    const rows = await sql`SELECT payload, updated_at FROM tournament_state WHERE id = ${stateId}`;
    const state = rows[0]?.payload as TournamentState | undefined;
    if (!state) return NextResponse.json({ error: "Tournament state is not initialized" }, { status: 404 });
    return NextResponse.json({
      playerCount: state.players.length,
      scoringDays: ["thursday", "friday", "saturday"],
      players: state.players.map(({ id, name, tier }) => ({ id, name, tier })),
      teamsByDay: state.teamsByDay,
      postings: state.postings,
      updatedAt: rows[0].updated_at,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read tournament" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as { idempotencyKey?: string; command?: HermesScoringCommand };
    if (!body.idempotencyKey || body.idempotencyKey.length > 160) return NextResponse.json({ error: "A valid idempotencyKey is required" }, { status: 400 });
    if (!body.command) return NextResponse.json({ error: "A command is required" }, { status: 400 });

    const sql = database();
    await ensureCommandTable(sql);
    const duplicate = await sql`SELECT summary, created_at FROM hermes_score_commands WHERE idempotency_key = ${body.idempotencyKey}`;
    if (duplicate[0]) return NextResponse.json({ ok: true, duplicate: true, summary: duplicate[0].summary, committedAt: duplicate[0].created_at });

    const rows = await sql`SELECT payload FROM tournament_state WHERE id = ${stateId}`;
    const current = rows[0]?.payload as TournamentState | undefined;
    if (!current) return NextResponse.json({ error: "Tournament state is not initialized" }, { status: 404 });
    const result = applyHermesScoringCommand(current, body.command);

    const [, updatedRows] = await sql.transaction((tx) => [
      tx`INSERT INTO hermes_score_commands (idempotency_key, command, summary) VALUES (${body.idempotencyKey}, ${JSON.stringify(body.command)}::jsonb, ${result.summary}) ON CONFLICT (idempotency_key) DO NOTHING`,
      tx`UPDATE tournament_state SET payload = ${JSON.stringify(result.state)}::jsonb, updated_at = now() WHERE id = ${stateId} RETURNING updated_at`,
    ]);
    return NextResponse.json({ ok: true, duplicate: false, summary: result.summary, total: result.total, committedAt: updatedRows[0]?.updated_at });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to apply score command";
    const status = /required|must|unknown|ambiguous|exactly|there is no/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
