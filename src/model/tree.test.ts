import { describe, expect, it } from "vitest";
import {
  addChild,
  addFirstPerson,
  addParent,
  addPartner,
  childrenOf,
  createEmptyDocument,
  deletePerson,
  displayName,
  eligiblePeople,
  isAlive,
  lifeSpan,
  personMenuLabel,
  parentsOf,
  partnersOf,
  partnershipLabel,
  setFocus,
  updatePerson,
} from "./tree";
import type { TreeDocument, TreeResult } from "./types";

function must(result: TreeResult): TreeDocument {
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

function idOf(result: TreeResult): string {
  if (!result.ok) throw new Error(result.error);
  return result.personId;
}

function named(doc: TreeDocument, givenName: string) {
  const person = doc.people.find((item) => item.givenName === givenName);
  if (!person) throw new Error(`Missing ${givenName}`);
  return person;
}

describe("people", () => {
  it("requires a given name and focuses the first person", () => {
    expect(addFirstPerson(createEmptyDocument(), "  ", "River").ok).toBe(false);
    const started = addFirstPerson(createEmptyDocument(), " Ada ", " Lovelace ");
    const doc = must(started);
    expect(doc.focusId).toBe(idOf(started));
    expect(named(doc, "Ada").familyName).toBe("Lovelace");
    expect(named(doc, "Ada").living).toBe(true);
    expect(displayName({ id: "x", givenName: " ", familyName: " " })).toBe("Unnamed");
  });

  it("treats a person as alive only when they are marked alive", () => {
    const person = { id: "a", givenName: "Ada", familyName: "Lovelace" };
    expect(isAlive(person)).toBe(false);
    expect(isAlive({ ...person, living: true })).toBe(true);
    expect(isAlive({ ...person, living: false })).toBe(false);
    expect(isAlive({ ...person, living: true, deathDate: "1852-11-27" })).toBe(false);
    expect(lifeSpan(person)).toBe("");
    expect(lifeSpan({ ...person, birthDate: "1815-12-10" })).toBe("b. 1815");
    expect(lifeSpan({ ...person, deathDate: "1852-11-27" })).toBe("d. 1852");
    expect(lifeSpan({ ...person, birthDate: "1815-12-10", deathDate: "1852-11-27" })).toBe("1815–1852");
    expect(lifeSpan({ ...person, birthDate: "December" })).toBe("");
    expect(personMenuLabel(person)).toBe("Ada Lovelace");
    expect(personMenuLabel({ ...person, birthDate: "1815-12-10" })).toBe("Ada Lovelace (b. 1815)");
  });

  it("clears death details when someone is marked alive", () => {
    const doc = must(addFirstPerson(createEmptyDocument(), "Ada", "Lovelace"));
    const id = doc.focusId as string;
    const dead = updatePerson(doc, id, {
      birthDate: " 1815-12-10 ",
      deathDate: "1852-11-27",
      deathPlace: "London",
      note: "  ",
      photo: "",
    });
    expect(named(dead, "Ada")).toMatchObject({
      birthDate: "1815-12-10",
      deathDate: "1852-11-27",
      deathPlace: "London",
      living: false,
    });
    expect(named(dead, "Ada").note).toBeUndefined();
    expect(named(dead, "Ada").photo).toBeUndefined();

    const alive = updatePerson(dead, id, { living: true });
    expect(isAlive(named(alive, "Ada"))).toBe(true);
    expect(named(alive, "Ada").deathDate).toBeUndefined();
    expect(named(alive, "Ada").deathPlace).toBeUndefined();
    expect(named(alive, "Ada").living).toBe(true);

    const unmarked = updatePerson(alive, id, { living: false });
    expect(named(unmarked, "Ada").living).toBe(false);
  });

  it("ignores a focus or a patch for someone who is missing", () => {
    const doc = must(addFirstPerson(createEmptyDocument(), "Ada", "Lovelace"));
    expect(setFocus(doc, "missing")).toBe(doc);
    expect(updatePerson(doc, "missing", { givenName: "Ann" }).people).toEqual(doc.people);
  });
});

describe("relationships", () => {
  it("links parents, a partner, and children", () => {
    let doc = must(addFirstPerson(createEmptyDocument(), "Casey", "River"));
    const casey = doc.focusId as string;
    doc = must(addParent(doc, casey, { type: "new", givenName: "Alex", familyName: "River" }));
    doc = must(addParent(doc, casey, { type: "new", givenName: "Blair", familyName: "Quinn" }));
    doc = must(addPartner(doc, casey, { type: "new", givenName: "Eden", familyName: "Moss" }));
    const withChild = addChild(doc, casey, { type: "new", givenName: "Finn", familyName: "River" });
    doc = must(withChild);

    expect(parentsOf(doc, casey).map((person) => person.givenName)).toEqual(["Alex", "Blair"]);
    expect(partnersOf(doc, casey).map((person) => person.givenName)).toEqual(["Eden"]);
    expect(childrenOf(doc, casey).map((person) => person.givenName)).toEqual(["Finn"]);
    expect(partnershipLabel(doc, doc.partnerships[1], casey)).toBe("With Eden Moss");

    let solo = must(addFirstPerson(createEmptyDocument(), "Ada", "Lovelace"));
    solo = must(addParent(solo, solo.focusId as string, { type: "new", givenName: "Ann", familyName: "King" }));
    const parents = solo.partnerships[0];
    expect(partnershipLabel(solo, parents, parents.partnerIds[0])).toBe("Only this parent");
  });

  it("refuses a third parent, a partner as a parent, and an ancestor cycle", () => {
    let doc = must(addFirstPerson(createEmptyDocument(), "Casey", "River"));
    const casey = doc.focusId as string;
    doc = must(addParent(doc, casey, { type: "new", givenName: "Alex", familyName: "River" }));
    doc = must(addParent(doc, casey, { type: "new", givenName: "Blair", familyName: "Quinn" }));
    expect(addParent(doc, casey, { type: "new", givenName: "Dana", familyName: "Stone" })).toMatchObject({
      ok: false,
      error: "A person can only have two parents.",
    });

    let paired = must(addFirstPerson(createEmptyDocument(), "Casey", "River"));
    paired = must(addPartner(paired, paired.focusId as string, { type: "new", givenName: "Eden", familyName: "Moss" }));
    expect(addParent(paired, paired.focusId as string, { type: "existing", personId: named(paired, "Eden").id })).toMatchObject({
      ok: false,
      error: "A partner cannot also be this person's parent.",
    });

    const child = addChild(doc, casey, { type: "new", givenName: "Finn", familyName: "River" });
    doc = must(child);
    expect(addParent(doc, named(doc, "Alex").id, { type: "existing", personId: idOf(child) })).toMatchObject({
      ok: false,
      error: "That would make someone their own ancestor.",
    });
  });

  it("refuses a repeated partner and a descendant as a partner", () => {
    let doc = must(addFirstPerson(createEmptyDocument(), "Alex", "River"));
    const alex = doc.focusId as string;
    doc = must(addPartner(doc, alex, { type: "new", givenName: "Blair", familyName: "Quinn" }));
    const blair = named(doc, "Blair").id;
    expect(addPartner(doc, alex, { type: "existing", personId: blair })).toMatchObject({
      ok: false,
      error: "Those two are already partners.",
    });
    doc = must(addChild(doc, alex, { type: "new", givenName: "Casey", familyName: "River" }));
    expect(addPartner(doc, alex, { type: "existing", personId: named(doc, "Casey").id })).toMatchObject({
      ok: false,
      error: "That would make someone their own ancestor.",
    });
    expect(addPartner(doc, alex, { type: "existing", personId: alex })).toMatchObject({
      ok: false,
      error: "A person cannot be their own relative.",
    });
  });

  it("asks which partnership a child belongs to", () => {
    let doc = must(addFirstPerson(createEmptyDocument(), "Alex", "River"));
    const alex = doc.focusId as string;
    doc = must(addPartner(doc, alex, { type: "new", givenName: "Blair", familyName: "Quinn" }));
    doc = must(addPartner(doc, alex, { type: "new", givenName: "Eden", familyName: "Moss" }));
    expect(addChild(doc, alex, { type: "new", givenName: "Casey", familyName: "River" })).toMatchObject({
      ok: false,
      error: "Choose which partnership this child belongs to.",
    });
    const chosen = doc.partnerships[0].id;
    const child = addChild(doc, alex, { type: "new", givenName: "Casey", familyName: "River" }, chosen);
    expect(must(child).partnerships.find((item) => item.id === chosen)?.childIds).toHaveLength(1);
    expect(addChild(doc, alex, { type: "new", givenName: "Finn", familyName: "River" }, "missing")).toMatchObject({
      ok: false,
      error: "Choose which partnership this child belongs to.",
    });
    expect(addChild(doc, alex, { type: "existing", personId: named(doc, "Blair").id }, chosen)).toMatchObject({
      ok: false,
      error: "A partner cannot also be this person's child.",
    });
    doc = must(addChild(doc, alex, { type: "new", givenName: "Casey", familyName: "River" }, chosen));
    expect(addChild(doc, named(doc, "Casey").id, { type: "existing", personId: alex })).toMatchObject({
      ok: false,
      error: "That would make someone their own ancestor.",
    });
  });

  it("refuses to give a child a second set of parents", () => {
    let doc = must(addFirstPerson(createEmptyDocument(), "Alex", "River"));
    doc = must(addChild(doc, doc.focusId as string, { type: "new", givenName: "Casey", familyName: "River" }));
    doc = must(addFirstPerson(doc, "Dana", "Stone"));
    expect(addChild(doc, named(doc, "Dana").id, { type: "existing", personId: named(doc, "Casey").id })).toMatchObject({
      ok: false,
      error: "That person already has parents.",
    });
  });

  it("keeps the people who can still be linked", () => {
    let doc = must(addFirstPerson(createEmptyDocument(), "Casey", "River"));
    const casey = doc.focusId as string;
    doc = must(addParent(doc, casey, { type: "new", givenName: "Alex", familyName: "River" }));
    doc = must(addPartner(doc, casey, { type: "new", givenName: "Eden", familyName: "Moss" }));
    doc = must(addFirstPerson(doc, "Dana", "Stone"));
    expect(eligiblePeople(doc, casey, "parent").map((person) => person.givenName)).toEqual(["Dana"]);
    expect(eligiblePeople(doc, casey, "partner").map((person) => person.givenName)).toEqual(["Dana"]);
    doc = must(addParent(doc, casey, { type: "existing", personId: named(doc, "Dana").id }));
    expect(eligiblePeople(doc, casey, "parent")).toEqual([]);
    expect(eligiblePeople(doc, named(doc, "Alex").id, "child").map((person) => person.givenName)).not.toContain("Casey");
  });

  it("moves the focus to a remaining relative when someone is removed", () => {
    let doc = must(addFirstPerson(createEmptyDocument(), "Casey", "River"));
    const casey = doc.focusId as string;
    doc = must(addPartner(doc, casey, { type: "new", givenName: "Eden", familyName: "Moss" }));
    doc = setFocus(doc, casey);
    doc = deletePerson(doc, casey);
    expect(doc.people.map((person) => person.givenName)).toEqual(["Eden"]);
    expect(doc.focusId).toBe(named(doc, "Eden").id);
    expect(doc.partnerships[0].partnerIds).toEqual([named(doc, "Eden").id]);

    doc = deletePerson(doc, named(doc, "Eden").id);
    expect(doc.people).toEqual([]);
    expect(doc.focusId).toBeNull();

    const started = must(addFirstPerson(createEmptyDocument(), "Ada", "Lovelace"));
    const removed = deletePerson({ ...started, focusId: "missing" }, started.focusId as string);
    expect(removed.focusId).toBeNull();
  });

  it("keeps a child in the tree when their only recorded parent is removed", () => {
    let doc = must(addFirstPerson(createEmptyDocument(), "Alex", "River"));
    const alex = doc.focusId as string;
    const child = addChild(doc, alex, { type: "new", givenName: "Casey", familyName: "River" });
    doc = deletePerson(must(child), alex);
    expect(doc.people.map((person) => person.givenName)).toEqual(["Casey"]);
    expect(doc.focusId).toBe(named(doc, "Casey").id);
    expect(parentsOf(doc, named(doc, "Casey").id)).toEqual([]);
  });

  it("rejects a missing person and a missing relative", () => {
    const doc = must(addFirstPerson(createEmptyDocument(), "Ada", "Lovelace"));
    const missing = { type: "existing" as const, personId: "missing" };
    expect(addParent(doc, "missing", { type: "new", givenName: "Ann", familyName: "King" }).ok).toBe(false);
    expect(addParent(doc, doc.focusId as string, missing)).toMatchObject({
      ok: false,
      error: "That person is not in this tree.",
    });
    expect(addPartner(doc, "missing", missing).ok).toBe(false);
    expect(addChild(doc, "missing", missing).ok).toBe(false);
  });
});
