import { failureResponse, jsonError } from "@/server/http";
import { loadSharedByToken } from "@/server/store";

const SHARE_TOKEN = /^[A-Za-z0-9_-]{20,128}$/;

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const token = (await context.params).token;
    if (!SHARE_TOKEN.test(token)) return jsonError("That share link could not be found.", 404);
    const shared = await loadSharedByToken(token);
    if (!shared) return jsonError("That share link could not be found.", 404);
    return Response.json(shared, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return failureResponse(error);
  }
}
