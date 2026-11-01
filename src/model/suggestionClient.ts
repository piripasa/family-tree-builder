import { parseTreeDocument } from "./io";
import { parseSuggestion } from "./suggestion";
import type { StoredSuggestion, SuggestionDraft } from "./suggestion";
import type { TreeDocument } from "./types";

export async function loadSuggestions(treeId: string): Promise<StoredSuggestion[]> {
  const response = await fetch(`/api/trees/${treeId}/suggestions`);
  const body = await readBody(response);
  if (!response.ok || !Array.isArray(body?.suggestions)) {
    throw new Error(errorMessage(body, "Suggestions could not be loaded."));
  }
  const suggestions: StoredSuggestion[] = [];
  for (const entry of body.suggestions) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as { id?: unknown };
    if (typeof record.id !== "string") continue;
    const parsed = parseSuggestion(entry);
    if (parsed.ok) suggestions.push({ ...parsed.suggestion, id: record.id });
  }
  return suggestions;
}

export async function submitSuggestion(token: string, suggestion: SuggestionDraft): Promise<void> {
  const response = await fetch(`/api/share/${encodeURIComponent(token)}/suggestions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(suggestion),
  });
  const body = await readBody(response);
  if (!response.ok) throw new Error(errorMessage(body, "That suggestion could not be sent."));
}

export async function acceptSuggestion(treeId: string, suggestionId: string): Promise<TreeDocument> {
  const response = await fetch(`/api/trees/${treeId}/suggestions/${suggestionId}/accept`, { method: "POST" });
  const body = await readBody(response);
  if (!response.ok) throw new Error(errorMessage(body, "That suggestion could not be accepted."));
  const parsed = parseTreeDocument(body?.document);
  if (!parsed.ok) throw new Error("That suggestion could not be accepted.");
  return parsed.document;
}

export async function declineSuggestion(treeId: string, suggestionId: string): Promise<void> {
  const response = await fetch(`/api/trees/${treeId}/suggestions/${suggestionId}`, { method: "DELETE" });
  const body = await readBody(response);
  if (!response.ok) throw new Error(errorMessage(body, "That suggestion could not be declined."));
}

async function readBody(response: Response): Promise<Record<string, unknown> | null> {
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

function errorMessage(body: Record<string, unknown> | null, fallback: string): string {
  return typeof body?.error === "string" && body.error ? body.error : fallback;
}
