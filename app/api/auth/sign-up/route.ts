import { parseStoredLibrary, createLibrary } from "@/model/library";
import { normalizeEmail, passwordError } from "@/server/credentials";
import { failureResponse, jsonError, readJson } from "@/server/http";
import { hashPassword } from "@/server/password";
import { openSession } from "@/server/session";
import { createAccount, loadOwnedLibrary } from "@/server/store";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Enter an email and a password.", 400);
    }
    const record = body as Record<string, unknown>;
    const email = typeof record.email === "string" ? normalizeEmail(record.email) : null;
    if (!email) return jsonError("Enter a valid email.", 400);
    if (typeof record.password !== "string") return jsonError("Enter a password.", 400);
    const invalidPassword = passwordError(record.password);
    if (invalidPassword) return jsonError(invalidPassword, 400);

    const parsedLibrary = record.library == null ? { ok: true as const, library: createLibrary() } : parseStoredLibrary(record.library);
    if (!parsedLibrary.ok) return jsonError(parsedLibrary.error, 400);

    const userId = await createAccount(email, await hashPassword(record.password), parsedLibrary.library);
    await openSession(userId);
    return Response.json({ email, library: await loadOwnedLibrary(userId) });
  } catch (error) {
    return failureResponse(error);
  }
}
