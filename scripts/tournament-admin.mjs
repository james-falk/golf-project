#!/usr/bin/env node

/**
 * Backend administration for a locked tournament.
 *
 * Once the commissioner starts the tournament the site can only enter scores:
 * the roster, the teams and the lock itself are deliberately not editable from
 * the browser. This is the way back in.
 *
 * Needs DATABASE_URL. The simplest way to get it:
 *   npx vercel env pull .env.local
 *   node --env-file=.env.local scripts/tournament-admin.mjs status
 */

import { neon } from "@neondatabase/serverless";

const stateId = "east-coast-big-playas-2026";
const tiers = ["A", "B", "C", "D"];
const skinDays = ["thursday", "friday", "saturday"];
const scrambleDays = ["friday", "saturday"];

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const [command, ...values] = args.filter((value) => value !== "--yes");

function usage() {
  return `Tournament backend administration.

Read:
  status                                  lock state, roster, teams and round postings

Write (add --yes to apply):
  set-tier <player> <A|B|C|D>             move a player's stroke band
  rename-player <player> <new name>       correct a player's name
  reopen-round <skins|scramble> <day>     return a posted round to review
  unlock                                  clear the lock so the site can edit again
  lock                                    re-lock the tournament

Every write prints the change and refuses to run without --yes.`;
}

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Run: npx vercel env pull .env.local");
  return neon(url);
}

const normalize = (value) => String(value).trim().toLowerCase();

function resolvePlayer(players, query) {
  if (!query) throw new Error("A player name is required");
  const needle = normalize(query);
  const exact = players.filter((player) => normalize(player.name) === needle);
  if (exact.length === 1) return exact[0];
  const partial = players.filter((player) => normalize(player.name).includes(needle));
  if (partial.length === 1) return partial[0];
  if (!partial.length) throw new Error(`Unknown player: ${query}`);
  throw new Error(`Ambiguous player "${query}": ${partial.map((player) => player.name).join(", ")}`);
}

function describe(state) {
  const byTier = tiers.map((tier) => `${tier}: ${state.players.filter((player) => player.tier === tier).map((player) => player.name).join(", ") || "—"}`);
  const postings = Object.entries(state.postings ?? {}).map(([key, posting]) => `  ${key}: ${posting.status}${posting.revision ? ` (revision ${posting.revision})` : ""}`);
  const teams = ["friday", "saturday"].map((day) => {
    const rows = (state.teamsByDay?.[day] ?? []).map((team) => `    ${team.name}: ${team.playerIds.map((id) => state.players.find((player) => player.id === id)?.name ?? id).join(", ")}`);
    return `  ${day}\n${rows.join("\n") || "    —"}`;
  });

  return [
    state.lockedAt ? `LOCKED since ${state.lockedAt}` : "NOT LOCKED — the site can still edit the roster and teams",
    `${state.players.length} players`,
    ...byTier.map((line) => `  ${line}`),
    "Teams:",
    ...teams,
    "Rounds:",
    ...(postings.length ? postings : ["  none posted"]),
    `Scores stored: ${Object.keys(state.skinScores ?? {}).length} skins cards, ${Object.keys(state.scrambleScores ?? {}).length} scramble cards`,
  ].join("\n");
}

async function readState(sql) {
  const rows = await sql`SELECT payload FROM tournament_state WHERE id = ${stateId}`;
  if (!rows[0]) throw new Error("No tournament state is stored yet.");
  return rows[0].payload;
}

async function writeState(sql, state) {
  await sql`UPDATE tournament_state SET payload = ${JSON.stringify(state)}::jsonb, updated_at = now() WHERE id = ${stateId}`;
}

function apply(state, command, values) {
  if (command === "set-tier") {
    const player = resolvePlayer(state.players, values[0]);
    const tier = String(values[1] ?? "").toUpperCase();
    if (!tiers.includes(tier)) throw new Error(`Tier must be one of ${tiers.join(", ")}`);
    if (player.tier === tier) throw new Error(`${player.name} is already in the ${tier} band`);
    return {
      summary: `${player.name} (${player.id}): ${player.tier} band -> ${tier} band`,
      next: { ...state, players: state.players.map((entry) => entry.id === player.id ? { ...entry, tier } : entry) },
    };
  }

  if (command === "rename-player") {
    const player = resolvePlayer(state.players, values[0]);
    const name = values.slice(1).join(" ").trim();
    if (!name) throw new Error("A new name is required");
    return {
      summary: `${player.id}: "${player.name}" -> "${name}"`,
      next: { ...state, players: state.players.map((entry) => entry.id === player.id ? { ...entry, name } : entry) },
    };
  }

  if (command === "reopen-round") {
    const round = normalize(values[0]);
    const day = normalize(values[1]);
    if (round !== "skins" && round !== "scramble") throw new Error("Round must be skins or scramble");
    const allowed = round === "skins" ? skinDays : scrambleDays;
    if (!allowed.includes(day)) throw new Error(`${round} days are ${allowed.join(", ")}`);
    const key = `${round}-${day}`;
    const posting = state.postings?.[key];
    if (posting?.status !== "posted") throw new Error(`${key} is not posted`);
    return {
      summary: `${key}: posted (revision ${posting.revision}) -> review`,
      next: { ...state, postings: { ...state.postings, [key]: { status: "review", revision: posting.revision } } },
    };
  }

  if (command === "unlock") {
    if (!state.lockedAt) throw new Error("The tournament is not locked");
    const { lockedAt, ...rest } = state;
    return { summary: `Lock cleared (was ${lockedAt}). The site can edit the roster and teams again.`, next: rest };
  }

  if (command === "lock") {
    if (state.lockedAt) throw new Error(`Already locked since ${state.lockedAt}`);
    const lockedAt = new Date().toISOString();
    return { summary: `Locked at ${lockedAt}.`, next: { ...state, lockedAt } };
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  if (!command || command === "help" || command === "--help") {
    console.log(usage());
    process.exit(0);
  }

  const sql = database();
  const state = await readState(sql);

  if (command === "status") {
    console.log(describe(state));
    process.exit(0);
  }

  const { summary, next } = apply(state, command, values);
  console.log(summary);
  if (!yes) {
    console.log("\nNothing written. Re-run with --yes to apply.");
    process.exit(0);
  }
  await writeState(sql, next);
  console.log("\nApplied. Current state:\n");
  console.log(describe(next));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
