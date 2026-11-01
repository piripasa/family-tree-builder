import { describe, expect, it } from "vitest";
import { bn } from "./bn";
import { en } from "./en";
import { translateError } from "./errors";
import { formatConnection, relationPhrase } from "./format";
import { connection, describeRelation } from "@/model/find";
import { addChild, addFirstPerson, addParent, addPartner } from "@/model/tree";
import type { TreeDocument, TreeResult } from "@/model/types";

function must(result: TreeResult): TreeDocument {
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

function named(doc: TreeDocument, givenName: string) {
  const person = doc.people.find((item) => item.givenName === givenName);
  if (!person) throw new Error(`Missing ${givenName}`);
  return person;
}

function family(): TreeDocument {
  let doc = must(addFirstPerson({ version: 1, people: [], partnerships: [], focusId: null }, "Ada", "King"));
  doc = must(addPartner(doc, named(doc, "Ada").id, { type: "new", givenName: "Bea", familyName: "King" }));
  doc = must(addChild(doc, named(doc, "Ada").id, { type: "new", givenName: "Cam", familyName: "King" }));
  return doc;
}

describe("translation", () => {
  it("keeps English relationship sentences and translates them into Bengali", () => {
    const doc = family();
    const ada = named(doc, "Ada").id;
    const bea = named(doc, "Bea").id;
    const cam = named(doc, "Cam").id;
    expect(formatConnection(doc, connection(doc, ada, bea), en)).toBe(describeRelation(doc, ada, bea));
    expect(formatConnection(doc, connection(doc, ada, cam), en)).toBe(describeRelation(doc, ada, cam));
    expect(formatConnection(doc, connection(doc, ada, bea), bn)).toBe("Bea King, Ada King-এর সঙ্গী।");
    expect(relationPhrase(["parent", "parent"], en.kinship)).toBe("grandparent");
    expect(relationPhrase(["child", "child"], bn.kinship)).toBe("নাতি-নাতনি");
  });

  it("translates a known error and a file field, and leaves English unchanged", () => {
    expect(translateError("en", "Sign in to share a link.")).toBe("Sign in to share a link.");
    expect(translateError("bn", "Sign in to share a link.")).toBe("লিংক শেয়ার করতে সাইন ইন করুন।");
    expect(translateError("bn", "A birth date in that file is unreadable.")).toBe("এই ফাইলে জন্মতারিখ পড়া যাচ্ছে না।");
    expect(translateError("bn", "Something new.")).toBe("Something new.");
  });
});
