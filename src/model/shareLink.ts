import { parseTreeDocument } from "./io";
import type { TreeDocument } from "./types";

export async function createShareLink(treeId: string): Promise<string> {
  const response = await fetch(`/api/trees/${treeId}/share`, { method: "POST" });
  const body = await readBody(response);
  if (!response.ok || typeof body?.url !== "string") {
    throw new Error(errorMessage(body, "The share link could not be created."));
  }
  return body.url;
}

export async function loadShare(token: string): Promise<{ title: string; document: TreeDocument }> {
  const response = await fetch(`/api/share/${encodeURIComponent(token)}`);
  const body = await readBody(response);
  if (!response.ok) throw new Error(errorMessage(body, "That share link could not be found."));
  const parsed = parseTreeDocument(body?.document);
  if (!parsed.ok || typeof body?.title !== "string") {
    throw new Error("That share link could not be found.");
  }
  return { title: body.title, document: parsed.document };
}

async function readBody(response: Response): Promise<Record<string, unknown> | null> {
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

function errorMessage(body: Record<string, unknown> | null, fallback: string): string {
  return typeof body?.error === "string" && body.error ? body.error : fallback;
}
