import { isAlive } from "./tree";
import type { TreeDocument } from "./types";

export function sharedTree(document: TreeDocument): TreeDocument {
  return {
    ...document,
    people: document.people.map((person) => {
      if (isAlive(person)) return { id: person.id, givenName: "Living", familyName: "" };
      if (!person.sources) return person;
      const next = { ...person };
      delete next.sources;
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
