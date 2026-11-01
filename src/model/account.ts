import { parseStoredLibrary } from "./library";
import type { LibraryChange } from "./sync";
import type { TreeLibrary } from "./types";

export type AccountSession = {
  email: string;
  library: TreeLibrary;
};

export type AccountResult = { ok: true; session: AccountSession } | { ok: false; error: string };

export async function fetchSession(): Promise<{ email: string } | null> {
  const response = await fetch("/api/auth/session");
  if (response.status === 401 || response.status === 503) return null;
  const body = await readBody(response);
  if (!response.ok || !body || typeof body.email !== "string") {
    throw new Error(errorMessage(body, "Your account could not be loaded."));
  }
  return { email: body.email };
}

export async function loadAccountLibrary(): Promise<TreeLibrary> {
  const response = await fetch("/api/trees");
  const body = await readBody(response);
  if (!response.ok) throw new Error(errorMessage(body, "Your trees could not be loaded."));
  const parsed = parseStoredLibrary(body);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.library;
}

export async function signUp(email: string, password: string, library: TreeLibrary): Promise<AccountResult> {
  return accountPost("/api/auth/sign-up", { email, password, library });
}

export async function signIn(email: string, password: string): Promise<AccountResult> {
  return accountPost("/api/auth/sign-in", { email, password });
}

export async function signOut(): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await fetch("/api/auth/sign-out", { method: "POST" });
  if (response.ok) return { ok: true };
  const body = await readBody(response);
  return { ok: false, error: errorMessage(body, "Sign out did not finish.") };
}

export async function applyLibraryChanges(changes: LibraryChange[]): Promise<void> {
  for (const change of changes) {
    if (change.type === "create") {
      await send("/api/trees", "POST", change.tree);
    } else if (change.type === "update") {
      await send(`/api/trees/${change.tree.id}`, "PUT", {
        title: change.tree.title,
        document: change.tree.document,
      });
    } else if (change.type === "delete") {
      await send(`/api/trees/${change.id}`, "DELETE");
    } else {
      await send("/api/trees/active", "PUT", { activeId: change.id });
    }
  }
}

async function accountPost(url: string, body: unknown): Promise<AccountResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await readBody(response);
  if (!response.ok || !payload || typeof payload.email !== "string") {
    return { ok: false, error: errorMessage(payload, "That account could not be opened.") };
  }
  const parsed = parseStoredLibrary(payload.library);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, session: { email: payload.email, library: parsed.library } };
}

async function send(url: string, method: string, body?: unknown): Promise<void> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.ok) return;
  const payload = await readBody(response);
  throw new Error(errorMessage(payload, "This tree could not be saved to your account."));
}

async function readBody(response: Response): Promise<Record<string, unknown> | null> {
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

function errorMessage(body: Record<string, unknown> | null, fallback: string): string {
  return typeof body?.error === "string" && body.error ? body.error : fallback;
}
