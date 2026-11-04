import { createsAncestorCycle, getPerson, isDescendant, parentPartnershipOf } from "./tree";
import type { Partnership, Person, TreeDocument, TreeResult } from "./types";

type TaggedPartnership = Partnership & { preferred: boolean };

export function mergePeople(doc: TreeDocument, keepId: string, dropId: string): TreeResult {
  if (keepId === dropId) return fail("Choose two different people.");
  const keep = getPerson(doc, keepId);
  const drop = getPerson(doc, dropId);
  if (!keep || !drop) return fail("That person is not in this tree.");

  const keepParents = parentIds(doc, keepId, keepId, dropId);
  const dropParents = parentIds(doc, dropId, keepId, dropId);
  if (
    keepParents.size > 0 &&
    dropParents.size > 0 &&
    !isSubset(keepParents, dropParents) &&
    !isSubset(dropParents, keepParents)
  ) {
    return fail("Those two records have different parents.");
  }
  const parents = new Set([...keepParents, ...dropParents]);
  if (parents.size > 2) return fail("A person can only have two parents.");

  const combined = combinePartnerships(doc.partnerships.map((partnership) => rewrite(partnership, keepId, dropId)));
  const placed = placeSurvivor(combined, keepId, parents);
  const partnerships = placed.filter(
    (partnership) =>
      partnership.partnerIds.length > 0 &&
      (partnership.partnerIds.length >= 2 || partnership.childIds.length > 0),
  );

  const people = doc.people
    .filter((person) => person.id !== dropId)
    .map((person) => (person.id === keepId ? mergedPerson(keep, drop) : person));
  let focusId = doc.focusId === dropId ? keepId : doc.focusId;
  if (focusId && !people.some((person) => person.id === focusId)) focusId = keepId;

  const next: TreeDocument = { version: 1, people, partnerships, focusId };
  for (const partnership of partnerships) {
    if (partnership.partnerIds.length > 2) return fail("A person can only have two parents.");
    const [first, second] = partnership.partnerIds;
    if (second && (isDescendant(next, first, second) || isDescendant(next, second, first))) {
      return fail("That would make someone their own ancestor.");
    }
    for (const parentId of partnership.partnerIds) {
      for (const childId of partnership.childIds) {
        if (parentId === childId || createsAncestorCycle(next, parentId, childId)) {
          return fail("That would make someone their own ancestor.");
        }
      }
    }
  }
  if (childInTwoFamilies(partnerships)) return fail("A person can only have one set of parents.");

  return { ok: true, document: next, personId: keepId };
}

function parentIds(doc: TreeDocument, personId: string, keepId: string, dropId: string): Set<string> {
  const partners = parentPartnershipOf(doc, personId)?.partnerIds ?? [];
  return new Set(partners.filter((id) => id !== keepId && id !== dropId));
}

function rewrite(partnership: Partnership, keepId: string, dropId: string): TaggedPartnership {
  const survivorWasChild = partnership.childIds.includes(keepId);
  const duplicateWasParent = partnership.partnerIds.includes(dropId);
  const survivorWasParent = partnership.partnerIds.includes(keepId);
  const duplicateWasChild = partnership.childIds.includes(dropId);

  let partnerIds = unique(partnership.partnerIds.map((id) => (id === dropId ? keepId : id)));
  let childIds = unique(partnership.childIds.map((id) => (id === dropId ? keepId : id)));
  if (survivorWasChild && duplicateWasParent) partnerIds = partnerIds.filter((id) => id !== keepId);
  else if (survivorWasParent && duplicateWasChild) childIds = childIds.filter((id) => id !== keepId);
  else if (partnerIds.includes(keepId)) childIds = childIds.filter((id) => id !== keepId);

  const next: TaggedPartnership = {
    ...partnership,
    partnerIds,
    childIds,
    preferred: survivorWasParent,
  };
  if (partnerIds.length < 2) {
    delete next.marriageDate;
    delete next.marriagePlace;
  }
  return next;
}

