import { describe, expect, it } from "vitest";
import { createLibrary, renameActive, replaceActive } from "./library";
import { libraryChanges } from "./sync";
import { createEmptyDocument } from "./tree";

describe("libraryChanges", () => {
  it("lists creates, edits, deletes, and the active tree", () => {
    const before = createLibrary(createEmptyDocument(), "First");
    const added = {
      ...before,
      trees: [
        ...before.trees,
        { id: "22222222-2222-4222-8222-222222222222", title: "Second", document: createEmptyDocument() },
      ],
    };
    expect(libraryChanges(before, added).map((change) => change.type)).toEqual(["create"]);

    const renamed = renameActive(added, "Second draft");
    expect(libraryChanges(added, renamed)).toEqual([{ type: "update", tree: renamed.trees[0] }]);

    const edited = replaceActive(added, {
      version: 1,
      people: [{ id: "ada", givenName: "Ada", familyName: "Lovelace" }],
      partnerships: [],
      focusId: "ada",
    });
    expect(libraryChanges(added, edited)[0]).toMatchObject({ type: "update" });

    const removed = { ...added, trees: [added.trees[0]] };
    expect(libraryChanges(added, removed).map((change) => change.type)).toEqual(["delete"]);
    expect(libraryChanges(added, { ...added, activeId: added.trees[1].id }).map((change) => change.type)).toEqual([
      "activate",
    ]);
    expect(libraryChanges(before, before)).toEqual([]);
  });
});
