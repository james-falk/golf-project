import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { accessCookieName, roleFromToken } from "@/lib/access";
import { final2026State, final2026UpdatedAt } from "@/lib/tournament/final-2026";
import { allRoundKeys } from "@/lib/tournament/live-state";
import { sanitizeTournamentStateForViewer } from "@/lib/tournament/public-state";

export const dynamic = "force-dynamic";

/**
 * The 2026 tournament is over, and the board is its permanent record.
 *
 * Every score and payout is hardcoded in final-2026.ts, so this handler reads
 * no database at all: the record cannot drift, expire, or depend on external
 * storage. All rounds are posted, which means a viewer sees everything.
 */
export async function GET() {
  const role = roleFromToken((await cookies()).get(accessCookieName)?.value);
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    state: role === "viewer" ? sanitizeTournamentStateForViewer(final2026State) : final2026State,
    updatedAt: final2026UpdatedAt,
    shared: true,
    locked: true,
  });
}

/**
 * A save changes nothing. The response is the permanent record with every
 * round reported as refused, so a browser holding stale edits converges back
 * to the truth instead of believing it wrote something.
 */
export async function PUT() {
  const role = roleFromToken((await cookies()).get(accessCookieName)?.value);
  if (role !== "scorekeeper") return NextResponse.json({ error: "Scorekeeper access required" }, { status: 403 });
  return NextResponse.json({
    state: final2026State,
    updatedAt: final2026UpdatedAt,
    shared: true,
    locked: true,
    rejectedRounds: allRoundKeys,
  });
}

/** Lifecycle actions ended with the tournament; the record cannot be reseeded or restarted. */
export async function POST() {
  const role = roleFromToken((await cookies()).get(accessCookieName)?.value);
  if (role !== "scorekeeper") return NextResponse.json({ error: "Scorekeeper access required" }, { status: 403 });
  return NextResponse.json(
    { error: "The 2026 tournament is finished and preserved as a permanent record. Nothing can change it.", locked: true },
    { status: 409 },
  );
}
