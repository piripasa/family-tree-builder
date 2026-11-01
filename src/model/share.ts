import { isAlive } from "./tree";
import type { Person, TreeDocument } from "./types";

export function isHiddenOnShare(person: Person): boolean {
  return (
    person.givenName === "Living" &&
    person.familyName === "" &&
    person.photo === undefined &&
    person.birthDate === undefined &&
    person.birthPlace === undefined &&
    person.deathDate === undefined &&
    person.deathPlace === undefined &&
    person.note === undefined &&
    person.living === undefined
  );
}

export function sharedTree(document: TreeDocument): TreeDocument {
  return {
    ...document,
    people: document.people.map((person) =>
      isAlive(person) ? { id: person.id, givenName: "Living", familyName: "" } : person,
    ),
    partnerships: document.partnerships.map((partnership) => {
      const hidden = partnership.partnerIds.some((id) => {
        const person = document.people.find((item) => item.id === id);
        return person ? isAlive(person) : false;
      });
      if (!hidden) return partnership;
      const next = { ...partnership };
      delete next.marriageDate;
      delete next.marriagePlace;
      return next;
    }),
  };
}
