import { parseTreeDocument, type ParseResult } from "./io";
import type { FactSource, Partnership, Person, SourceKind, TreeDocument } from "./types";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

type GedNode = {
  tag: string;
  value: string;
  xref?: string;
  children: GedNode[];
};

export function exportGedcom(document: TreeDocument): string {
  const ids = new Map(document.people.map((person, index) => [person.id, `@I${index + 1}@`]));
  const lines = [
    "0 HEAD",
    "1 GEDC",
    "2 VERS 5.5.1",
    "2 FORM LINEAGE-LINKED",
    "1 CHAR UTF-8",
  ];

  document.people.forEach((person) => {
    const id = ids.get(person.id);
    lines.push(`0 ${id} INDI`);
    writeValue(lines, 1, "NAME", `${person.givenName.trim()} /${person.familyName.trim().replaceAll("/", "")}/`);
    if (person.gender === "male") writeValue(lines, 1, "SEX", "M");
    else if (person.gender === "female") writeValue(lines, 1, "SEX", "F");
    else if (person.gender === "other") writeValue(lines, 1, "SEX", "X");
    writeFactSources(lines, 2, person.sources, "name");
    writeEvent(lines, "BIRT", person.birthDate, person.birthPlace, person.sources, "birth");
    if (person.living === true && !person.deathDate) writeValue(lines, 1, "_LIV", "Y");
    const deathCited = person.sources?.some((source) => source.fact === "death") ?? false;
    if (person.deathDate || person.deathPlace || deathCited) {
      writeEvent(lines, "DEAT", person.deathDate, person.deathPlace, person.sources, "death");
    } else if (person.living === false) writeValue(lines, 1, "DEAT", "Y");
    if (person.note?.trim()) writeValue(lines, 1, "NOTE", person.note.trim());
    for (const partnership of document.partnerships) {
      const family = familyId(document, partnership.id);
      if (partnership.partnerIds.includes(person.id)) lines.push(`1 FAMS ${family}`);
      if (partnership.childIds.includes(person.id)) lines.push(`1 FAMC ${family}`);
    }
  });

  document.partnerships.forEach((partnership) => {
    lines.push(`0 ${familyId(document, partnership.id)} FAM`);
    const [first, second] = partnership.partnerIds;
    if (first && ids.has(first)) lines.push(`1 HUSB ${ids.get(first)}`);
    if (second && ids.has(second)) lines.push(`1 WIFE ${ids.get(second)}`);
    for (const childId of partnership.childIds) {
      if (ids.has(childId)) lines.push(`1 CHIL ${ids.get(childId)}`);
    }
    if (partnership.marriageDate || partnership.marriagePlace || partnership.sources?.length) {
      writeEvent(lines, "MARR", partnership.marriageDate, partnership.marriagePlace, partnership.sources, "marriage");
    }
  });

  lines.push("0 TRLR");
  return `${lines.join("\n")}\n`;
}

