import { failureResponse, jsonError, readJson } from "@/server/http";
import { readSessionUser } from "@/server/session";
import { ensureShare, findShare, replaceShare, revokeShare } from "@/server/store";
import { readTreeId } from "@/server/treeBody";

const NO_STORE = { "cache-control": "no-store" };

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await readSessionUser();
    if (!user) return jsonError("Sign in to share a link.", 401);
    const id = readTreeId((await context.params).id);
    if (!id) return jsonError("That tree is unreadable.", 400);
    const token = await findShare(user.id, id);
    return Response.json({ url: token ? shareUrl(request, token) : null }, { headers: NO_STORE });
  } catch (error) {
    return failureResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await readSessionUser();
    if (!user) return jsonError("Sign in to share a link.", 401);
    const id = readTreeId((await context.params).id);
    if (!id) return jsonError("That tree is unreadable.", 400);
    const body = await readJson(request);
    const token = wantsReplace(body) ? await replaceShare(user.id, id) : await ensureShare(user.id, id);
    return Response.json({ url: shareUrl(request, token) }, { headers: NO_STORE });
  } catch (error) {
    return failureResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await readSessionUser();
    if (!user) return jsonError("Sign in to share a link.", 401);
    const id = readTreeId((await context.params).id);
    if (!id) return jsonError("That tree is unreadable.", 400);
    await revokeShare(user.id, id);
    return Response.json({ url: null }, { headers: NO_STORE });
  } catch (error) {
    return failureResponse(error);
  }
}

function shareUrl(request: Request, token: string): string {
  return `${new URL(request.url).origin}/share/${token}`;
}

function wantsReplace(body: unknown): boolean {
  return Boolean(
    body && typeof body === "object" && !Array.isArray(body) && (body as { replace?: unknown }).replace === true,
  );
}
