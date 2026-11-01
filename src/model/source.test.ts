import { describe, expect, it } from "vitest";
import { exportGedcom, parseGedcom } from "./gedcom";
import { parseTreeDocument } from "./io";
import { sharedTree } from "./share";
import { addMarriageSource, addPersonSource, removePersonSource, SOURCE_LIMIT } from "./source";
import { deletePerson, updatePerson } from "./tree";
import type { TreeDocument } from "./types";

function couple(): TreeDocument {
  return {
    version: 1,
    focusId: "ann",
    people: [
      { id: "ada", givenName: "Ada", familyName: "Lovelace", living: true },
      { id: "ann", givenName: "Ann", familyName: "King", deathDate: "1852-11-27", living: false },
    ],
    partnerships: [
      {
        id: "couple",
        partnerIds: ["ada", "ann"],
        childIds: [],
        marriageDate: "1815-07-01",
        marriagePlace: "London",
      },
    ],
  };
}

describe("sources", () => {
  it("records a person, a certificate, or a note, and refuses a living death", () => {
    const birth = addPersonSource(couple(), "ann", {
      fact: "birth",
      kind: "person",
      detail: "  Parish clerk  ",
    });
    if (!birth.ok) throw new Error(birth.error);
    const named = addPersonSource(birth.document, "ann", {
      fact: "name",
      kind: "certificate",
      detail: "Baptism register",
    });
    if (!named.ok) throw new Error(named.error);
    const noted = addPersonSource(named.document, "ann", {
      fact: "birth",
      kind: "note",
      detail: "Written in the family bible",
    });
    if (!noted.ok) throw new Error(noted.error);
    expect(noted.document.people.find((person) => person.id === "ann")?.sources).toEqual([
      expect.objectContaining({ fact: "birth", kind: "person", detail: "Parish clerk" }),
      expect.objectContaining({ fact: "name", kind: "certificate", detail: "Baptism register" }),
      expect.objectContaining({ fact: "birth", kind: "note", detail: "Written in the family bible" }),
    ]);
    expect(addPersonSource(noted.document, "ann", { fact: "birth", kind: "person", detail: "Parish clerk" }).ok).toBe(
      false,
    );
    expect(addPersonSource(couple(), "ada", { fact: "death", kind: "certificate", detail: "None" }).ok).toBe(false);
    expect(addPersonSource(couple(), "ann", { fact: "birth", kind: "person", detail: " " }).ok).toBe(false);

    const married = addMarriageSource(noted.document, "couple", { kind: "certificate", detail: "Parish register" });
    if (!married.ok) throw new Error(married.error);
    expect(married.document.partnerships[0].sources?.[0]).toMatchObject({
      fact: "marriage",
      kind: "certificate",
      detail: "Parish register",
    });
    const removed = removePersonSource(married.document, "ann", noted.document.people[1].sources?.[0].id ?? "");
    expect(removed.people[1].sources).toHaveLength(2);
    const cleared = (removed.people[1].sources ?? []).reduce(
      (doc, source) => removePersonSource(doc, "ann", source.id),
      removed,
    );
    expect(cleared.people[1].sources).toBeUndefined();
  });

  it("drops a death source when someone is marked alive, and a marriage source when a partner is removed", () => {
    const added = addPersonSource(couple(), "ann", { fact: "death", kind: "note", detail: "Headstone" });
    if (!added.ok) throw new Error(added.error);
    const alive = updatePerson(added.document, "ann", { living: true });
    expect(alive.people.find((person) => person.id === "ann")?.sources).toBeUndefined();
    expect(alive.people.find((person) => person.id === "ann")?.deathDate).toBeUndefined();

    const married = addMarriageSource(couple(), "couple", { kind: "person", detail: "Ada" });
    if (!married.ok) throw new Error(married.error);
    const gone = deletePerson(married.document, "ada");
    expect(gone.partnerships[0].sources).toBeUndefined();
    expect(gone.partnerships[0].marriageDate).toBeUndefined();
  });

  it("keeps sources in a file and leaves them off a share", () => {
    const added = addPersonSource(couple(), "ann", { fact: "birth", kind: "certificate", detail: "Civil register" });
    if (!added.ok) throw new Error(added.error);
    const married = addMarriageSource(added.document, "couple", { kind: "note", detail: "Family bible" });
    if (!married.ok) throw new Error(married.error);
    const parsed = parseTreeDocument(JSON.parse(JSON.stringify(married.document)));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.document.people.find((person) => person.id === "ann")?.sources?.[0].detail).toBe("Civil register");
    expect(parsed.document.partnerships[0].sources?.[0].detail).toBe("Family bible");
    expect(
      parseTreeDocument({
        ...couple(),
        people: couple().people.map((person) =>
          person.id === "ada" ? { ...person, sources: [{ id: "s", fact: "death", kind: "note", detail: "No" }] } : person,
        ),
      }).ok,
    ).toBe(false);

    const shared = sharedTree(married.document);
    expect(shared.people.find((person) => person.id === "ann")?.sources).toBeUndefined();
    expect(shared.people.find((person) => person.id === "ada")).toEqual({
      id: "ada",
      givenName: "Living",
      familyName: "",
    });
    expect(shared.partnerships[0].sources).toBeUndefined();
    expect(shared.partnerships[0].marriageDate).toBeUndefined();
    expect(JSON.stringify(shared)).not.toContain("Civil register");
    expect(JSON.stringify(shared)).not.toContain("Family bible");
  });

  it("round-trips sources through GEDCOM", () => {
    const added = addPersonSource(couple(), "ann", { fact: "name", kind: "person", detail: "Told by Ada" });
    if (!added.ok) throw new Error(added.error);
    const birth = addPersonSource(added.document, "ann", {
      fact: "birth",
      kind: "certificate",
      detail: "Baptism register",
    });
    if (!birth.ok) throw new Error(birth.error);
    const married = addMarriageSource(birth.document, "couple", { kind: "note", detail: "Family bible" });
    if (!married.ok) throw new Error(married.error);
    const gedcom = exportGedcom(married.document);
    expect(gedcom).toContain("2 _SRC person");
    expect(gedcom).toContain("3 NOTE Told by Ada");
    expect(gedcom).toContain("2 _SRC certificate");
    const parsed = parseGedcom(gedcom);
    if (!parsed.ok) throw new Error(parsed.error);
    const ann = parsed.document.people.find((person) => person.givenName === "Ann");
    expect(ann?.sources).toEqual([
      expect.objectContaining({ fact: "name", kind: "person", detail: "Told by Ada" }),
      expect.objectContaining({ fact: "birth", kind: "certificate", detail: "Baptism register" }),
    ]);
    expect(parsed.document.partnerships[0].sources).toEqual([
      expect.objectContaining({ fact: "marriage", kind: "note", detail: "Family bible" }),
    ]);
    expect(parseGedcom("0 HEAD\n0 @I1@ INDI\n1 NAME Ada\n2 _SRC rumour\n3 NOTE No\n0 TRLR\n").ok).toBe(false);
  });

  it("stops at the source limit", () => {
    let document = couple();
    for (let index = 0; index < SOURCE_LIMIT; index += 1) {
      const next = addPersonSource(document, "ann", { fact: "birth", kind: "note", detail: `Note ${index}` });
      if (!next.ok) throw new Error(next.error);
      document = next.document;
    }
    expect(addPersonSource(document, "ann", { fact: "birth", kind: "note", detail: "One more" }).ok).toBe(false);
  });
});