export function parseGedcom(text: string): ParseResult {
  const parsed = parseRecords(text);
  if ("error" in parsed) return fail(parsed.error);

  const individuals = parsed.records.filter((record) => record.tag === "INDI" && record.xref);
  const families = parsed.records.filter((record) => record.tag === "FAM" && record.xref);
  const people = new Map<string, string>();
  const built: Person[] = [];

  for (const individual of individuals) {
    const xref = individual.xref as string;
    if (people.has(xref)) return fail("That file repeats a person.");
    const id = crypto.randomUUID();
    people.set(xref, id);
    const name = splitName(textOf(findChild(individual, "NAME")));
    const birth = readEvent(individual, "BIRT");
    const death = readEvent(individual, "DEAT");
    const nameSources = sourcesOn(findChild(individual, "NAME"), "name");
    if (!nameSources.ok) return nameSources;
    if (!birth.sources.ok) return birth.sources;
    if (!death.sources.ok) return death.sources;
    const markedAlive = findChild(individual, "_LIV")?.value.trim().toUpperCase() === "Y";
    const person: Person = {
      id,
      givenName: name.given,
      familyName: name.family,
    };
    if (birth.date) person.birthDate = birth.date;
    if (birth.place) person.birthPlace = birth.place.slice(0, 160);
    if (death.date) person.deathDate = death.date;
    if (death.place) person.deathPlace = death.place.slice(0, 160);
    const sources = [...nameSources.sources, ...birth.sources.sources, ...death.sources.sources];
    if (sources.length > 0) person.sources = sources;
    const note = textOf(findChild(individual, "NOTE")).trim().slice(0, 2000);
    if (note) person.note = note;
    const sex = textOf(findChild(individual, "SEX")).trim().toUpperCase();
    if (sex === "M") person.gender = "male";
    else if (sex === "F") person.gender = "female";
    else if (sex === "X") person.gender = "other";
    if (death.present || (markedAlive && death.date)) person.living = false;
    else if (markedAlive) person.living = true;
    built.push(person);
  }

  const partnerships = [];
  for (const family of families) {
    const partners = [...pointers(family, "HUSB"), ...pointers(family, "WIFE")];
    if (partners.length > 2) return fail("A family has more than two partners.");
    const partnerIds = partners.map((pointer) => people.get(pointer));
    if (partnerIds.some((id) => !id)) return fail("That file links to someone who is missing.");
    const childIds = pointers(family, "CHIL").map((pointer) => people.get(pointer));
    if (childIds.some((id) => !id)) return fail("That file links to someone who is missing.");
    if (partnerIds.length === 0) continue;
    const marriage = readEvent(family, "MARR");
    const partnership: Partnership = {
      id: crypto.randomUUID(),
      partnerIds: partnerIds as string[],
      childIds: childIds as string[],
    };
    if (marriage.date) partnership.marriageDate = marriage.date;
    if (marriage.place) partnership.marriagePlace = marriage.place.slice(0, 160);
    if (!marriage.sources.ok) return marriage.sources;
    if (marriage.sources.sources.length > 0) {
      if (partnership.partnerIds.length < 2) return fail("A marriage source in that file needs both partners.");
      partnership.sources = marriage.sources.sources;
    }
    partnerships.push(partnership);
  }

  return parseTreeDocument({
    version: 1,
    people: built,
    partnerships,
    focusId: built[0]?.id ?? null,
  });
}

export function downloadGedcom(document: TreeDocument, title: string): void {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const blob = new Blob([exportGedcom(document)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = `${slug || "family-tree"}.ged`;
  link.click();
  URL.revokeObjectURL(url);
}

function familyId(document: TreeDocument, partnershipId: string): string {
  const index = document.partnerships.findIndex((partnership) => partnership.id === partnershipId);
  return `@F${index + 1}@`;
}

function writeEvent(
  lines: string[],
  tag: string,
  date: string | undefined,
  place: string | undefined,
  sources: FactSource[] | undefined,
  fact: FactSource["fact"],
): void {
  const cited = (sources ?? []).filter((source) => source.fact === fact);
  if (!date && !place && cited.length === 0) return;
  lines.push(`1 ${tag}`);
  if (date) lines.push(`2 DATE ${gedcomDate(date)}`);
  if (place?.trim()) writeValue(lines, 2, "PLAC", place.trim());
  writeFactSources(lines, 2, cited, fact);
}

function writeFactSources(
  lines: string[],
  level: number,
  sources: FactSource[] | undefined,
  fact: FactSource["fact"],
): void {
  for (const source of sources ?? []) {
    if (source.fact !== fact) continue;
    lines.push(`${level} _SRC ${source.kind}`);
    writeValue(lines, level + 1, "NOTE", source.detail);
  }
}

function writeValue(lines: string[], level: number, tag: string, value: string): void {
  const parts = value.split(/\r?\n/);
  parts.forEach((part, index) => {
    writeChunks(lines, index === 0 ? level : level + 1, index === 0 ? tag : "CONT", part);
  });
}

function writeChunks(lines: string[], level: number, tag: string, value: string): void {
  const escaped = value.replaceAll("@", "@@");
  const prefix = `${level} ${tag} `;
  const room = Math.max(1, 255 - prefix.length);
  lines.push(prefix + escaped.slice(0, room));
  let rest = escaped.slice(room);
  while (rest.length > 0) {
    const continued = `${level + 1} CONC `;
    const nextRoom = Math.max(1, 255 - continued.length);
    lines.push(continued + rest.slice(0, nextRoom));
    rest = rest.slice(nextRoom);
  }
}

function gedcomDate(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return iso;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

function parseRecords(text: string): { records: GedNode[] } | { error: string } {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((row) => row.trim() !== "");
  if (rows.length === 0) return { error: "That file is not a GEDCOM file." };
  const records: GedNode[] = [];
  const stack: { level: number; node: GedNode }[] = [{ level: -1, node: { tag: "ROOT", value: "", children: records } }];
  for (const row of rows) {
    const parsed = parseLine(row);
    if (!parsed) return { error: "That file is not a GEDCOM file." };
    while (stack[stack.length - 1].level >= parsed.level) stack.pop();
    if (parsed.level !== stack[stack.length - 1].level + 1) return { error: "That file is not a GEDCOM file." };
    const node: GedNode = { tag: parsed.tag, value: parsed.value, xref: parsed.xref, children: [] };
    stack[stack.length - 1].node.children.push(node);
    stack.push({ level: parsed.level, node });
  }
  const recognizable = records.some((record) => record.tag === "HEAD" || record.tag === "INDI" || record.tag === "TRLR");
  if (!recognizable) return { error: "That file is not a GEDCOM file." };
  return { records };
}

function parseLine(row: string): { level: number; xref?: string; tag: string; value: string } | null {
  const match = row.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Za-z0-9_]+)(?:\s(.*))?$/);
  if (!match) return null;
  return { level: Number(match[1]), xref: match[2], tag: match[3].toUpperCase(), value: match[4] ?? "" };
}

