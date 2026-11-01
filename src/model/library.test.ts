import { describe, expect, it } from "vitest";
import {
  activeTree,
  addTree,
  createLibrary,
  deleteActiveTree,
  renameActive,
  replaceActive,
  selectTree,
} from "./library";
import { createEmptyDocument } from "./tree";
import type { TreeDocument } from "./types";

const filled: TreeDocument = {
  version: 1,
  people: [{ id: "ada", givenName: "Ada", familyName: "Lovelace" }],
  partnerships: [],
  focusId: "ada",
};

describe("library", () => {
  it("adds another tree without replacing the current one", () => {
    const first = createLibrary(filled, "Lovelace");
    const second = addTree(first);
    expect(second.trees).toHaveLength(2);
    expect(second.trees[0].document).toEqual(filled);
    expect(activeTree(second).title).toBe("Family tree");
    expect(activeTree(second).document.people).toEqual([]);
    expect(addTree(second).trees.map((tree) => tree.title)).toEqual(["Lovelace", "Family tree", "Family tree 2"]);
  });

  it("renames, switches, and replaces only the active tree", () => {
    const library = addTree(createLibrary(filled, "Lovelace"));
    const renamed = renameActive(library, `${"A".repeat(90)}`);
    expect(activeTree(renamed).title).toHaveLength(80);
    const firstId = library.trees[0].id;
    const selected = selectTree(renamed, firstId);
    expect(activeTree(selected).title).toBe("Lovelace");
    expect(selectTree(selected, "missing")).toBe(selected);
    const replaced = replaceActive(selected, createEmptyDocument());
    expect(activeTree(replaced).document.people).toEqual([]);
    expect(replaced.trees[1].title).toBe(renamed.trees[1].title);
  });

  it("clears the only tree and removes one tree when several exist", () => {
    const only = createLibrary(filled, "Lovelace");
    const cleared = deleteActiveTree(only);
    expect(cleared.trees).toHaveLength(1);
    expect(cleared.activeId).toBe(only.activeId);
    expect(activeTree(cleared).document.people).toEqual([]);

    const two = addTree(only);
    const removed = deleteActiveTree(two);
    expect(removed.trees).toHaveLength(1);
    expect(activeTree(removed).title).toBe("Lovelace");
  });

  it("uses the first tree when the active id is missing", () => {
    const library = createLibrary(filled);
    expect(activeTree({ ...library, activeId: "missing" }).document).toEqual(filled);
  });
});
