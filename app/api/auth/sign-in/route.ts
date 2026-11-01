import { normalizeEmail, passwordError } from "@/server/credentials";
import { failureResponse, jsonError, readJson } from "@/server/http";
import { verifyPassword } from "@/server/password";
import { openSession } from "@/server/session";
import { findUserByEmail, loadOwnedLibrary } from "@/server/store";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Enter an email and a password.", 400);
    }
    const record = body as Record<string, unknown>;
    const email = typeof record.email === "string" ? normalizeEmail(record.email) : null;
    if (!email || typeof record.password !== "string" || passwordError(record.password)) {
      return jsonError("That email or password is wrong.", 401);
    }
    const user = await findUserByEmail(email);
    if (!user || !(await verifyPassword(record.password, user.password_hash))) {
      return jsonError("That email or password is wrong.", 401);
    }
    await openSession(user.id);
    return Response.json({ email: user.email, library: await loadOwnedLibrary(user.id) });
  } catch (error) {
    return failureResponse(error);
  }
}
