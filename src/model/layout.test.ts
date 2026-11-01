import { describe, expect, it } from "vitest";
import { CARD_HEIGHT, CARD_WIDTH, layoutTree } from "./layout";
import { addChild, addFirstPerson, addParent, addPartner, setFocus } from "./tree";
import type { LayoutCard } from "./layout";
import type { TreeDocument, TreeResult } from "./types";

function must(result: TreeResult): { document: TreeDocument; personId: string } {
  if (!result.ok) throw new Error(result.error);
  return result;
}

function overlaps(left: LayoutCard, right: LayoutCard): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

describe("layoutTree", () => {
  it("returns nothing without a focused person", () => {
    expect(layoutTree({ version: 1, people: [], partnerships: [], focusId: null })).toBeNull();
    const started = must(addFirstPerson({ version: 1, people: [], partnerships: [], focusId: null }, "Ada", "Lovelace"));
    expect(layoutTree({ ...started.document, focusId: "missing" })).toBeNull();
  });

  it("places parents above the focus and a partner beside them without overlapping", () => {
    let step = must(addFirstPerson({ version: 1, people: [], partnerships: [], focusId: null }, "Casey", "River"));
    const casey = step.personId;
    step = must(addParent(step.document, casey, { type: "new", givenName: "Alex", familyName: "River" }));
    step = must(addParent(step.document, casey, { type: "new", givenName: "Blair", familyName: "Quinn" }));
    step = must(addChild(step.document, casey, { type: "new", givenName: "Finn", familyName: "River" }));
    const layout = layoutTree(setFocus(step.document, casey));
    if (!layout) throw new Error("Expected a layout");

    const card = (name: string) => {
      const person = step.document.people.find((item) => item.givenName === name);
      const found = layout.cards.find((item) => item.personId === person?.id);
      if (!found) throw new Error(`Missing card ${name}`);
      return found;
    };
    const focus = card("Casey");
    expect(card("Alex").y).toBeLessThan(focus.y);
    expect(card("Blair").y).toBe(card("Alex").y);
    expect(Math.abs(card("Blair").x - (card("Alex").x + CARD_WIDTH))).toBeLessThanOrEqual(CARD_WIDTH);
    expect(card("Finn").y).toBeGreaterThan(focus.y + CARD_HEIGHT);
    expect(layout.lines.length).toBeGreaterThan(0);

    for (let index = 0; index < layout.cards.length; index += 1) {
      for (let other = index + 1; other < layout.cards.length; other += 1) {
        expect(overlaps(layout.cards[index], layout.cards[other])).toBe(false);
      }
    }
  });

  it("marks generations past the drawing limit", () => {
    let step = must(addFirstPerson({ version: 1, people: [], partnerships: [], focusId: null }, "Gen 0", "River"));
    for (let generation = 1; generation <= 6; generation += 1) {
      step = must(addParent(step.document, step.personId, { type: "new", givenName: `Up ${generation}`, familyName: "River" }));
    }
    const ancestors = layoutTree(step.document);
    expect(ancestors?.cards.some((card) => card.hiddenUp)).toBe(true);
    expect(ancestors && ancestors.cards.length).toBeLessThan(7);

    let down = must(addFirstPerson({ version: 1, people: [], partnerships: [], focusId: null }, "Gen 0", "River"));
    let parent = down.personId;
    for (let generation = 1; generation <= 6; generation += 1) {
      down = must(addChild(down.document, parent, { type: "new", givenName: `Down ${generation}`, familyName: "River" }));
      parent = down.personId;
    }
    const descendants = layoutTree(setFocus(down.document, down.document.people[0].id));
    expect(descendants?.cards.some((card) => card.hiddenDown)).toBe(true);
    expect(descendants && descendants.cards.length).toBeLessThan(7);
  });

  it("keeps a second partner beside the couple", () => {
    let step = must(addFirstPerson({ version: 1, people: [], partnerships: [], focusId: null }, "Alex", "River"));
    step = must(addPartner(step.document, step.document.focusId as string, { type: "new", givenName: "Blair", familyName: "Quinn" }));
    step = must(addPartner(step.document, step.document.focusId as string, { type: "new", givenName: "Eden", familyName: "Moss" }));
    const layout = layoutTree(step.document);
    const xs = layout?.cards.map((card) => card.x).sort((left, right) => left - right) ?? [];
    expect(xs[1] - xs[0]).toBeLessThan(CARD_WIDTH * 2);
    expect(xs[2] - xs[1]).toBeLessThan(CARD_WIDTH * 2);
  });

  it("places each partner's children under that partner", () => {
    let step = must(addFirstPerson({ version: 1, people: [], partnerships: [], focusId: null }, "Alex", "River"));
    const alex = step.document.focusId as string;
    step = must(addPartner(step.document, alex, { type: "new", givenName: "Blair", familyName: "Quinn" }));
    step = must(addChild(step.document, alex, { type: "new", givenName: "Casey", familyName: "River" }, step.document.partnerships[0].id));
    step = must(addPartner(step.document, alex, { type: "new", givenName: "Eden", familyName: "Moss" }));
    const edenUnion = step.document.partnerships.find((partnership) =>
      partnership.partnerIds.includes(step.document.people.find((person) => person.givenName === "Eden")?.id ?? ""),
    );
    step = must(addChild(step.document, alex, { type: "new", givenName: "Finn", familyName: "River" }, edenUnion?.id));
    const layout = layoutTree(step.document);
    if (!layout) throw new Error("Expected a layout");
    for (let index = 0; index < layout.cards.length; index += 1) {
      for (let other = index + 1; other < layout.cards.length; other += 1) {
        expect(overlaps(layout.cards[index], layout.cards[other])).toBe(false);
      }
    }
    expect(layout.cards).toHaveLength(5);
  });
});
