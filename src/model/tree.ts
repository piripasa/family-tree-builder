import type {
  Partnership,
  Person,
  RelativeSource,
  TreeDocument,
  TreeResult,
} from "./types";

export function createEmptyDocument(): TreeDocument {
  return { version: 1, people: [], partnerships: [], focusId: null };
}

export function displayName(person: Person): string {
  const name = `${person.givenName} ${person.familyName}`.trim();
  return name || "Unnamed";
}

export function isAlive(person: Person): boolean {
  return person.living === true && !person.deathDate;
}

export function personMenuLabel(person: Person): string {
  const name = displayName(person);
  const span = lifeSpan(person);
  return span ? `${name} (${span})` : name;
}

export function lifeSpan(person: Person): string {
  const birth = yearOf(person.birthDate);
  const death = yearOf(person.deathDate);
  if (birth && death) return `${birth}–${death}`;
  if (birth) return `b. ${birth}`;
  if (death) return `d. ${death}`;
  return "";
}

export function getPerson(doc: TreeDocument, personId: string): Person | undefined {
  return doc.people.find((person) => person.id === personId);
}

export function parentPartnershipOf(
  doc: TreeDocument,
  personId: string,
): Partnership | undefined {
  return doc.partnerships.find((partnership) => partnership.childIds.includes(personId));
}

export function partnershipsAsPartner(doc: TreeDocument, personId: string): Partnership[] {
  return doc.partnerships.filter((partnership) => partnership.partnerIds.includes(personId));
}

export function parentsOf(doc: TreeDocument, personId: string): Person[] {
  const partnership = parentPartnershipOf(doc, personId);
  if (!partnership) return [];
  return partnership.partnerIds.flatMap((id) => {
    const person = getPerson(doc, id);
    return person ? [person] : [];
  });
}

export function partnersOf(doc: TreeDocument, personId: string): Person[] {
  const ids = new Set<string>();
  for (const partnership of partnershipsAsPartner(doc, personId)) {
    for (const id of partnership.partnerIds) {
      if (id !== personId) ids.add(id);
    }
  }
  return [...ids].flatMap((id) => {
    const person = getPerson(doc, id);
    return person ? [person] : [];
  });
}

export function childrenOf(doc: TreeDocument, personId: string): Person[] {
  const ids: string[] = [];
  for (const partnership of partnershipsAsPartner(doc, personId)) {
    for (const id of partnership.childIds) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids.flatMap((id) => {
    const person = getPerson(doc, id);
    return person ? [person] : [];
  });
}

export function partnershipLabel(
  doc: TreeDocument,
  partnership: Partnership,
  personId: string,
): string {
  const others = partnership.partnerIds.filter((id) => id !== personId);
  if (others.length === 0) return "Only this parent";
  const names = others.map((id) => {
    const person = getPerson(doc, id);
    return person ? personMenuLabel(person) : "Unknown";
  });
  return `With ${names.join(" and ")}`;
}

export function isDescendant(
  doc: TreeDocument,
  ancestorId: string,
  maybeDescendantId: string,
): boolean {
  if (ancestorId === maybeDescendantId) return false;
  const seen = new Set<string>();
  const stack = [ancestorId];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const partnership of doc.partnerships) {
      if (!partnership.partnerIds.includes(current)) continue;
      for (const childId of partnership.childIds) {
        if (childId === maybeDescendantId) return true;
        stack.push(childId);
      }
    }
  }
  return false;
}

export function createsAncestorCycle(
  doc: TreeDocument,
  parentId: string,
  childId: string,
): boolean {
  if (parentId === childId) return true;
  return isDescendant(doc, childId, parentId);
}

export function eligiblePeople(
  doc: TreeDocument,
  personId: string,
  role: "parent" | "partner" | "child",
): Person[] {
  return doc.people.filter((candidate) => canLink(doc, personId, candidate.id, role));
}

export function addFirstPerson(
  doc: TreeDocument,
  givenName: string,
  familyName: string,
): TreeResult {
  const created = realizePerson(doc, { type: "new", givenName, familyName });
  if (!created.ok) return created;
  return {
    ok: true,
    personId: created.personId,
    document: { ...created.document, focusId: created.personId },
  };
}

export function updatePerson(
  doc: TreeDocument,
  personId: string,
  patch: Partial<Omit<Person, "id">>,
): TreeDocument {
  return {
    ...doc,
    people: doc.people.map((person) => (person.id === personId ? applyPersonPatch(person, patch) : person)),
  };
}

