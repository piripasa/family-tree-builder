import { describe, expect, it } from "vitest";
import { describeRelation, searchPeople } from "./find";
import { addChild, addFirstPerson, addParent, addPartner } from "./tree";
import type { TreeDocument, TreeResult } from "./types";

function must(result: TreeResult): TreeDocument {
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

function named(doc: TreeDocument, givenName: string) {
  const person = doc.people.find((item) => item.givenName === givenName);
  if (!person) throw new Error(`Missing ${givenName}`);
  return person;
}

function family(): TreeDocument {
  let doc = must(addFirstPerson({ version: 1, people: [], partnerships: [], focusId: null }, "Ada", "King"));
  doc = must(addPartner(doc, named(doc, "Ada").id, { type: "new", givenName: "Bea", familyName: "King" }));
  doc = must(addChild(doc, named(doc, "Ada").id, { type: "new", givenName: "Cam", familyName: "King" }));
  doc = must(addChild(doc, named(doc, "Ada").id, { type: "new", givenName: "Dee", familyName: "King" }));
  doc = must(addPartner(doc, named(doc, "Cam").id, { type: "new", givenName: "Eden", familyName: "Moss" }));
  doc = must(addChild(doc, named(doc, "Cam").id, { type: "new", givenName: "Fay", familyName: "Moss" }));
  doc = must(addPartner(doc, named(doc, "Dee").id, { type: "new", givenName: "Gil", familyName: "Moss" }));
  doc = must(addChild(doc, named(doc, "Dee").id, { type: "new", givenName: "Hal", familyName: "Moss" }));
  doc = must(addParent(doc, named(doc, "Ada").id, { type: "new", givenName: "Ida", familyName: "King" }));
  return doc;
}

describe("searchPeople", () => {
  it("matches every word in the name, ignoring case", () => {
    const doc = family();
    expect(searchPeople(doc, "  ")).toEqual([]);
    expect(searchPeople(doc, "fay moss").map((person) => person.givenName)).toEqual(["Fay"]);
    expect(searchPeople(doc, "KING").map((person) => person.givenName).sort()).toEqual(["Ada", "Bea", "Cam", "Dee", "Ida"]);
  });
});

describe("describeRelation", () => {
  it("names close family and a cousin", () => {
    const doc = family();
    const ada = named(doc, "Ada").id;
    const ida = named(doc, "Ida").id;
    const cam = named(doc, "Cam").id;
    const dee = named(doc, "Dee").id;
    const fay = named(doc, "Fay").id;
    const hal = named(doc, "Hal").id;
    const bea = named(doc, "Bea").id;
    const eden = named(doc, "Eden").id;

    expect(describeRelation(doc, ada, ada)).toBe("Ada King is the selected person.");
    expect(describeRelation(doc, ada, bea)).toBe("Bea King is Ada King's partner.");
    expect(describeRelation(doc, ada, cam)).toBe("Cam King is Ada King's child.");
    expect(describeRelation(doc, cam, ada)).toBe("Ada King is Cam King's parent.");
    expect(describeRelation(doc, cam, dee)).toBe("Dee King is Cam King's sibling.");
    expect(describeRelation(doc, fay, ada)).toBe("Ada King is Fay Moss's grandparent.");
    expect(describeRelation(doc, ida, fay)).toBe("Fay Moss is Ida King's great-grandchild.");
    expect(describeRelation(doc, fay, hal)).toBe("Hal Moss is Fay Moss's first cousin.");
    expect(describeRelation(doc, ada, eden)).toBe("Eden Moss is Ada King's child's partner.");
    expect(describeRelation(doc, "missing", ada)).toBeNull();
  });

  it("says when two people are not connected", () => {
    const doc = must(addFirstPerson(family(), "Una", "Lane"));
    expect(describeRelation(doc, named(doc, "Ada").id, named(doc, "Una").id)).toBe(
      "Una Lane is not connected to Ada King in this tree.",
    );
  });
});
