import { parseTreeDocument } from "./io";
import { createEmptyDocument } from "./tree";
import type { SavedTree, TreeDocument, TreeLibrary } from "./types";

const TREE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_STORED_TREES = 40;
export const MAX_DOCUMENT_CHARS = 8_000_000;

export function createLibrary(document = createEmptyDocument(), title = "Family tree"): TreeLibrary {
  const tree = createSavedTree(title, document);
  return { version: 1, activeId: tree.id, trees: [tree] };
}

export function activeTree(library: TreeLibrary): SavedTree {
  return library.trees.find((tree) => tree.id === library.activeId) ?? library.trees[0];
}

export function replaceActive(library: TreeLibrary, document: TreeDocument): TreeLibrary {
  const current = activeTree(library);
  return {
    ...library,
    activeId: current.id,
    trees: library.trees.map((tree) => (tree.id === current.id ? { ...tree, document } : tree)),
  };
}

export function renameActive(library: TreeLibrary, title: string): TreeLibrary {
  const current = activeTree(library);
  return {
    ...library,
    activeId: current.id,
    trees: library.trees.map((tree) => (tree.id === current.id ? { ...tree, title: title.slice(0, 80) } : tree)),
  };
}

export function selectTree(library: TreeLibrary, id: string): TreeLibrary {
  if (!library.trees.some((tree) => tree.id === id)) return library;
  return { ...library, activeId: id };
}

export function addTree(library: TreeLibrary): TreeLibrary {
  const tree = createSavedTree(nextTitle(library.trees), createEmptyDocument());
  return { ...library, activeId: tree.id, trees: [...library.trees, tree] };
}

export function deleteActiveTree(library: TreeLibrary): TreeLibrary {
  const current = activeTree(library);
  if (library.trees.length <= 1) {
    return {
      ...library,
      activeId: current.id,
      trees: [{ ...current, document: createEmptyDocument() }],
    };
  }
  const trees = library.trees.filter((tree) => tree.id !== current.id);
  return { ...library, activeId: trees[0].id, trees };
}

function createSavedTree(title: string, document: TreeDocument): SavedTree {
  return { id: crypto.randomUUID(), title, document };
}

export function parseStoredLibrary(
  input: unknown,
  limits: { trees?: number; chars?: number } = {},
): { ok: true; library: TreeLibrary } | { ok: false; error: string } {
  const maxTrees = limits.trees ?? MAX_STORED_TREES;
  const maxChars = limits.chars ?? MAX_DOCUMENT_CHARS;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "That account library is unreadable." };
  }
  const record = input as Record<string, unknown>;
  if (record.version !== 1 || !Array.isArray(record.trees)) {
    return { ok: false, error: "That account library is unreadable." };
  }
  if (record.trees.length < 1 || record.trees.length > maxTrees) {
    return { ok: false, error: "That account has an unsupported number of trees." };
  }

  const trees: SavedTree[] = [];
  const seen = new Set<string>();
  for (const entry of record.trees) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { ok: false, error: "A stored tree is unreadable." };
    }
    const tree = entry as Record<string, unknown>;
    if (typeof tree.id !== "string" || !TREE_ID.test(tree.id)) {
      return { ok: false, error: "A stored tree has an unreadable id." };
    }
    if (seen.has(tree.id)) return { ok: false, error: "That account repeats a tree." };
    if (typeof tree.title !== "string") return { ok: false, error: "A stored tree has an unreadable name." };
    const parsed = parseTreeDocument(tree.document);
    if (!parsed.ok) return parsed;
    if (JSON.stringify(parsed.document).length > maxChars) {
      return { ok: false, error: "A stored tree is too large." };
    }
    seen.add(tree.id);
    trees.push({ id: tree.id, title: tree.title.slice(0, 80), document: parsed.document });
  }

  const activeId = typeof record.activeId === "string" && seen.has(record.activeId) ? record.activeId : trees[0].id;
  return { ok: true, library: { version: 1, activeId, trees } };
}

function nextTitle(trees: SavedTree[]): string {
  const names = new Set(trees.map((tree) => tree.title.trim()));
  if (!names.has("Family tree")) return "Family tree";
  let count = 2;
  while (names.has(`Family tree ${count}`)) count += 1;
  return `Family tree ${count}`;
}
