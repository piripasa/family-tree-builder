import { parseTreeDocument } from "@/model/io";
import { failureResponse, jsonError, readJson } from "@/server/http";
import { readSessionUser } from "@/server/session";
import { insertOwnedTree, loadOwnedLibrary } from "@/server/store";
import { readTreeBody } from "@/server/treeBody";

export async function GET() {
  try {
    const user = await readSessionUser();
    if (!user) return jsonError("Sign in to open your account.", 401);
    return Response.json(await loadOwnedLibrary(user.id));
  } catch (error) {
    return failureResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await readSessionUser();
    if (!user) return jsonError("Sign in to open your account.", 401);
    const body = await readJson(request);
    const tree = readTreeBody(body);
    if (!tree.ok) return jsonError(tree.error, 400);
    const document = parseTreeDocument(tree.document);
    if (!document.ok) return jsonError(document.error, 400);
    await insertOwnedTree(user.id, { id: tree.id, title: tree.title, document: document.document });
    return Response.json({ ok: true });
  } catch (error) {
    return failureResponse(error);
  }
}
