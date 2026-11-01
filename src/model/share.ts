import { isAlive } from "./tree";
import type { TreeDocument } from "./types";

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
