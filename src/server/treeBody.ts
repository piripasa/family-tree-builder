const TREE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readTreeId(id: string): string | null {
  return TREE_ID.test(id) ? id : null;
}

export function readTreeBody(
  input: unknown,
): { ok: true; id: string; title: string; document: unknown } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "That tree is unreadable." };
  }
  const record = input as Record<string, unknown>;
  const id = typeof record.id === "string" ? readTreeId(record.id) : null;
  if (!id) return { ok: false, error: "That tree is unreadable." };
  if (typeof record.title !== "string") return { ok: false, error: "A stored tree has an unreadable name." };
  return { ok: true, id, title: record.title.slice(0, 80), document: record.document };
}

export function readTreeUpdate(input: unknown): { ok: true; title: string; document: unknown } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "That tree is unreadable." };
  }
  const record = input as Record<string, unknown>;
  if (typeof record.title !== "string") return { ok: false, error: "A stored tree has an unreadable name." };
  return { ok: true, title: record.title.slice(0, 80), document: record.document };
}
