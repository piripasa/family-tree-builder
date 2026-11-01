import { readSuggestionId, SuggestionError } from "@/model/suggestion";
import { failureResponse, jsonError } from "@/server/http";
import { readSessionUser } from "@/server/session";
import { declineSuggestion } from "@/server/store";
import { readTreeId } from "@/server/treeBody";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; suggestionId: string }> }) {
  try {
    const user = await readSessionUser();
    if (!user) return jsonError("Sign in to review suggestions.", 401);
    const { id: treeValue, suggestionId: suggestionValue } = await context.params;
    const id = readTreeId(treeValue);
    const suggestionId = readSuggestionId(suggestionValue);
    if (!id || !suggestionId) return jsonError("That suggestion is no longer waiting.", 404);
    await declineSuggestion(user.id, id, suggestionId);
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof SuggestionError) return jsonError(error.message, 400);
    return failureResponse(error);
  }
}
