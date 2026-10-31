import { isAlive } from "./tree";
import type { TreeDocument } from "./types";

export function sharedTree(document: TreeDocument): TreeDocument {
  return {
    ...document,
    people: document.people.map((person) =>
      isAlive(person) ? { id: person.id, givenName: "Living", familyName: "" } : person,
    ),
  };
}
