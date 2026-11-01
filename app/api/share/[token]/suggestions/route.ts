import { SuggestionError } from "@/model/suggestion";
import { failureResponse, jsonError, readJson } from "@/server/http";
import { addSuggestion } from "@/server/store";

const SHARE_TOKEN = /^[A-Za-z0-9_-]{20,128}$/;

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const token = (await context.params).token;
    if (!SHARE_TOKEN.test(token)) return jsonError("That share link could not be found.", 404);
    const id = await addSuggestion(token, await readJson(request));
    return Response.json({ id }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SuggestionError) return jsonError(error.message, 400);
    return failureResponse(error);
  }
}
