import { childrenOf, displayName, getPerson, parentsOf, partnersOf } from "./tree";
import type { TreeDocument } from "./types";

export type RelationStep = "parent" | "child" | "partner";

type Step = RelationStep;

export type Connection =
  | { type: "missing" }
  | { type: "self"; id: string }
  | { type: "apart"; fromId: string; toId: string }
  | { type: "linked"; fromId: string; toId: string; steps: RelationStep[] };

export function connection(doc: TreeDocument, fromId: string, toId: string): Connection {
  const from = getPerson(doc, fromId);
  const to = getPerson(doc, toId);
  if (!from || !to) return { type: "missing" };
  if (fromId === toId) return { type: "self", id: fromId };
  const steps = shortestPath(doc, fromId, toId);
  if (!steps) return { type: "apart", fromId, toId };
  return { type: "linked", fromId, toId, steps };
}

export function searchPeople(doc: TreeDocument, query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return doc.people.filter((person) => {
    const name = `${person.givenName} ${person.familyName}`.toLowerCase();
    return terms.every((term) => name.includes(term));
  });
}

export function describeRelation(doc: TreeDocument, fromId: string, toId: string): string | null {
  const link = connection(doc, fromId, toId);
  if (link.type === "missing") return null;
  const name = (id: string) => {
    const person = getPerson(doc, id);
    return person ? displayName(person) : "Unnamed";
  };
  if (link.type === "self") return `${name(link.id)} is the selected person.`;
  if (link.type === "apart") return `${name(link.toId)} is not connected to ${name(link.fromId)} in this tree.`;
  return `${name(link.toId)} is ${name(link.fromId)}'s ${relationLabel(link.steps)}.`;
}

function shortestPath(doc: TreeDocument, fromId: string, toId: string): Step[] | null {
  const queue: { id: string; steps: Step[] }[] = [{ id: fromId, steps: [] }];
  const seen = new Set<string>([fromId]);
  while (queue.length > 0) {
    const current = queue.shift() as { id: string; steps: Step[] };
    for (const next of neighbors(doc, current.id)) {
      if (seen.has(next.id)) continue;
      const steps = [...current.steps, next.step];
      if (next.id === toId) return steps;
      seen.add(next.id);
      queue.push({ id: next.id, steps });
    }
  }
  return null;
}

function neighbors(doc: TreeDocument, personId: string): { id: string; step: Step }[] {
  return [
    ...parentsOf(doc, personId).map((person) => ({ id: person.id, step: "parent" as const })),
    ...childrenOf(doc, personId).map((person) => ({ id: person.id, step: "child" as const })),
    ...partnersOf(doc, personId).map((person) => ({ id: person.id, step: "partner" as const })),
  ];
}

function relationLabel(steps: Step[]): string {
  const ups = countLeading(steps, "parent");
  const downs = countLeading(steps.slice(ups), "child");
  const rest = steps.slice(ups + downs);
  if (rest.length === 0) return bloodLabel(ups, downs);
  const tail = rest.map(stepWord).join("'s ");
  if (ups + downs === 0) return tail;
  return `${bloodLabel(ups, downs)}'s ${tail}`;
}

function bloodLabel(ups: number, downs: number): string {
  if (ups === 0) return descendantWord(downs);
  if (downs === 0) return ancestorWord(ups);
  if (ups === 1 && downs === 1) return "sibling";
  if (ups === 1) return `sibling's ${descendantWord(downs - 1)}`;
  if (downs === 1) return `${ancestorWord(ups - 1)}'s sibling`;
  const degree = Math.min(ups, downs) - 1;
  const removed = Math.abs(ups - downs);
  if (removed === 0) return cousinWord(degree);
  const removal = removed === 1 ? "once removed" : removed === 2 ? "twice removed" : `${removed} times removed`;
  return `${cousinWord(degree)} ${removal}`;
}

function ancestorWord(count: number): string {
  if (count <= 1) return "parent";
  if (count === 2) return "grandparent";
  return `${"great-".repeat(count - 2)}grandparent`;
}

function descendantWord(count: number): string {
  if (count <= 1) return "child";
  if (count === 2) return "grandchild";
  return `${"great-".repeat(count - 2)}grandchild`;
}

function cousinWord(degree: number): string {
  const ordinals = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];
  return `${ordinals[degree - 1] ?? `${degree}th`} cousin`;
}

function stepWord(step: Step): string {
  return step;
}

function countLeading(steps: Step[], step: Step): number {
  let count = 0;
  while (steps[count] === step) count += 1;
  return count;
}
