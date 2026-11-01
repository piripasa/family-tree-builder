import { getPerson } from "./tree";
import type { FactSource, SourceFact, SourceKind, TreeDocument } from "./types";

export const SOURCE_LIMIT = 12;

const PERSON_FACTS = ["name", "birth", "death"] as const;
const KIND_LIMIT: Record<SourceKind, number> = {
  person: 80,
  certificate: 160,
  note: 200,
};

export type SourceInput = {
  fact: SourceFact;
  kind: SourceKind;
  detail: string;
};

export type SourceWrite =
  | { ok: true; document: TreeDocument }
  | { ok: false; error: string };

export function sourceFactLabel(fact: SourceFact): string {
  if (fact === "name") return "Name";
  if (fact === "birth") return "Birth";
  if (fact === "death") return "Death";
  return "Marriage";
}

export function sourceKindLabel(kind: SourceKind): string {
  if (kind === "person") return "A person";
  if (kind === "certificate") return "A certificate";
  return "A note";
}

export function describeSource(source: FactSource): string {
  return `${sourceFactLabel(source.fact)} · ${sourceKindLabel(source.kind)} · ${source.detail}`;
}

export function sourceDetailLimit(kind: SourceKind): number {
  return KIND_LIMIT[kind];
}

export function parseFactSources(
  value: unknown,
  facts: readonly SourceFact[],
  record: "person" | "couple",
): { ok: true; sources?: FactSource[] } | { ok: false; error: string } {
  if (value === undefined) return { ok: true };
  if (!Array.isArray(value)) return { ok: false, error: "A source in that file is unreadable." };
  if (value.length > SOURCE_LIMIT) {
    const who = record === "person" ? "person" : "couple";
    return { ok: false, error: `A ${who} in that file has too many sources.` };
  }
  const sources: FactSource[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.id !== "string") {
      return { ok: false, error: "A source in that file is unreadable." };
    }
    const id = entry.id.trim();
    if (!id || id.length > 80 || seen.has(id)) {
      return { ok: false, error: seen.has(id) ? "That file repeats a source." : "A source in that file is unreadable." };
    }
    if (typeof entry.fact !== "string" || !facts.includes(entry.fact as SourceFact)) {
      return { ok: false, error: "A source in that file is unreadable." };
    }
    if (typeof entry.kind !== "string" || !isKind(entry.kind)) {
      return { ok: false, error: "A source in that file is unreadable." };
    }
    if (typeof entry.detail !== "string") return { ok: false, error: "A source in that file is unreadable." };
    const detail = entry.detail.trim();
    if (!detail) return { ok: false, error: "A source in that file is unreadable." };
    if (detail.length > KIND_LIMIT[entry.kind]) return { ok: false, error: "A source in that file is too long." };
    seen.add(id);
    sources.push({ id, fact: entry.fact as SourceFact, kind: entry.kind, detail });
  }
  if (sources.length === 0) return { ok: true };
  return { ok: true, sources };
}

export function addPersonSource(document: TreeDocument, personId: string, input: SourceInput): SourceWrite {
  const person = getPerson(document, personId);
  if (!person) return { ok: false, error: "That person is not in this tree." };
  if (!isPersonFact(input.fact)) return { ok: false, error: "Choose which fact this source supports." };
  if (input.fact === "death" && person.living === true && !person.deathDate) {
    return { ok: false, error: "A living person's death stays unrecorded." };
  }
  const detail = checkedDetail(input.kind, input.detail);
  if (typeof detail !== "string") return detail;
  const sources = person.sources ?? [];
  if (sources.length >= SOURCE_LIMIT) return { ok: false, error: "This person already has 12 sources." };
  if (sources.some((source) => sameSource(source, input.fact, input.kind, detail))) {
    return { ok: false, error: "That source is already recorded." };
  }
  return {
    ok: true,
    document: replacePerson(document, personId, {
      ...person,
      sources: [...sources, { id: crypto.randomUUID(), fact: input.fact, kind: input.kind, detail }],
    }),
  };
}

export function removePersonSource(document: TreeDocument, personId: string, sourceId: string): TreeDocument {
  const person = getPerson(document, personId);
  if (!person?.sources) return document;
  return replacePerson(document, personId, { ...person, sources: withoutSource(person.sources, sourceId) });
}

export function addMarriageSource(
  document: TreeDocument,
  partnershipId: string,
  input: Pick<SourceInput, "kind" | "detail">,
): SourceWrite {
  const partnership = document.partnerships.find((item) => item.id === partnershipId);
  if (!partnership) return { ok: false, error: "That couple is not in this tree." };
  if (partnership.partnerIds.length < 2) {
    return { ok: false, error: "Record both partners before adding a marriage source." };
  }
  const detail = checkedDetail(input.kind, input.detail);
  if (typeof detail !== "string") return detail;
  const sources = partnership.sources ?? [];
  if (sources.length >= SOURCE_LIMIT) return { ok: false, error: "This couple already has 12 sources." };
  if (sources.some((source) => sameSource(source, "marriage", input.kind, detail))) {
    return { ok: false, error: "That source is already recorded." };
  }
  return {
    ok: true,
    document: replacePartnership(document, partnershipId, {
      ...partnership,
      sources: [...sources, { id: crypto.randomUUID(), fact: "marriage", kind: input.kind, detail }],
    }),
  };
}

export function removeMarriageSource(document: TreeDocument, partnershipId: string, sourceId: string): TreeDocument {
  const partnership = document.partnerships.find((item) => item.id === partnershipId);
  if (!partnership?.sources) return document;
  return replacePartnership(document, partnershipId, {
    ...partnership,
    sources: withoutSource(partnership.sources, sourceId),
  });
}

function checkedDetail(kind: SourceKind, value: string): string | SourceWrite {
  if (!isKind(kind)) return { ok: false, error: "Choose what kind of source this is." };
  const detail = value.trim();
  if (!detail) {
    if (kind === "person") return { ok: false, error: "Enter the person who told you." };
    if (kind === "certificate") return { ok: false, error: "Enter the certificate." };
    return { ok: false, error: "Enter a short note." };
  }
  if (detail.length > KIND_LIMIT[kind]) return { ok: false, error: "That source is too long." };
  return detail;
}

function withoutSource(sources: FactSource[], sourceId: string): FactSource[] | undefined {
  const next = sources.filter((source) => source.id !== sourceId);
  return next.length > 0 ? next : undefined;
}

function sameSource(source: FactSource, fact: SourceFact, kind: SourceKind, detail: string): boolean {
  return source.fact === fact && source.kind === kind && source.detail === detail;
}

function isPersonFact(fact: SourceFact): fact is "name" | "birth" | "death" {
  return PERSON_FACTS.includes(fact as (typeof PERSON_FACTS)[number]);
}

function isKind(value: string): value is SourceKind {
  return value === "person" || value === "certificate" || value === "note";
}

function replacePerson(document: TreeDocument, personId: string, person: TreeDocument["people"][number]): TreeDocument {
  return {
    ...document,
    people: document.people.map((item) => (item.id === personId ? person : item)),
  };
}

function replacePartnership(
  document: TreeDocument,
  partnershipId: string,
  partnership: TreeDocument["partnerships"][number],
): TreeDocument {
  return {
    ...document,
    partnerships: document.partnerships.map((item) => (item.id === partnershipId ? partnership : item)),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
