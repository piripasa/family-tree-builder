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
          living: true,
        },
        {
          id: "byron",
          givenName: "George",
          familyName: "Byron",
          birthDate: "1788-01-22",
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
    expect(shared.people[2]).toEqual(document.people[2]);
    expect(shared.partnerships).toEqual(document.partnerships);
    expect(shared.focusId).toBe("ada");
  });

  it("leaves out a marriage when a partner is marked alive", () => {
    const document: TreeDocument = {
      version: 1,
      focusId: "ann",
      people: [
        { id: "ada", givenName: "Ada", familyName: "Lovelace", living: true },
        { id: "ann", givenName: "Ann", familyName: "King", deathDate: "1852-11-27", living: false },
        { id: "byron", givenName: "George", familyName: "Byron", deathDate: "1824-04-19", living: false },
      ],
      partnerships: [
        {
          id: "alive",
          partnerIds: ["ada", "ann"],
          childIds: [],
          marriageDate: "1815-07-01",
          marriagePlace: "London",
        },
        {
          id: "past",
          partnerIds: ["ann", "byron"],
          childIds: [],
          marriageDate: "1800-01-01",
          marriagePlace: "London",
        },
      ],
    };
    const shared = sharedTree(document);
    expect(shared.partnerships[0].marriageDate).toBeUndefined();
    expect(shared.partnerships[0].marriagePlace).toBeUndefined();
    expect(shared.partnerships[1]).toMatchObject({ marriageDate: "1800-01-01", marriagePlace: "London" });
  });
});
