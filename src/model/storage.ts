import { parseTreeDocument } from "./io";
import type { TreeDocument } from "./types";

const STORAGE_KEY = "family-tree-builder:v1";

export function loadTree(): TreeDocument | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = parseTreeDocument(JSON.parse(raw));
    return parsed.ok ? parsed.document : null;
  } catch {
    return null;
  }
}

export function saveTree(document: TreeDocument): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
  } catch {
    // The tree still lives in memory if the browser refuses the write.
  }
}
