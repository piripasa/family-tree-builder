import { createLibrary } from "./library";
import { parseTreeDocument } from "./io";
import type { SavedTree, TreeLibrary } from "./types";

const STORAGE_KEY = "family-tree-builder:v1";

export function loadLibrary(): TreeLibrary {
  if (typeof localStorage === "undefined") return createLibrary();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createLibrary();
    const data: unknown = JSON.parse(raw);
    return parseLibrary(data) ?? migrateDocument(data) ?? createLibrary();
  } catch {
    return createLibrary();
  }
}

export function saveLibrary(library: TreeLibrary): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
    return true;
  } catch {
    return false;
  }
}

function migrateDocument(data: unknown): TreeLibrary | null {
  const parsed = parseTreeDocument(data);
  return parsed.ok ? createLibrary(parsed.document) : null;
}

function parseLibrary(data: unknown): TreeLibrary | null {
  if (!isRecord(data) || !Array.isArray(data.trees) || typeof data.activeId !== "string") return null;
  const trees: SavedTree[] = [];
  for (const entry of data.trees) {
    if (!isRecord(entry) || typeof entry.id !== "string") continue;
    const parsed = parseTreeDocument(entry.document);
    if (!parsed.ok) continue;
    const title = typeof entry.title === "string" ? entry.title.slice(0, 80) : "Family tree";
    trees.push({ id: entry.id, title, document: parsed.document });
  }
  if (trees.length === 0) return null;
  const activeId = trees.some((tree) => tree.id === data.activeId) ? data.activeId : trees[0].id;
  return { version: 1, activeId, trees };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
