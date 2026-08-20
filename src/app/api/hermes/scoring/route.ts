import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { final2026State, final2026UpdatedAt } from "@/lib/tournament/final-2026";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.HERMES_SCORING_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

/**
 * The finished tournament, served from the hardcoded record in final-2026.ts.
 * No database is consulted; see the note there.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reported = (day: "friday" | "saturday") => (final2026State.teamsByDay?.[day] ?? []).length;
  return NextResponse.json({
    playerCount: final2026State.players.length,
    scoringDays: ["thursday", "friday", "saturday"],
    players: final2026State.players.map(({ id, name, tier }) => ({ id, name, tier })),
    scrambleTeams: {
      note: "The 2026 tournament is finished. These are the scramble teams exactly as their results were reported; only teams in the money were ever reported at all.",
      reportedSoFar: { friday: reported("friday"), saturday: reported("saturday") },
      friday: final2026State.teamsByDay?.friday ?? [],
      saturday: final2026State.teamsByDay?.saturday ?? [],
    },
    postings: final2026State.postings,
    updatedAt: final2026UpdatedAt,
  });
}

/** Scoring closed with the tournament. The record is hardcoded and nothing can write to it. */
export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(
    { error: "The 2026 tournament is finished and preserved as a permanent record. Scoring is closed." },
    { status: 409 },
  );
}
