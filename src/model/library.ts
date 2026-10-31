import { createEmptyDocument } from "./tree";
import type { SavedTree, TreeDocument, TreeLibrary } from "./types";

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

function nextTitle(trees: SavedTree[]): string {
  const names = new Set(trees.map((tree) => tree.title.trim()));
  if (!names.has("Family tree")) return "Family tree";
  let count = 2;
  while (names.has(`Family tree ${count}`)) count += 1;
  return `Family tree ${count}`;
}
