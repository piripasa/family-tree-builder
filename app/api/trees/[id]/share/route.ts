import { failureResponse, jsonError } from "@/server/http";
import { readSessionUser } from "@/server/session";
import { ensureShare } from "@/server/store";
import { readTreeId } from "@/server/treeBody";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await readSessionUser();
    if (!user) return jsonError("Sign in to share a link.", 401);
    const id = readTreeId((await context.params).id);
    if (!id) return jsonError("That tree is unreadable.", 400);
    const token = await ensureShare(user.id, id);
    const url = `${new URL(request.url).origin}/share/${token}`;
    return Response.json({ url });
  } catch (error) {
    return failureResponse(error);
  }
}
