import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { accessCookieName, accessToken, roleFromToken, type AccessRole } from "@/lib/access";

export async function GET() {
  const role = roleFromToken((await cookies()).get(accessCookieName)?.value);
  return NextResponse.json({ role });
}

export async function POST(request: Request) {
  const { code } = await request.json() as { code?: string };
  const viewerCode = process.env.VIEWER_PASSCODE ?? (process.env.NODE_ENV === "production" ? "" : "duckblind");
  const scorekeeperCode = process.env.SCOREKEEPER_PASSCODE ?? (process.env.NODE_ENV === "production" ? "" : "commissioner");
  let role: AccessRole | null = null;
  if (code && code === scorekeeperCode) role = "scorekeeper";
  else if (code && code === viewerCode) role = "viewer";
  if (!role) return NextResponse.json({ error: "That clubhouse passcode was not recognized." }, { status: 401 });

  const response = NextResponse.json({ role });
  response.cookies.set(accessCookieName, accessToken(role), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ role: null });
  response.cookies.set(accessCookieName, "", { expires: new Date(0), path: "/" });
  return response;
}
