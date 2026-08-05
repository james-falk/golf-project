#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const endpoint = process.env.EAST_COAST_SCORING_URL ?? "https://eastcoastbigplayas.com/api/hermes/scoring";
const args = process.argv.slice(2);

function token() {
  if (process.env.HERMES_SCORING_TOKEN) return process.env.HERMES_SCORING_TOKEN;
  if (process.platform === "darwin") {
    try {
      return execFileSync("security", ["find-generic-password", "-a", process.env.USER ?? "jamesfalk", "-s", "east-coast-big-playas-hermes-bigplayas", "-w"], { encoding: "utf8" }).trim();
    } catch { /* handled below */ }
  }
  throw new Error("Hermes scoring credential is unavailable");
}

function usage() {
  return `Commands:
  status
  player-card <day> <player> <18 scores> [--id key]
  player-hole <day> <player> <hole> <strokes> [--id key]
  ctp <day> <hole> <player> [--id key]
  scramble-card <day> <team> <18 scores> [--id key]
  scramble-hole <day> <team> <hole> <strokes> [--id key]
  round-status <day> <skins|scramble> <review|posted> [--id key]

Wrap multi-word player or team names in quotes.`;
}

function takeId(values) {
  const index = values.indexOf("--id");
  if (index === -1) return { values, idempotencyKey: randomUUID() };
  const idempotencyKey = values[index + 1];
  if (!idempotencyKey) throw new Error("--id requires a value");
  return { values: [...values.slice(0, index), ...values.slice(index + 2)], idempotencyKey };
}

async function request(method, body) {
  const response = await fetch(endpoint, {
    method,
    headers: { authorization: `Bearer ${token()}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
  if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`);
  return payload;
}

function parse() {
  const [name, ...raw] = args;
  if (!name || name === "help" || name === "--help") return null;
  if (name === "status") return { method: "GET" };
  const { values, idempotencyKey } = takeId(raw);
  let command;
  if (name === "player-card") command = { type: name, day: values[0], player: values[1], scores: values.slice(2).map(Number) };
  else if (name === "player-hole") command = { type: name, day: values[0], player: values[1], hole: Number(values[2]), strokes: Number(values[3]) };
  else if (name === "ctp") command = { type: name, day: values[0], hole: Number(values[1]), player: values[2] };
  else if (name === "scramble-card") command = { type: name, day: values[0], team: values[1], scores: values.slice(2).map(Number) };
  else if (name === "scramble-hole") command = { type: name, day: values[0], team: values[1], hole: Number(values[2]), strokes: Number(values[3]) };
  else if (name === "round-status") command = { type: name, day: values[0], round: values[1], status: values[2] };
  else throw new Error(`Unknown command: ${name}`);
  return { method: "POST", body: { idempotencyKey, command } };
}

try {
  const parsed = parse();
  if (!parsed) {
    console.log(usage());
    process.exit(0);
  }
  const result = await request(parsed.method, parsed.body);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
