import { access } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function HEAD() {
  try {
    await access(path.join(process.cwd(), "public", "audio", "jeff-poke.mp3"));
    return new NextResponse(null, { status: 204, headers: { "x-jeff-audio": "ready" } });
  } catch {
    return new NextResponse(null, { status: 204, headers: { "x-jeff-audio": "pending" } });
  }
}
