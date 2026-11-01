import {
  addChild,
  addParent,
  addPartner,
  displayName,
  getPerson,
  isAlive,
  partnershipsAsPartner,
  setFocus,
  updatePerson,
} from "./tree";
import type { TreeDocument, TreeResult } from "./types";

export const SUGGESTION_LIMIT = 30;

const SUGGESTION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readSuggestionId(id: string): string | null {
  return SUGGESTION_ID.test(id) ? id : null;
}

const NAME_LIMIT = 80;
const PLACE_LIMIT = 160;
const NOTE_LIMIT = 2000;

export class SuggestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuggestionError";
  }
}

export type PersonSuggestion = {
  kind: "person";
  givenName: string;
  familyName: string;
  relation: "parent" | "partner" | "child";
  relatedToId: string;
  partnershipId?: string;
};

export type DateSuggestion = {
  kind: "date";
  personId: string;
  field: "birthDate" | "deathDate";
  value: string;
};

export type CorrectionSuggestion = {
  kind: "correction";
  personId: string;
  field: "givenName" | "familyName" | "birthPlace" | "deathPlace" | "note";
  value: string;
};

export type SuggestionDraft = PersonSuggestion | DateSuggestion | CorrectionSuggestion;

export type StoredSuggestion = SuggestionDraft & { id: string };

type SuggestionRead = { ok: true; suggestion: SuggestionDraft } | { ok: false; error: string };

const RELATIONS = ["parent", "partner", "child"] as const;
const DATE_FIELDS = ["birthDate", "deathDate"] as const;
const CORRECTION_FIELDS = ["givenName", "familyName", "birthPlace", "deathPlace", "note"] as const;

const FIELD_LABEL: Record<DateSuggestion["field"] | CorrectionSuggestion["field"], string> = {
  birthDate: "birth date",
  deathDate: "death date",
  givenName: "given name",
  familyName: "family name",
  birthPlace: "birth place",
  deathPlace: "death place",
  note: "note",
};

export function parseSuggestion(input: unknown): SuggestionRead {
  if (!isRecord(input) || typeof input.kind !== "string") {
    return { ok: false, error: "That suggestion is unreadable." };
  }
  if (input.kind === "person") return parsePerson(input);
  if (input.kind === "date") return parseDate(input);
  if (input.kind === "correction") return parseCorrection(input);
  return { ok: false, error: "That suggestion is unreadable." };
}

export function checkSuggestion(document: TreeDocument, suggestion: SuggestionDraft): { ok: true } | { ok: false; error: string } {
  if (suggestion.kind === "person") {
    if (!getPerson(document, suggestion.relatedToId)) return { ok: false, error: "That person is not in this tree." };
    if (suggestion.relation === "child") {
      const partnerships = partnershipsAsPartner(document, suggestion.relatedToId);
      if (
        partnerships.length > 1 &&
        (!suggestion.partnershipId || !partnerships.some((item) => item.id === suggestion.partnershipId))
      ) {
        return { ok: false, error: "Choose which couple this child belongs to." };
      }
    }
    return { ok: true };
  }
  const person = getPerson(document, suggestion.personId);
  if (!person) return { ok: false, error: "That person is not in this tree." };
  if (isAlive(person)) return { ok: false, error: "Living people's details stay off suggestions." };
  return { ok: true };
}

export function readSuggestion(input: unknown, document: TreeDocument): SuggestionRead {
  const parsed = parseSuggestion(input);
  if (!parsed.ok) return parsed;
  const checked = checkSuggestion(document, parsed.suggestion);
  if (!checked.ok) return checked;
  return parsed;
}

