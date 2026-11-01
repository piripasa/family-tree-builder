import { describe, expect, it } from "vitest";
import { sharedTree } from "./share";
import type { TreeDocument } from "./types";

describe("sharedTree", () => {
  it("hides an alive person's details and keeps the relationships", () => {
    const document: TreeDocument = {
      version: 1,
      focusId: "ada",
      people: [
        {
          id: "ada",
          givenName: "Ada",
          familyName: "Lovelace",
          photo: "data:image/jpeg;base64,abc",
          birthDate: "1815-12-10",
          note: "Mathematician",
        },
        {
          id: "ann",
          givenName: "Ann",
          familyName: "King",
          deathDate: "1837-01-01",
          living: false,
        },
      ],
      partnerships: [{ id: "parents", partnerIds: ["ada"], childIds: ["ann"] }],
    };
    const shared = sharedTree(document);
    expect(shared.people[0]).toEqual({ id: "ada", givenName: "Living", familyName: "" });
    expect(shared.people[1]).toEqual(document.people[1]);
    expect(shared.partnerships).toEqual(document.partnerships);
    expect(shared.focusId).toBe("ada");
  });
});
