import { failureResponse, jsonError, readJson } from "@/server/http";
import { readSessionUser } from "@/server/session";
import { setOwnedActiveTree } from "@/server/store";
import { readTreeId } from "@/server/treeBody";

export async function PUT(request: Request) {
  try {
    const user = await readSessionUser();
    if (!user) return jsonError("Sign in to open your account.", 401);
    const body = await readJson(request);
    const activeId =
      body && typeof body === "object" && !Array.isArray(body) && typeof (body as { activeId?: unknown }).activeId === "string"
        ? readTreeId((body as { activeId: string }).activeId)
        : null;
    if (!activeId) return jsonError("That tree is unreadable.", 400);
    await setOwnedActiveTree(user.id, activeId);
    return Response.json({ ok: true });
  } catch (error) {
    return failureResponse(error);
  }
}
