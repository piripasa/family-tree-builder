import type { Connection, RelationStep } from "@/model/find";
import { isHiddenOnShare } from "@/model/share";
import type { SuggestionDraft } from "@/model/suggestion";
import { getPerson } from "@/model/tree";
import type { Partnership, Person, TreeDocument } from "@/model/types";
import type { Messages } from "./en";

type Kinship = Messages["kinship"];

export function personName(person: Person, messages: Messages): string {
  if (isHiddenOnShare(person)) return messages.living;
  const name = `${person.givenName} ${person.familyName}`.trim();
  return name || messages.unnamed;
}

export function personYears(person: Person, messages: Messages): string {
  const birth = yearOf(person.birthDate);
  const death = yearOf(person.deathDate);
  if (birth && death) return `${birth}–${death}`;
  if (birth) return messages.years.born(birth);
  if (death) return messages.years.died(death);
  return "";
}

export function personOption(person: Person, messages: Messages): string {
  const name = personName(person, messages);
  const years = personYears(person, messages);
  return years ? `${name} (${years})` : name;
}

export function coupleLabel(
  doc: TreeDocument,
  partnership: Partnership,
  personId: string,
  messages: Messages,
): string {
  const others = partnership.partnerIds.filter((id) => id !== personId);
  if (others.length === 0) return messages.partnership.onlyParent;
  const names = others.map((id) => {
    const person = getPerson(doc, id);
    return person ? personOption(person, messages) : messages.unknown;
  });
  return messages.partnership.with(names.join(messages.partnership.and));
}

export function formatConnection(doc: TreeDocument, link: Connection, messages: Messages): string | null {
  if (link.type === "missing") return null;
  const name = (id: string) => {
    const person = getPerson(doc, id);
    return person ? personName(person, messages) : messages.unknown;
  };
  if (link.type === "self") return messages.kinship.self(name(link.id));
  if (link.type === "apart") return messages.kinship.apart(name(link.toId), name(link.fromId));
  return messages.kinship.linked(name(link.toId), name(link.fromId), relationPhrase(link.steps, messages.kinship));
}

export function formatSuggestion(doc: TreeDocument, suggestion: SuggestionDraft, messages: Messages): string {
  if (suggestion.kind === "person") {
    const name = `${suggestion.givenName} ${suggestion.familyName}`.trim() || messages.unnamed;
    const related = named(doc, suggestion.relatedToId, messages);
    const relation = messages.kinship[suggestion.relation];
    return messages.suggestions.addPerson(name, relation, related);
  }
  const person = named(doc, suggestion.personId, messages);
  const field = messages.suggestions.fields[suggestion.field];
  if (suggestion.kind === "date") return messages.suggestions.setField(person, field, suggestion.value);
  return messages.suggestions.changeField(person, field, suggestion.value);
}

export function relationPhrase(steps: RelationStep[], kinship: Kinship): string {
  const ups = countLeading(steps, "parent");
  const downs = countLeading(steps.slice(ups), "child");
  const rest = steps.slice(ups + downs);
  if (rest.length === 0) return bloodLabel(ups, downs, kinship);
  const words = rest.map((step) => kinship[step]);
  const tail = words.slice(1).reduce((left, right) => kinship.join(left, right), words[0] ?? "");
  if (ups + downs === 0) return tail;
  return kinship.join(bloodLabel(ups, downs, kinship), tail);
}

function bloodLabel(ups: number, downs: number, kinship: Kinship): string {
  if (ups === 0) return descendantWord(downs, kinship);
  if (downs === 0) return ancestorWord(ups, kinship);
  if (ups === 1 && downs === 1) return kinship.sibling;
  if (ups === 1) return kinship.join(kinship.sibling, descendantWord(downs - 1, kinship));
  if (downs === 1) return kinship.join(ancestorWord(ups - 1, kinship), kinship.sibling);
  const degree = Math.min(ups, downs) - 1;
  const removed = Math.abs(ups - downs);
  const cousin = kinship.cousin(kinship.ordinal(degree));
  if (removed === 0) return cousin;
  const removal = removed === 1 ? kinship.onceRemoved : removed === 2 ? kinship.twiceRemoved : kinship.timesRemoved(removed);
  return `${cousin} ${removal}`;
}

function ancestorWord(count: number, kinship: Kinship): string {
  if (count <= 1) return kinship.parent;
  if (count === 2) return kinship.grandparent;
  return `${kinship.great.repeat(count - 2)}${kinship.grandparent}`;
}

function descendantWord(count: number, kinship: Kinship): string {
  if (count <= 1) return kinship.child;
  if (count === 2) return kinship.grandchild;
  return `${kinship.great.repeat(count - 2)}${kinship.grandchild}`;
}

function countLeading(steps: RelationStep[], step: RelationStep): number {
  let count = 0;
  while (steps[count] === step) count += 1;
  return count;
}

function named(doc: TreeDocument, personId: string, messages: Messages): string {
  const person = getPerson(doc, personId);
  return person ? personName(person, messages) : messages.suggestions.missing;
}

function yearOf(value: string | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return value.slice(0, 4);
}
