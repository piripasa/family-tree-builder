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
    person.living === undefined &&
    person.gender === undefined &&
    person.email === undefined &&
    person.phone === undefined &&
    person.socials === undefined
  );
}

export function sharedTree(document: TreeDocument): TreeDocument {
  return {
    ...document,
    people: document.people.map((person) => {
      if (isAlive(person)) return { id: person.id, givenName: "Living", familyName: "" };
      const next = { ...person };
      delete next.sources;
      delete next.email;
      delete next.phone;
      delete next.socials;
      return next;
    }),
    partnerships: document.partnerships.map((partnership) => {
      const hidden = partnership.partnerIds.some((id) => {
        const person = document.people.find((item) => item.id === id);
        return person ? isAlive(person) : false;
      });
      if (!hidden && !partnership.sources) return partnership;
      const next = { ...partnership };
      delete next.sources;
      if (hidden) {
        delete next.marriageDate;
        delete next.marriagePlace;
      }
      return next;
    }),
  };
}
