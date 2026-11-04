import { describe, expect, it } from "vitest";
import { mergePeople } from "./merge";
import { childrenOf, parentsOf, partnersOf } from "./tree";
import type { Partnership, Person, TreeDocument, TreeResult } from "./types";

function must(result: TreeResult): TreeDocument {
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

function person(id: string, givenName: string, extra: Partial<Person> = {}): Person {
  return { id, givenName, familyName: "River", ...extra };
}

function family(
  people: Person[],
  partnerships: Partnership[],
  focusId: string | null = people[0]?.id ?? null,
): TreeDocument {
  return { version: 1, people, partnerships, focusId };
}

describe("mergePeople", () => {
  it("keeps this record's name and fills the details it is missing", () => {
    const doc = family(
      [
        person("keep", "Dana", { birthDate: "1960-01-02", note: "Kept", living: true }),
        person("drop", "Dana", {
          birthDate: "1959-01-02",
          birthPlace: "Lisbon",
          deathDate: "2010-06-02",
          note: "Told later",
          photo: "data:image/jpeg;base64,abc",
          living: false,
        }),
      ],
      [],
    );
    const next = must(mergePeople(doc, "keep", "drop"));
    expect(next.people).toHaveLength(1);
    expect(next.people[0]).toMatchObject({
      id: "keep",
      givenName: "Dana",
      familyName: "River",
      birthDate: "1960-01-02",
      birthPlace: "Lisbon",
      deathDate: "2010-06-02",
      note: "Kept\nTold later",
      photo: "data:image/jpeg;base64,abc",
      living: false,
    });
    expect(next.focusId).toBe("keep");
  });

  it("moves the other record's parents, partner, and children", () => {
    const doc = family(
      [person("keep", "Dana"), person("drop", "D."), person("sam", "Sam"), person("kid", "Kim"), person("pat", "Pat")],
      [
        { id: "parents", partnerIds: ["pat"], childIds: ["drop"] },
        { id: "couple", partnerIds: ["drop", "sam"], childIds: ["kid"], marriageDate: "1990-05-01" },
      ],
    );
    const next = must(mergePeople(doc, "keep", "drop"));
    expect(parentsOf(next, "keep").map((item) => item.id)).toEqual(["pat"]);
    expect(partnersOf(next, "keep").map((item) => item.id)).toEqual(["sam"]);
    expect(childrenOf(next, "keep").map((item) => item.id)).toEqual(["kid"]);
    expect(next.partnerships.find((item) => item.partnerIds.includes("sam"))?.marriageDate).toBe("1990-05-01");
    expect(next.people.some((item) => item.id === "drop")).toBe(false);
  });

  it("joins two marriages to the same person and prefers this record's marriage facts", () => {
    const doc = family(
      [person("keep", "Dana"), person("drop", "D."), person("sam", "Sam"), person("a", "Alex"), person("b", "Blair")],
      [
        { id: "kept", partnerIds: ["keep", "sam"], childIds: ["a"], marriageDate: "1980-01-01", marriagePlace: "Porto" },
        { id: "other", partnerIds: ["drop", "sam"], childIds: ["b"], marriageDate: "1981-01-01", marriagePlace: "Lisbon" },
      ],
    );
    const next = must(mergePeople(doc, "keep", "drop"));
    expect(next.partnerships).toHaveLength(1);
    expect(next.partnerships[0]).toMatchObject({
      id: "kept",
      partnerIds: ["keep", "sam"],
      childIds: ["a", "b"],
      marriageDate: "1980-01-01",
      marriagePlace: "Porto",
    });
  });

  it("uses the other marriage fact when this record has none", () => {
    const doc = family(
      [person("keep", "Dana"), person("drop", "D."), person("sam", "Sam")],
      [
        { id: "kept", partnerIds: ["keep", "sam"], childIds: [] },
        { id: "other", partnerIds: ["drop", "sam"], childIds: [], marriagePlace: "Lisbon" },
      ],
    );
    const next = must(mergePeople(doc, "keep", "drop"));
    expect(next.partnerships[0]?.marriagePlace).toBe("Lisbon");
    expect(next.partnerships[0]?.marriageDate).toBeUndefined();
  });

  it("drops the marriage when the two records were partners with each other", () => {
    const doc = family(
      [person("keep", "Dana"), person("drop", "D."), person("kid", "Kim")],
      [{ id: "couple", partnerIds: ["keep", "drop"], childIds: ["kid"], marriageDate: "1980-01-01", marriagePlace: "Porto" }],
    );
    const next = must(mergePeople(doc, "keep", "drop"));
    expect(next.partnerships).toEqual([{ id: "couple", partnerIds: ["keep"], childIds: ["kid"] }]);
    expect(childrenOf(next, "keep").map((item) => item.id)).toEqual(["kid"]);
  });

  it("keeps the other parent when one record was a parent of the other", () => {
    const doc = family(
      [person("keep", "Dana"), person("drop", "D."), person("sam", "Sam")],
      [{ id: "parents", partnerIds: ["drop", "sam"], childIds: ["keep"], marriageDate: "1950-01-01" }],
    );
    const next = must(mergePeople(doc, "keep", "drop"));
    expect(next.partnerships).toEqual([{ id: "parents", partnerIds: ["sam"], childIds: ["keep"] }]);
    expect(parentsOf(next, "keep").map((item) => item.id)).toEqual(["sam"]);
  });

  it("refuses records whose parents differ", () => {
    const doc = family(
      [person("keep", "Dana"), person("drop", "D."), person("a", "Ann"), person("b", "Blair")],
      [
        { id: "left", partnerIds: ["a"], childIds: ["keep"] },
        { id: "right", partnerIds: ["b"], childIds: ["drop"] },
      ],
    );
    const result = mergePeople(doc, "keep", "drop");
    expect(result).toEqual({ ok: false, error: "Those two records have different parents." });
  });

  it("keeps the fuller set when one parent list contains the other", () => {
    const doc = family(
      [person("keep", "Dana"), person("drop", "D."), person("a", "Ann"), person("b", "Blair")],
      [
        { id: "full", partnerIds: ["a", "b"], childIds: ["keep"] },
        { id: "half", partnerIds: ["a"], childIds: ["drop"] },
      ],
    );
    const next = must(mergePeople(doc, "keep", "drop"));
    expect(parentsOf(next, "keep").map((item) => item.id)).toEqual(["a", "b"]);
    expect(next.partnerships.some((item) => item.id === "half")).toBe(false);
  });

  it("refuses a merge that would make someone their own ancestor", () => {
    const doc = family(
      [person("ada", "Ada"), person("byron", "Byron"), person("ann", "Ann")],
      [
        { id: "one", partnerIds: ["ada"], childIds: ["byron"] },
        { id: "two", partnerIds: ["byron"], childIds: ["ann"] },
      ],
    );
    expect(mergePeople(doc, "ada", "ann")).toEqual({
      ok: false,
      error: "That would make someone their own ancestor.",
    });
  });

  it("refuses a merge that would make a spouse into a parent", () => {
    const doc = family(
      [person("keep", "Dana"), person("drop", "D."), person("sam", "Sam")],
      [
        { id: "marriage", partnerIds: ["keep", "sam"], childIds: [], marriageDate: "1980-01-01" },
        { id: "parents", partnerIds: ["sam"], childIds: ["drop"] },
      ],
    );
    expect(mergePeople(doc, "keep", "drop")).toEqual({
      ok: false,
      error: "That would make someone their own ancestor.",
    });
  });

  it("focuses the kept record when the open record was the one removed", () => {
    const doc = family([person("keep", "Dana"), person("drop", "D.")], [], "drop");
    expect(must(mergePeople(doc, "keep", "drop")).focusId).toBe("keep");
  });

  it("keeps one copy of the same note and leaves a note that would exceed the limit", () => {
    const same = family([person("keep", "Dana", { note: "Same" }), person("drop", "D.", { note: "Same" })], []);
    expect(must(mergePeople(same, "keep", "drop")).people[0]?.note).toBe("Same");
    const long = family(
      [person("keep", "Dana", { note: "A".repeat(1500) }), person("drop", "D.", { note: "B".repeat(1500) })],
      [],
    );
    expect(must(mergePeople(long, "keep", "drop")).people[0]?.note).toBe("A".repeat(1500));
  });

  it("keeps this record's gender and fills one only when this record does not say", () => {
    const stated = family(
      [person("keep", "Dana", { gender: "female" }), person("drop", "D.", { gender: "male" })],
      [],
    );
    expect(must(mergePeople(stated, "keep", "drop")).people[0]?.gender).toBe("female");
    const blank = family([person("keep", "Dana"), person("drop", "D.", { gender: "other" })], []);
    expect(must(mergePeople(blank, "keep", "drop")).people[0]?.gender).toBe("other");
  });

  it("keeps this record's contact and adds links only the other record has", () => {
    const doc = family(
      [
        person("keep", "Dana", {
          email: "dana@example.com",
          socials: [{ network: "x", url: "https://x.com/dana" }],
        }),
        person("drop", "D.", {
          email: "other@example.com",
          phone: "+351",
          socials: [
            { network: "x", url: "https://x.com/dana" },
            { network: "website", url: "https://dana.example" },
          ],
        }),
      ],
      [],
    );
    expect(must(mergePeople(doc, "keep", "drop")).people[0]).toMatchObject({
      email: "dana@example.com",
      phone: "+351",
      socials: [
        { network: "x", url: "https://x.com/dana" },
        { network: "website", url: "https://dana.example" },
      ],
    });
  });

  it("fills living from the other record only when this record does not say", () => {
    const unmarked = family(
      [person("keep", "Dana"), person("drop", "D.", { living: true })],
      [],
    );
    expect(must(mergePeople(unmarked, "keep", "drop")).people[0]?.living).toBe(true);
    const alive = family(
      [person("keep", "Dana", { living: true }), person("drop", "D.", { deathDate: "2010-06-02" })],
      [],
    );
    expect(must(mergePeople(alive, "keep", "drop")).people[0]).toMatchObject({
      deathDate: "2010-06-02",
      living: false,
    });
  });

  it("refuses merging a person with their own record or a missing one", () => {
    const doc = family([person("keep", "Dana")], []);
    expect(mergePeople(doc, "keep", "keep")).toEqual({ ok: false, error: "Choose two different people." });
    expect(mergePeople(doc, "keep", "missing")).toEqual({ ok: false, error: "That person is not in this tree." });
  });
});