export function setFocus(doc: TreeDocument, personId: string): TreeDocument {
  if (!getPerson(doc, personId)) return doc;
  return { ...doc, focusId: personId };
}

export function deletePerson(doc: TreeDocument, personId: string): TreeDocument {
  const people = doc.people.filter((person) => person.id !== personId);
  const partnerships = doc.partnerships
    .map((partnership) => ({
      ...partnership,
      partnerIds: partnership.partnerIds.filter((id) => id !== personId),
      childIds: partnership.childIds.filter((id) => id !== personId),
    }))
    .filter((partnership) => partnership.partnerIds.length > 0);

  let focusId = doc.focusId;
  if (focusId === personId) {
    focusId = replacementFocus(doc, personId) ?? people[0]?.id ?? null;
  }
  if (focusId && !people.some((person) => person.id === focusId)) {
    focusId = people[0]?.id ?? null;
  }
  return { version: 1, people, partnerships, focusId };
}

export function addParent(
  doc: TreeDocument,
  childId: string,
  source: RelativeSource,
): TreeResult {
  if (!getPerson(doc, childId)) return fail("That person is not in this tree.");
  const existing = parentPartnershipOf(doc, childId);
  if (existing && existing.partnerIds.length >= 2) {
    return fail("A person can only have two parents.");
  }

  const created = realizePerson(doc, source);
  if (!created.ok) return created;
  const parentId = created.personId;
  let next = created.document;

  if (parentId === childId) return fail("A person cannot be their own relative.");
  if (existing?.partnerIds.includes(parentId)) return fail("That person is already a parent.");
  if (partnershipsAsPartner(next, childId).some((partnership) => partnership.partnerIds.includes(parentId))) {
    return fail("A partner cannot also be this person's parent.");
  }

  const affected = existing ? existing.childIds : [childId];
  if (affected.some((id) => createsAncestorCycle(next, parentId, id))) {
    return fail("That would make someone their own ancestor.");
  }

  if (!existing) {
    next = {
      ...next,
      partnerships: [
        ...next.partnerships,
        { id: crypto.randomUUID(), partnerIds: [parentId], childIds: [childId] },
      ],
    };
  } else {
    next = {
      ...next,
      partnerships: next.partnerships.map((partnership) =>
        partnership.id === existing.id
          ? { ...partnership, partnerIds: [...partnership.partnerIds, parentId] }
          : partnership,
      ),
    };
  }

  return { ok: true, document: next, personId: parentId };
}

export function addPartner(
  doc: TreeDocument,
  personId: string,
  source: RelativeSource,
): TreeResult {
  if (!getPerson(doc, personId)) return fail("That person is not in this tree.");
  const created = realizePerson(doc, source);
  if (!created.ok) return created;
  const partnerId = created.personId;
  const next = created.document;

  if (partnerId === personId) return fail("A person cannot be their own relative.");
  if (isDescendant(next, personId, partnerId) || isDescendant(next, partnerId, personId)) {
    return fail("That would make someone their own ancestor.");
  }
  if (
    next.partnerships.some(
      (partnership) =>
        partnership.partnerIds.includes(personId) && partnership.partnerIds.includes(partnerId),
    )
  ) {
    return fail("Those two are already partners.");
  }

  return {
    ok: true,
    personId: partnerId,
    document: {
      ...next,
      partnerships: [
        ...next.partnerships,
        { id: crypto.randomUUID(), partnerIds: [personId, partnerId], childIds: [] },
      ],
    },
  };
}

