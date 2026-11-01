import { describe, expect, it } from "vitest";
import { applySuggestion, describeSuggestion, readSuggestion } from "./suggestion";
import { addFirstPerson, addPartner, createEmptyDocument, getPerson, updatePerson } from "./tree";

function couple() {
  const started = addFirstPerson(createEmptyDocument(), "Ada", "Moss");
  if (!started.ok) throw new Error(started.error);
  const withPartner = addPartner(started.document, started.personId, {
    type: "new",
    givenName: "Bea",
    familyName: "Moss",
  });
  if (!withPartner.ok) throw new Error(withPartner.error);
  return {
    document: updatePerson(withPartner.document, withPartner.personId, { deathDate: "1990-01-02" }),
    ada: started.personId,
    bea: withPartner.personId,
  };
}

describe("suggestions", () => {
  it("adds a suggested child of a living person and focuses them", () => {
    const { document, ada } = couple();
    const read = readSuggestion(
      { kind: "person", givenName: "Dee", familyName: "Moss", relation: "child", relatedToId: ada },
      document,
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const applied = applySuggestion(document, read.suggestion);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.document.focusId).toBe(applied.personId);
    expect(applied.document.people.some((person) => person.givenName === "Dee" && person.living === true)).toBe(true);
    expect(describeSuggestion(document, read.suggestion)).toBe("Add Dee Moss as a child of Ada Moss.");
  });

  it("asks which couple a child belongs to when there are two", () => {
    const { document, ada } = couple();
    const extra = addPartner(document, ada, { type: "new", givenName: "Cam", familyName: "Moss" });
    if (!extra.ok) throw new Error(extra.error);
    const missing = readSuggestion(
      { kind: "person", givenName: "Dee", familyName: "Moss", relation: "child", relatedToId: ada },
      extra.document,
    );
    expect(missing).toEqual({ ok: false, error: "Choose which couple this child belongs to." });
    const partnershipId = extra.document.partnerships[0]?.id ?? "";
    const chosen = readSuggestion(
      {
        kind: "person",
        givenName: "Dee",
        familyName: "Moss",
        relation: "child",
        relatedToId: ada,
        partnershipId,
      },
      extra.document,
    );
    expect(chosen.ok).toBe(true);
    if (!chosen.ok) return;
    const applied = applySuggestion(extra.document, chosen.suggestion);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.document.partnerships[0]?.childIds).toHaveLength(1);
    expect(applied.document.partnerships[1]?.childIds).toHaveLength(0);
    expect(getPerson(applied.document, applied.personId)?.givenName).toBe("Dee");
  });

  it("keeps a date or correction off a living person and records one for someone else", () => {
    const { document, ada, bea } = couple();
    expect(
      readSuggestion({ kind: "date", personId: ada, field: "birthDate", value: "1900-01-01" }, document).ok,
    ).toBe(false);
    expect(
      readSuggestion({ kind: "correction", personId: ada, field: "birthPlace", value: "Lisbon" }, document).ok,
    ).toBe(false);
    const date = readSuggestion({ kind: "date", personId: bea, field: "birthDate", value: "1920-04-05" }, document);
    expect(date.ok).toBe(true);
    if (!date.ok) return;
    const applied = applySuggestion(document, date.suggestion);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(getPerson(applied.document, bea)?.birthDate).toBe("1920-04-05");
    expect(describeSuggestion(document, date.suggestion)).toBe("Set Bea Moss's birth date to 1920-04-05.");
    const correction = readSuggestion(
      { kind: "correction", personId: bea, field: "birthPlace", value: "Lisbon" },
      document,
    );
    expect(correction.ok).toBe(true);
    if (!correction.ok) return;
    expect(describeSuggestion(document, correction.suggestion)).toBe("Change Bea Moss's birth place to Lisbon.");
    expect(readSuggestion({ kind: "date", personId: bea, field: "birthDate", value: "1920-02-31" }, document).ok).toBe(
      false,
    );
  });
});
