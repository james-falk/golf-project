import { createHmac, timingSafeEqual } from "node:crypto";

export type AccessRole = "viewer" | "scorekeeper";
export const accessCookieName = "ecbp_access";

function secret() {
  return process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "local-development-secret");
}

export function accessToken(role: AccessRole) {
  const signature = createHmac("sha256", secret()).update(role).digest("hex");
  return `${role}.${signature}`;
}

export function roleFromToken(token?: string): AccessRole | null {
  if (!token || !secret()) return null;
  const [role, signature] = token.split(".");
  if ((role !== "viewer" && role !== "scorekeeper") || !signature) return null;
  const expected = createHmac("sha256", secret()).update(role).digest("hex");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  return role;
}