export function addChild(
  doc: TreeDocument,
  parentId: string,
  source: RelativeSource,
  partnershipId?: string,
): TreeResult {
  if (!getPerson(doc, parentId)) return fail("That person is not in this tree.");
  const asPartner = partnershipsAsPartner(doc, parentId);
  let partnership: Partnership | undefined;

  if (partnershipId) {
    partnership = doc.partnerships.find((item) => item.id === partnershipId);
    if (!partnership || !partnership.partnerIds.includes(parentId)) {
      return fail("Choose which partnership this child belongs to.");
    }
  } else if (asPartner.length > 1) {
    return fail("Choose which partnership this child belongs to.");
  } else if (asPartner.length === 1) {
    partnership = asPartner[0];
  }

  const created = realizePerson(doc, source);
  if (!created.ok) return created;
  let next = created.document;
  const childId = created.personId;
  const parentIds = partnership ? partnership.partnerIds : [parentId];

  if (childId === parentId) return fail("A person cannot be their own relative.");
  if (parentIds.includes(childId)) return fail("A partner cannot also be this person's child.");
  if (parentPartnershipOf(next, childId)) return fail("That person already has parents.");
  if (parentIds.some((id) => createsAncestorCycle(next, id, childId))) {
    return fail("That would make someone their own ancestor.");
  }

  if (!partnership) {
    next = {
      ...next,
      partnerships: [
        ...next.partnerships,
        { id: crypto.randomUUID(), partnerIds: [parentId], childIds: [childId] },
      ],
    };
  } else {
    const targetId = partnership.id;
    next = {
      ...next,
      partnerships: next.partnerships.map((item) =>
        item.id === targetId ? { ...item, childIds: [...item.childIds, childId] } : item,
      ),
    };
  }

  return { ok: true, document: next, personId: childId };
}

function canLink(
  doc: TreeDocument,
  personId: string,
  candidateId: string,
  role: "parent" | "partner" | "child",
): boolean {
  if (candidateId === personId) return false;
  if (role === "parent") {
    const existing = parentPartnershipOf(doc, personId);
    if (existing && existing.partnerIds.length >= 2) return false;
    if (existing?.partnerIds.includes(candidateId)) return false;
    if (partnershipsAsPartner(doc, personId).some((partnership) => partnership.partnerIds.includes(candidateId))) {
      return false;
    }
    const affected = existing ? existing.childIds : [personId];
    return !affected.some((id) => createsAncestorCycle(doc, candidateId, id));
  }
  if (role === "partner") {
    if (isDescendant(doc, personId, candidateId) || isDescendant(doc, candidateId, personId)) return false;
    return !doc.partnerships.some(
      (partnership) =>
        partnership.partnerIds.includes(personId) && partnership.partnerIds.includes(candidateId),
    );
  }

  if (parentPartnershipOf(doc, candidateId)) return false;
  if (createsAncestorCycle(doc, personId, candidateId)) return false;
  const partnerships = partnershipsAsPartner(doc, personId);
  if (partnerships.some((partnership) => partnership.partnerIds.includes(candidateId))) return false;
  if (partnerships.length === 0) return true;
  return partnerships.some((partnership) =>
    partnership.partnerIds.every((id) => !createsAncestorCycle(doc, id, candidateId)),
  );
}

function realizePerson(doc: TreeDocument, source: RelativeSource): TreeResult {
  if (source.type === "new") {
    const givenName = source.givenName.trim();
    const familyName = source.familyName.trim();
    if (!givenName) return fail("Enter a given name.");
    const person: Person = { id: crypto.randomUUID(), givenName, familyName, living: true };
    return {
      ok: true,
      personId: person.id,
      document: { ...doc, people: [...doc.people, person] },
    };
  }
  if (!getPerson(doc, source.personId)) return fail("That person is not in this tree.");
  return { ok: true, document: doc, personId: source.personId };
}

function replacementFocus(doc: TreeDocument, personId: string): string | null {
  const partner = partnersOf(doc, personId)[0];
  if (partner) return partner.id;
  const child = childrenOf(doc, personId)[0];
  if (child) return child.id;
  const parent = parentsOf(doc, personId)[0];
  if (parent) return parent.id;
  return null;
}

function applyPersonPatch(person: Person, patch: Partial<Omit<Person, "id">>): Person {
  const next: Person = { ...person, ...patch };
  if (patch.living === true) {
    delete next.deathDate;
    delete next.deathPlace;
    next.living = true;
  } else if (patch.living === false) {
    next.living = false;
  } else if (typeof patch.deathDate === "string" && patch.deathDate.trim() !== "") {
    next.living = false;
  }
  if (next.living !== true && next.living !== false) delete next.living;
  for (const key of ["birthDate", "deathDate", "birthPlace", "deathPlace", "note"] as const) {
    const value = next[key]?.trim();
    if (value) next[key] = value;
    else delete next[key];
  }
  if (!next.photo) delete next.photo;
  return next;
}

function yearOf(value: string | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return value.slice(0, 4);
}

function fail(error: string): TreeResult {
  return { ok: false, error };
}
