import { describe, expect, it } from "vitest";
import {
  ACCOUNT_TREE_LIMIT,
  LOCAL_TREE_LIMIT,
  activeTree,
  addTree,
  createLibrary,
  deleteActiveTree,
  parseStoredLibrary,
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

  it("keeps one tree on this device and five in an account", () => {
    const only = createLibrary();
    expect(addTree(only, LOCAL_TREE_LIMIT)).toBe(only);
    let account = only;
    for (let count = account.trees.length; count < ACCOUNT_TREE_LIMIT; count += 1) {
      account = addTree(account, ACCOUNT_TREE_LIMIT);
    }
    expect(account.trees).toHaveLength(5);
    expect(addTree(account, ACCOUNT_TREE_LIMIT)).toBe(account);
    expect(parseStoredLibrary({ version: 1, trees: account.trees.concat(account.trees[0]) }).ok).toBe(false);
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

  it("reads a stored library and rejects a broken one", () => {
    const library = createLibrary(filled, "Lovelace side");
    const stored = parseStoredLibrary(library);
    if (!stored.ok) throw new Error(stored.error);
    expect(stored.library.trees[0].title).toBe("Lovelace side");
    expect(stored.library.trees[0].document).toEqual(filled);

    const longTitle = parseStoredLibrary({ ...library, trees: [{ ...library.trees[0], title: "A".repeat(90) }] });
    if (!longTitle.ok) throw new Error(longTitle.error);
    expect(longTitle.library.trees[0].title).toHaveLength(80);

    const fallback = parseStoredLibrary({ ...library, activeId: "missing" });
    if (!fallback.ok) throw new Error(fallback.error);
    expect(fallback.library.activeId).toBe(library.trees[0].id);

    expect(parseStoredLibrary(null).ok).toBe(false);
    expect(parseStoredLibrary({ version: 2, trees: [] }).ok).toBe(false);
    expect(parseStoredLibrary({ version: 1, trees: [] }).ok).toBe(false);
    expect(parseStoredLibrary({ version: 1, trees: [null] }).ok).toBe(false);
    expect(parseStoredLibrary({ version: 1, trees: [{ id: "nope", title: "A", document: filled }] }).ok).toBe(false);
    expect(
      parseStoredLibrary({
        version: 1,
        trees: [library.trees[0], library.trees[0]],
      }).ok,
    ).toBe(false);
    expect(parseStoredLibrary({ version: 1, trees: [{ ...library.trees[0], title: 4 }] }).ok).toBe(false);
    expect(parseStoredLibrary({ version: 1, trees: [{ ...library.trees[0], document: { version: 1 } }] }).ok).toBe(false);
    expect(parseStoredLibrary(library, { chars: 5 }).ok).toBe(false);
    expect(parseStoredLibrary({ version: 1, trees: [library.trees[0], library.trees[0]] }, { trees: 1 }).ok).toBe(false);
  });
});