function findChild(node: GedNode, tag: string): GedNode | undefined {
  return node.children.find((child) => child.tag === tag);
}

function pointers(node: GedNode, tag: string): string[] {
  return node.children.filter((child) => child.tag === tag && child.value.trim()).map((child) => child.value.trim());
}

function textOf(node: GedNode | undefined): string {
  if (!node) return "";
  let value = node.value.replaceAll("@@", "@");
  for (const child of node.children) {
    if (child.tag === "CONC") value += textOf(child);
    else if (child.tag === "CONT") value += `\n${textOf(child)}`;
  }
  return value;
}

function splitName(value: string): { given: string; family: string } {
  const match = value.match(/^([\s\S]*?)\/([\s\S]*?)\/([\s\S]*)$/);
  if (!match) return { given: value.trim(), family: "" };
  return {
    given: `${match[1]} ${match[3]}`.trim().replace(/\s+/g, " "),
    family: match[2].trim(),
  };
}

function readEvent(
  individual: GedNode,
  tag: string,
): { present: boolean; date?: string; place?: string; sources: ReturnType<typeof sourcesOn> } {
  const event = findChild(individual, tag);
  if (!event) return { present: false, sources: { ok: true, sources: [] } };
  const date = isoDate(textOf(findChild(event, "DATE")).trim());
  const place = textOf(findChild(event, "PLAC")).trim();
  const fact = tag === "BIRT" ? "birth" : tag === "DEAT" ? "death" : "marriage";
  return { present: true, date, place: place || undefined, sources: sourcesOn(event, fact) };
}

function sourcesOn(
  node: GedNode | undefined,
  fact: FactSource["fact"],
): { ok: true; sources: FactSource[] } | { ok: false; error: string } {
  if (!node) return { ok: true, sources: [] };
  const sources: FactSource[] = [];
  for (const child of node.children) {
    if (child.tag !== "_SRC") continue;
    const kind = child.value.trim();
    if (!isSourceKind(kind)) return { ok: false, error: "A source in that file is unreadable." };
    const detail = textOf(findChild(child, "NOTE")).trim();
    if (!detail) return { ok: false, error: "A source in that file is unreadable." };
    sources.push({ id: crypto.randomUUID(), fact, kind, detail });
  }
  return { ok: true, sources };
}

function isSourceKind(value: string): value is SourceKind {
  return value === "person" || value === "certificate" || value === "note";
}

function isoDate(value: string): string | undefined {
  const match = value.match(/^(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})$/i);
  if (!match) return undefined;
  const month = MONTHS.indexOf(match[2].toUpperCase() as (typeof MONTHS)[number]) + 1;
  const day = Number(match[1]);
  if (month < 1 || day < 1 || day > 31) return undefined;
  return `${match[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fail(error: string): ParseResult {
  return { ok: false, error };
}