function combinePartnerships(items: TaggedPartnership[]): Partnership[] {
  const groups = new Map<string, TaggedPartnership>();
  for (const item of items) {
    const key = [...item.partnerIds].sort().join("\0");
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...item, childIds: [...item.childIds] });
      continue;
    }
    const primary = existing.preferred ? existing : item.preferred ? item : existing;
    const secondary = primary === existing ? item : existing;
    const next: TaggedPartnership = {
      ...existing,
      id: primary.id,
      childIds: unique([...existing.childIds, ...item.childIds]),
      preferred: existing.preferred || item.preferred,
    };
    const marriageDate = filled(primary.marriageDate, secondary.marriageDate);
    const marriagePlace = clip(filled(primary.marriagePlace, secondary.marriagePlace), 160);
    if (marriageDate) next.marriageDate = marriageDate;
    else delete next.marriageDate;
    if (marriagePlace) next.marriagePlace = marriagePlace;
    else delete next.marriagePlace;
    groups.set(key, next);
  }
  return [...groups.values()].map(({ preferred: _preferred, ...partnership }) => partnership);
}

function placeSurvivor(partnerships: Partnership[], keepId: string, parents: Set<string>): Partnership[] {
  const wanted = [...parents].sort();
  return partnerships.map((partnership) => {
    const chosen = wanted.length > 0 && sameIds(partnership.partnerIds, wanted);
    let childIds = partnership.childIds.filter((id) => id !== keepId);
    if (chosen) childIds = [...childIds, keepId];
    return { ...partnership, childIds };
  });
}

function mergedPerson(keep: Person, drop: Person): Person {
  const next: Person = {
    id: keep.id,
    givenName: keep.givenName,
    familyName: keep.familyName,
  };
  const birthDate = filled(keep.birthDate, drop.birthDate);
  const birthPlace = clip(filled(keep.birthPlace, drop.birthPlace), 160);
  const deathDate = filled(keep.deathDate, drop.deathDate);
  const deathPlace = clip(filled(keep.deathPlace, drop.deathPlace), 160);
  const note = mergedNote(keep.note, drop.note);
  const photo = keep.photo || drop.photo;
  if (birthDate) next.birthDate = birthDate;
  if (birthPlace) next.birthPlace = birthPlace;
  if (deathDate) next.deathDate = deathDate;
  if (deathPlace) next.deathPlace = deathPlace;
  if (note) next.note = note;
  if (photo) next.photo = photo;
  const gender = keep.gender ?? drop.gender;
  if (gender) next.gender = gender;
  if (deathDate) next.living = false;
  else if (keep.living === true || keep.living === false) next.living = keep.living;
  else if (drop.living === true || drop.living === false) next.living = drop.living;
  return next;
}

function mergedNote(kept?: string, other?: string): string | undefined {
  const primary = kept?.trim() ?? "";
  const secondary = other?.trim() ?? "";
  if (!primary) return secondary || undefined;
  if (!secondary || primary === secondary) return primary;
  const joined = `${primary}\n${secondary}`;
  return joined.length <= 2000 ? joined : primary;
}

function childInTwoFamilies(partnerships: Partnership[]): boolean {
  const seen = new Set<string>();
  for (const partnership of partnerships) {
    for (const childId of partnership.childIds) {
      if (seen.has(childId)) return true;
      seen.add(childId);
    }
  }
  return false;
}

function filled(primary?: string, secondary?: string): string | undefined {
  const first = primary?.trim();
  if (first) return first;
  const second = secondary?.trim();
  return second || undefined;
}

function clip(value: string | undefined, limit: number): string | undefined {
  return value ? value.slice(0, limit) : undefined;
}

function unique(ids: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function sameIds(left: string[], right: string[]): boolean {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function isSubset(left: Set<string>, right: Set<string>): boolean {
  for (const id of left) if (!right.has(id)) return false;
  return true;
}

function fail(error: string): TreeResult {
  return { ok: false, error };
}
