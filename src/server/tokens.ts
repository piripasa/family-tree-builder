import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "ftb_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
