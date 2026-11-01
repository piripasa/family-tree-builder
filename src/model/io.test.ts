import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadTree, parseTreeDocument } from "./io";
import type { TreeDocument } from "./types";

function sample(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    people: [
      { id: "ada", givenName: "Ada", familyName: "Lovelace" },
      { id: "ann", givenName: "Ann", familyName: "King" },
    ],
    partnerships: [{ id: "parents", partnerIds: ["ada"], childIds: ["ann"] }],
    focusId: "ann",
    ...overrides,
  };
}

describe("parseTreeDocument", () => {
  it("keeps a version 1 tree and fills in a missing focus", () => {
    const parsed = parseTreeDocument(sample({ focusId: undefined }));
    expect(parsed.ok && parsed.document.focusId).toBe("ada");
    const empty = parseTreeDocument({ version: 1, people: [], partnerships: [], focusId: null });
    expect(empty.ok && empty.document.focusId).toBeNull();
  });

  it("reads profile fields and treats a death date as not living", () => {
    const parsed = parseTreeDocument(
      sample({
        people: [
          {
            id: "ada",
            givenName: "Ada",
            familyName: "Lovelace",
            birthDate: "1815-12-10",
            birthPlace: " London ",
            deathDate: "1852-11-27",
            deathPlace: "Marylebone",
            note: " Mathematician ",
            photo: "data:image/jpeg;base64,abc",
            living: true,
          },
          { id: "ann", givenName: "Ann", familyName: "King", living: false },
        ],
      }),
    );
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.document.people[0]).toMatchObject({
      birthDate: "1815-12-10",
      birthPlace: "London",
      deathDate: "1852-11-27",
      note: "Mathematician",
      photo: "data:image/jpeg;base64,abc",
      living: false,
    });
    expect(parsed.document.people[1].living).toBe(false);
    const alive = parseTreeDocument({
      version: 1,
      people: [{ id: "ada", givenName: "Ada", familyName: "Lovelace", living: true }],
      partnerships: [],
      focusId: "ada",
    });
    expect(alive.ok && alive.document.people[0].living).toBe(true);
  });

  it.each([
    [null, "That file is not a family tree."],
    [{ version: 2, people: [], partnerships: [] }, "This file is from an unsupported version."],
    [{ version: 1, people: {} }, "That file is not a family tree."],
    [sample({ people: [{ id: "", givenName: "Ada", familyName: "Lovelace" }] }), "A person in that file is missing an id."],
    [
      sample({
        people: [
          { id: "ada", givenName: "Ada", familyName: "Lovelace" },
          { id: "ada", givenName: "Ann", familyName: "King" },
        ],
      }),
      "That file repeats a person.",
    ],
    [sample({ people: [{ id: "ada", givenName: 1, familyName: "Lovelace" }] }), "A person in that file has an unreadable name."],
    [sample({ partnerships: [{ partnerIds: ["ada"], childIds: [] }] }), "A relationship in that file is missing an id."],
    [
      sample({
        partnerships: [
          { id: "parents", partnerIds: ["ada"], childIds: ["ann"] },
          { id: "parents", partnerIds: ["ada"], childIds: [] },
        ],
      }),
      "That file repeats a relationship.",
    ],
    [sample({ partnerships: [{ id: "parents", partnerIds: "ada", childIds: [] }] }), "A relationship in that file is unreadable."],
    [sample({ partnerships: [{ id: "parents", partnerIds: ["ada", "ann", "bea"], childIds: [] }] }), "A relationship has an unsupported number of partners."],
    [sample({ partnerships: [{ id: "parents", partnerIds: ["ada", "ada"], childIds: [] }] }), "A person is listed twice in the same relationship."],
    [sample({ partnerships: [{ id: "parents", partnerIds: ["ada"], childIds: ["ann", "ann"] }] }), "A child is listed twice in the same relationship."],
    [sample({ partnerships: [{ id: "parents", partnerIds: ["missing"], childIds: [] }] }), "That file links to someone who is missing."],
    [sample({ partnerships: [{ id: "parents", partnerIds: ["ada"], childIds: ["ada"] }] }), "That would make someone their own ancestor."],
    [{ ...sample(), focusId: "missing" }, "That file points at someone who is missing."],
    [sample({ people: [{ id: "ada", givenName: "Ada", familyName: "Lovelace", birthDate: "1815" }] }), "A birth date in that file is unreadable."],
    [sample({ people: [{ id: "ada", givenName: "Ada", familyName: "Lovelace", deathDate: "1852" }] }), "A death date in that file is unreadable."],
    [sample({ people: [{ id: "ada", givenName: "Ada", familyName: "Lovelace", deathPlace: 4 }] }), "A death place in that file is unreadable."],
    [sample({ people: [{ id: "ada", givenName: "Ada", familyName: "Lovelace", birthPlace: 4 }] }), "A birth place in that file is unreadable."],
    [sample({ people: [{ id: "ada", givenName: "Ada", familyName: "Lovelace", note: "x".repeat(2001) }] }), "A note in that file is too long."],
    [sample({ people: [{ id: "ada", givenName: "Ada", familyName: "Lovelace", photo: "http://photo" }] }), "A photo in that file is unreadable."],
    [sample({ people: [{ id: "ada", givenName: "Ada", familyName: "Lovelace", photo: `data:image/jpeg;${"a".repeat(1_500_000)}` }] }), "A photo in that file is too large."],
    [sample({ people: [{ id: "ada", givenName: "Ada", familyName: "Lovelace", living: "yes" }] }), "A living flag in that file is unreadable."],
  ])("rejects %j", (input, error) => {
    expect(parseTreeDocument(input)).toEqual({ ok: false, error });
  });

  it("rejects two sets of parents and a cycle", () => {
    expect(
      parseTreeDocument(
        sample({
          people: [
            { id: "ada", givenName: "Ada", familyName: "Lovelace" },
            { id: "ann", givenName: "Ann", familyName: "King" },
            { id: "bea", givenName: "Bea", familyName: "King" },
          ],
          partnerships: [
            { id: "one", partnerIds: ["ada"], childIds: ["ann"] },
            { id: "two", partnerIds: ["bea"], childIds: ["ann"] },
          ],
        }),
      ),
    ).toMatchObject({ ok: false, error: "A person in that file has more than one set of parents." });

    expect(
      parseTreeDocument(
        sample({
          partnerships: [
            { id: "one", partnerIds: ["ada"], childIds: ["ann"] },
            { id: "two", partnerIds: ["ann"], childIds: ["ada"] },
          ],
        }),
      ),
    ).toMatchObject({ ok: false, error: "That would make someone their own ancestor." });
  });
});

describe("downloadTree", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("downloads the tree as JSON", () => {
    const clicks: string[] = [];
    const blobs: Blob[] = [];
    vi.stubGlobal("URL", {
      createObjectURL: (blob: Blob) => {
        blobs.push(blob);
        return "blob:tree";
      },
      revokeObjectURL: () => undefined,
    });
    vi.stubGlobal("window", {
      document: {
        createElement: () => ({
          href: "",
          download: "",
          click(this: { download: string }) {
            clicks.push(this.download);
          },
        }),
      },
    });
    const tree: TreeDocument = { version: 1, people: [], partnerships: [], focusId: null };
    downloadTree(tree);
    downloadTree(tree, "shared.json");
    expect(clicks).toEqual(["family-tree.json", "shared.json"]);
    expect(blobs[0].type).toBe("application/json");
  });
});
