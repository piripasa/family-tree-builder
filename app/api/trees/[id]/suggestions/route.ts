import { failureResponse, jsonError } from "@/server/http";
import { readSessionUser } from "@/server/session";
import { listSuggestions } from "@/server/store";
import { readTreeId } from "@/server/treeBody";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await readSessionUser();
    if (!user) return jsonError("Sign in to review suggestions.", 401);
    const id = readTreeId((await context.params).id);
    if (!id) return jsonError("That tree is unreadable.", 400);
    const suggestions = await listSuggestions(user.id, id);
    return Response.json({ suggestions }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return failureResponse(error);
  }
}
