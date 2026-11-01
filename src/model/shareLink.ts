import { parseTreeDocument } from "./io";
import type { TreeDocument } from "./types";

export async function readShareLink(treeId: string): Promise<string | null> {
  const response = await fetch(`/api/trees/${treeId}/share`);
  const body = await readBody(response);
  if (!response.ok) throw new Error(errorMessage(body, "The share link could not be loaded."));
  if (body?.url == null) return null;
  if (typeof body.url !== "string") throw new Error("The share link could not be loaded.");
  return body.url;
}

export async function createShareLink(treeId: string): Promise<string> {
  return postShareLink(treeId, false, "The share link could not be created.");
}

export async function replaceShareLink(treeId: string): Promise<string> {
  return postShareLink(treeId, true, "The share link could not be replaced.");
}

export async function revokeShareLink(treeId: string): Promise<void> {
  const response = await fetch(`/api/trees/${treeId}/share`, { method: "DELETE" });
  const body = await readBody(response);
  if (!response.ok) throw new Error(errorMessage(body, "The share link could not be turned off."));
}

async function postShareLink(treeId: string, replace: boolean, failure: string): Promise<string> {
  const response = await fetch(`/api/trees/${treeId}/share`, {
    method: "POST",
    headers: replace ? { "content-type": "application/json" } : undefined,
    body: replace ? JSON.stringify({ replace: true }) : undefined,
  });
  const body = await readBody(response);
  if (!response.ok || typeof body?.url !== "string") throw new Error(errorMessage(body, failure));
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
