import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadGedcom, exportGedcom, parseGedcom } from "./gedcom";
import { parentsOf, partnersOf } from "./tree";
import type { TreeDocument } from "./types";

const document: TreeDocument = {
  version: 1,
  focusId: "ada",
  people: [
    {
      id: "ada",
      givenName: "Ada",
      familyName: "Love/lace",
      birthDate: "1815-12-10",
      birthPlace: "London",
      note: `Kept the @stories.\n${"A".repeat(300)}`,
      living: false,
    },
    { id: "ann", givenName: "Ann", familyName: "King", birthDate: "not-a-date", birthPlace: "Dublin", living: true },
    { id: "byron", givenName: "George", familyName: "Byron", deathDate: "1824-04-19", deathPlace: "Missolonghi" },
    { id: "child", givenName: "Only", familyName: "Child" },
    { id: "pat", givenName: "Pat", familyName: "Moss", birthDate: "1815-13-01", birthPlace: "Rome" },
  ],
  partnerships: [
    { id: "parents", partnerIds: ["ann", "byron"], childIds: ["ada"] },
    { id: "solo", partnerIds: ["ada"], childIds: ["child"] },
  ],
};

describe("gedcom", () => {
  it("round-trips people, dates, notes, and families", () => {
    const gedcom = exportGedcom(document);
    expect(gedcom.startsWith("0 HEAD\n1 GEDC\n2 VERS 5.5.1")).toBe(true);
    expect(gedcom).toContain("1 CHAR UTF-8");
    expect(gedcom.trimEnd().endsWith("0 TRLR")).toBe(true);
    expect(gedcom.split("\n").every((line) => line.length <= 255)).toBe(true);
    expect(gedcom).toContain("1 NAME Ada /Lovelace/");
    expect(gedcom).toContain("2 DATE 10 DEC 1815");
    expect(gedcom).toContain("2 DATE 1815-13-01");
    expect(gedcom).toContain("1 _LIV Y");
    expect(gedcom).toContain("2 CONT ");
    expect(gedcom).toContain("3 CONC ");

    const parsed = parseGedcom(gedcom);
    if (!parsed.ok) throw new Error(parsed.error);
    const ada = parsed.document.people.find((person) => person.givenName === "Ada");
    const ann = parsed.document.people.find((person) => person.givenName === "Ann");
    const byron = parsed.document.people.find((person) => person.givenName === "George");
    const child = parsed.document.people.find((person) => person.givenName === "Only");
    if (!ada || !ann || !byron || !child) throw new Error("Missing a person");
    expect(ada).toMatchObject({
      familyName: "Lovelace",
      birthDate: "1815-12-10",
      birthPlace: "London",
      living: false,
    });
    expect(ada.note).toContain("Kept the @stories.");
    expect(ada.note).toContain("A".repeat(300));
    expect(ann.living).toBe(true);
    expect(ann.birthDate).toBeUndefined();
    expect(ann.birthPlace).toBe("Dublin");
    expect(byron).toMatchObject({ deathDate: "1824-04-19", deathPlace: "Missolonghi", living: false });
    expect(parentsOf(parsed.document, ada.id).map((person) => person.givenName).sort()).toEqual(["Ann", "George"]);
    expect(partnersOf(parsed.document, ada.id)).toEqual([]);
    expect(parentsOf(parsed.document, child.id).map((person) => person.id)).toEqual([ada.id]);
  });

  it("reads a hand-written file and rejects a broken one", () => {
    const parsed = parseGedcom(`\uFEFF0 HEAD
1 GEDC
0 @I1@ INDI
1 NAME Byron
1 BIRT
2 DATE 1815
2 PLAC ${"London ".repeat(40)}
1 DEAT Y
1 NOTE Line
2 CONT Next
0 @I2@ INDI
1 NAME Ada /Lovelace/ 
0 @F1@ FAM
1 WIFE @I1@
1 CHIL @I2@
0 @F2@ FAM
1 CHIL @I2@
0 TRLR
`);
    if (!parsed.ok) throw new Error(parsed.error);
    const byron = parsed.document.people.find((person) => person.givenName === "Byron");
    expect(byron).toMatchObject({ familyName: "", living: false, birthPlace: "London ".repeat(40).trim().slice(0, 160) });
    expect(byron?.birthDate).toBeUndefined();
    expect(byron?.note).toBe("Line\nNext");
    expect(parentsOf(parsed.document, parsed.document.people[1].id)).toHaveLength(1);

    expect(parseGedcom("").ok).toBe(false);
    expect(parseGedcom("hello").ok).toBe(false);
    expect(parseGedcom("0 HEAD\n2 GEDC\n0 TRLR\n").ok).toBe(false);
    expect(parseGedcom("0 HEAD\n0 @I1@ INDI\n0 @I1@ INDI\n0 TRLR\n").ok).toBe(false);
    expect(
      parseGedcom(
        "0 HEAD\n0 @I1@ INDI\n0 @I2@ INDI\n0 @I3@ INDI\n0 @F1@ FAM\n1 HUSB @I1@\n1 HUSB @I2@\n1 WIFE @I3@\n0 TRLR\n",
      ).ok,
    ).toBe(false);
    expect(parseGedcom("0 HEAD\n0 @I1@ INDI\n0 @F1@ FAM\n1 HUSB @I9@\n0 TRLR\n").ok).toBe(false);
    expect(parseGedcom("0 HEAD\n0 @I1@ INDI\n0 @F1@ FAM\n1 HUSB @I1@\n1 CHIL @I9@\n0 TRLR\n").ok).toBe(false);
    expect(
      parseGedcom(
        "0 HEAD\n0 @I1@ INDI\n0 @F1@ FAM\n1 HUSB @I1@\n1 CHIL @I1@\n0 @F2@ FAM\n1 HUSB @I1@\n1 CHIL @I1@\n0 TRLR\n",
      ).ok,
    ).toBe(false);
  });

  it("marks someone dead when a death date is present", () => {
    const parsed = parseGedcom(`0 HEAD
0 @I1@ INDI
1 NAME Ada /Lovelace/
1 DEAT
2 DATE 32 DEC 1852
2 PLAC London
1 _LIV Y
0 TRLR
`);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.document.people[0].deathDate).toBeUndefined();
    expect(parsed.document.people[0].deathPlace).toBe("London");
    expect(parsed.document.people[0].living).toBe(false);
  });
});

describe("downloadGedcom", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("downloads a .ged file named from the tree title", () => {
    const clicks: string[] = [];
    vi.stubGlobal("URL", { createObjectURL: () => "blob:ged", revokeObjectURL: () => undefined });
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
    downloadGedcom(document, "Lovelace side");
    downloadGedcom({ version: 1, people: [], partnerships: [], focusId: null }, "!!!");
    expect(clicks).toEqual(["lovelace-side.ged", "family-tree.ged"]);
  });
});
