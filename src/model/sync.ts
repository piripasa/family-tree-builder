import type { SavedTree, TreeLibrary } from "./types";

export type LibraryChange =
  | { type: "create"; tree: SavedTree }
  | { type: "update"; tree: SavedTree }
  | { type: "delete"; id: string }
  | { type: "activate"; id: string };

export function libraryChanges(before: TreeLibrary, after: TreeLibrary): LibraryChange[] {
  const changes: LibraryChange[] = [];
  const previous = new Map(before.trees.map((tree) => [tree.id, tree]));
  const nextIds = new Set(after.trees.map((tree) => tree.id));

  for (const tree of after.trees) {
    if (!previous.has(tree.id)) changes.push({ type: "create", tree });
  }
  for (const tree of after.trees) {
    const earlier = previous.get(tree.id);
    if (!earlier) continue;
    if (earlier.title !== tree.title || JSON.stringify(earlier.document) !== JSON.stringify(tree.document)) {
      changes.push({ type: "update", tree });
    }
  }
  for (const tree of before.trees) {
    if (!nextIds.has(tree.id)) changes.push({ type: "delete", id: tree.id });
  }
  if (before.activeId !== after.activeId) changes.push({ type: "activate", id: after.activeId });
  return changes;
}
