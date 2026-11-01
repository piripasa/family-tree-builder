import { AccountConflict, AccountMissing } from "./store";
import { isDatabaseUnavailable } from "./db";

export function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function failureResponse(error: unknown): Response {
  if (error instanceof AccountConflict) return jsonError(error.message, 409);
  if (error instanceof AccountMissing) return jsonError(error.message, 404);
  if (isDatabaseUnavailable(error)) return jsonError("Accounts are not available right now.", 503);
  console.error(error);
  return jsonError("The account could not be reached.", 500);
}
