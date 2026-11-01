import { parseTreeDocument } from "@/model/io";
import { failureResponse, jsonError, readJson } from "@/server/http";
import { readSessionUser } from "@/server/session";
import { deleteOwnedTree, updateOwnedTree } from "@/server/store";
import { readTreeId, readTreeUpdate } from "@/server/treeBody";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await readSessionUser();
    if (!user) return jsonError("Sign in to open your account.", 401);
    const id = readTreeId((await context.params).id);
    if (!id) return jsonError("That tree is unreadable.", 400);
    const body = readTreeUpdate(await readJson(request));
    if (!body.ok) return jsonError(body.error, 400);
    const document = parseTreeDocument(body.document);
    if (!document.ok) return jsonError(document.error, 400);
    await updateOwnedTree(user.id, { id, title: body.title, document: document.document });
    return Response.json({ ok: true });
  } catch (error) {
    return failureResponse(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await readSessionUser();
    if (!user) return jsonError("Sign in to open your account.", 401);
    const id = readTreeId((await context.params).id);
    if (!id) return jsonError("That tree is unreadable.", 400);
    await deleteOwnedTree(user.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    return failureResponse(error);
  }
}
