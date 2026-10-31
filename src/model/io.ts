import { createsAncestorCycle } from "./tree";
import type { Partnership, Person, TreeDocument } from "./types";

export type ParseResult =
  | { ok: true; document: TreeDocument }
  | { ok: false; error: string };

export function downloadTree(tree: TreeDocument): void {
  const blob = new Blob([JSON.stringify(tree, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = "family-tree.json";
  link.click();
  URL.revokeObjectURL(url);
}

export function parseTreeDocument(input: unknown): ParseResult {
  if (!isRecord(input)) return fail("That file is not a family tree.");
  if (input.version !== 1) return fail("This file is from an unsupported version.");
  if (!Array.isArray(input.people) || !Array.isArray(input.partnerships)) {
    return fail("That file is not a family tree.");
  }

  const people: Person[] = [];
  const seenPeople = new Set<string>();
  for (const entry of input.people) {
    if (!isRecord(entry) || typeof entry.id !== "string" || !entry.id) {
      return fail("A person in that file is missing an id.");
    }
    if (seenPeople.has(entry.id)) return fail("That file repeats a person.");
    if (typeof entry.givenName !== "string" || typeof entry.familyName !== "string") {
      return fail("A person in that file has an unreadable name.");
    }
    const profile = readProfile(entry);
    if (!("fields" in profile)) return profile;
    seenPeople.add(entry.id);
    people.push({ id: entry.id, givenName: entry.givenName, familyName: entry.familyName, ...profile.fields });
  }

  const partnerships: Partnership[] = [];
  const seenPartnerships = new Set<string>();
  const children = new Set<string>();
  for (const entry of input.partnerships) {
    if (!isRecord(entry) || typeof entry.id !== "string" || !entry.id) {
      return fail("A relationship in that file is missing an id.");
    }
    if (seenPartnerships.has(entry.id)) return fail("That file repeats a relationship.");
    if (!isStringArray(entry.partnerIds) || !isStringArray(entry.childIds)) {
      return fail("A relationship in that file is unreadable.");
    }
    if (entry.partnerIds.length < 1 || entry.partnerIds.length > 2) {
      return fail("A relationship has an unsupported number of partners.");
    }
    if (new Set(entry.partnerIds).size !== entry.partnerIds.length) {
      return fail("A person is listed twice in the same relationship.");
    }
    if (new Set(entry.childIds).size !== entry.childIds.length) {
      return fail("A child is listed twice in the same relationship.");
    }
    for (const id of [...entry.partnerIds, ...entry.childIds]) {
      if (!seenPeople.has(id)) return fail("That file links to someone who is missing.");
    }
    for (const childId of entry.childIds) {
      if (entry.partnerIds.includes(childId)) {
        return fail("That would make someone their own ancestor.");
      }
      if (children.has(childId)) return fail("A person in that file has more than one set of parents.");
      children.add(childId);
    }
    seenPartnerships.add(entry.id);
    partnerships.push({
      id: entry.id,
      partnerIds: [...entry.partnerIds],
      childIds: [...entry.childIds],
    });
  }

  const document: TreeDocument = {
    version: 1,
    people,
    partnerships,
    focusId: null,
  };

  for (const partnership of partnerships) {
    for (const parentId of partnership.partnerIds) {
      for (const childId of partnership.childIds) {
        if (createsAncestorCycle(document, parentId, childId)) {
          return fail("That would make someone their own ancestor.");
        }
      }
    }
  }

  if (input.focusId === null || input.focusId === undefined) {
    document.focusId = people[0]?.id ?? null;
  } else if (typeof input.focusId === "string" && seenPeople.has(input.focusId)) {
    document.focusId = input.focusId;
  } else {
    return fail("That file points at someone who is missing.");
  }

  return { ok: true, document };
}

function readProfile(
  entry: Record<string, unknown>,
): { ok: true; fields: Partial<Person> } | ParseResult {
  const fields: Partial<Person> = {};
  const birthDate = optionalDate(entry.birthDate, "birth date");
  if (typeof birthDate !== "string") return birthDate;
  if (birthDate) fields.birthDate = birthDate;
  const deathDate = optionalDate(entry.deathDate, "death date");
  if (typeof deathDate !== "string") return deathDate;
  if (deathDate) fields.deathDate = deathDate;
  const birthPlace = optionalText(entry.birthPlace, "birth place", 160);
  if (typeof birthPlace !== "string") return birthPlace;
  if (birthPlace) fields.birthPlace = birthPlace;
  const deathPlace = optionalText(entry.deathPlace, "death place", 160);
  if (typeof deathPlace !== "string") return deathPlace;
  if (deathPlace) fields.deathPlace = deathPlace;
  const note = optionalText(entry.note, "note", 2000);
  if (typeof note !== "string") return note;
  if (note) fields.note = note;
  const photo = optionalPhoto(entry.photo);
  if (typeof photo !== "string") return photo;
  if (photo) fields.photo = photo;
  return { ok: true, fields };
}

function optionalDate(value: unknown, label: string): string | ParseResult {
  if (value === undefined || value === "") return "";
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fail(`A ${label} in that file is unreadable.`);
  }
  return value;
}

function optionalText(value: unknown, label: string, max: number): string | ParseResult {
  if (value === undefined || value === "") return "";
  if (typeof value !== "string") return fail(`A ${label} in that file is unreadable.`);
  const trimmed = value.trim();
  if (trimmed.length > max) return fail(`A ${label} in that file is too long.`);
  return trimmed;
}

function optionalPhoto(value: unknown): string | ParseResult {
  if (value === undefined || value === "") return "";
  if (typeof value !== "string" || !value.startsWith("data:image/")) {
    return fail("A photo in that file is unreadable.");
  }
  if (value.length > 1_500_000) return fail("A photo in that file is too large.");
  return value;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(error: string): ParseResult {
  return { ok: false, error };
}