export function applySuggestion(document: TreeDocument, suggestion: SuggestionDraft): TreeResult {
  const checked = checkSuggestion(document, suggestion);
  if (!checked.ok) return { ok: false, error: checked.error };
  if (suggestion.kind === "person") {
    const source = { type: "new" as const, givenName: suggestion.givenName, familyName: suggestion.familyName };
    const partnerships = partnershipsAsPartner(document, suggestion.relatedToId);
    const partnershipId =
      suggestion.relation === "child" && partnerships.length > 1 ? suggestion.partnershipId : undefined;
    const result =
      suggestion.relation === "parent"
        ? addParent(document, suggestion.relatedToId, source)
        : suggestion.relation === "partner"
          ? addPartner(document, suggestion.relatedToId, source)
          : addChild(document, suggestion.relatedToId, source, partnershipId);
    if (!result.ok) return result;
    return { ...result, document: setFocus(result.document, result.personId) };
  }
  return {
    ok: true,
    personId: suggestion.personId,
    document: updatePerson(document, suggestion.personId, { [suggestion.field]: suggestion.value }),
  };
}

export function describeSuggestion(document: TreeDocument, suggestion: SuggestionDraft): string {
  if (suggestion.kind === "person") {
    const name = `${suggestion.givenName} ${suggestion.familyName}`.trim();
    const related = nameOf(document, suggestion.relatedToId);
    return `Add ${name} as a ${suggestion.relation} of ${related}.`;
  }
  const person = nameOf(document, suggestion.personId);
  const label = FIELD_LABEL[suggestion.field];
  if (suggestion.kind === "date") return `Set ${person}'s ${label} to ${suggestion.value}.`;
  return `Change ${person}'s ${label} to ${suggestion.value}.`;
}

function parsePerson(input: Record<string, unknown>): SuggestionRead {
  const givenName = cleanName(input.givenName, true);
  const familyName = cleanName(input.familyName, false);
  if (givenName === null || familyName === null) return { ok: false, error: "Enter a given name." };
  if (!isRelation(input.relation)) return { ok: false, error: "Choose how this person is related." };
  if (typeof input.relatedToId !== "string" || !input.relatedToId) {
    return { ok: false, error: "Choose the person they belong with." };
  }
  const suggestion: PersonSuggestion = {
    kind: "person",
    givenName,
    familyName,
    relation: input.relation,
    relatedToId: input.relatedToId,
  };
  if (typeof input.partnershipId === "string" && input.partnershipId) suggestion.partnershipId = input.partnershipId;
  return { ok: true, suggestion };
}

function parseDate(input: Record<string, unknown>): SuggestionRead {
  if (!isDateField(input.field)) return { ok: false, error: "Choose a birth date or a death date." };
  if (typeof input.personId !== "string" || !input.personId) return { ok: false, error: "Choose a person." };
  if (typeof input.value !== "string" || !isIsoDate(input.value)) return { ok: false, error: "Enter a full date." };
  return { ok: true, suggestion: { kind: "date", personId: input.personId, field: input.field, value: input.value } };
}

function parseCorrection(input: Record<string, unknown>): SuggestionRead {
  if (!isCorrectionField(input.field)) return { ok: false, error: "Choose what to correct." };
  if (typeof input.personId !== "string" || !input.personId) return { ok: false, error: "Choose a person." };
  const limit = input.field === "note" ? NOTE_LIMIT : input.field.endsWith("Place") ? PLACE_LIMIT : NAME_LIMIT;
  const value = cleanText(input.value, limit);
  if (!value) return { ok: false, error: "Enter the correction." };
  return { ok: true, suggestion: { kind: "correction", personId: input.personId, field: input.field, value } };
}

function nameOf(document: TreeDocument, personId: string): string {
  const person = getPerson(document, personId);
  return person ? displayName(person) : "someone who is no longer in this tree";
}

function cleanName(value: unknown, required: boolean): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > NAME_LIMIT) return null;
  if (required && !trimmed) return null;
  return trimmed;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isRelation(value: unknown): value is PersonSuggestion["relation"] {
  return typeof value === "string" && RELATIONS.some((item) => item === value);
}

function isDateField(value: unknown): value is DateSuggestion["field"] {
  return typeof value === "string" && DATE_FIELDS.some((item) => item === value);
}

function isCorrectionField(value: unknown): value is CorrectionSuggestion["field"] {
  return typeof value === "string" && CORRECTION_FIELDS.some((item) => item === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
