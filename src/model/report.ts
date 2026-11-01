import {
  childrenOf,
  displayName,
  getPerson,
  isAlive,
  parentsOf,
  partnershipsAsPartner,
} from "./tree";
import type { Person, TreeDocument } from "./types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;

type Role = "title" | "subtitle" | "section" | "name" | "body";

type Row = {
  role: Role;
  text: string;
};

export function reportDocument(document: TreeDocument, title: string): string {
  return reportRows(document, title)
    .map((row) => row.text)
    .join("\n");
}

export function buildReportPdf(document: TreeDocument, title: string): Uint8Array {
  const pages = layoutPages(reportRows(document, title));
  const label = title.trim() || "Family tree";
  const objects: PdfObject[] = [
    { head: "<< /Type /Catalog /Pages 2 0 R >>" },
    {
      head: `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    },
    { head: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>" },
  ];
  pages.forEach((page, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    const stream = pageStream(page, `${label}  ·  ${index + 1} / ${pages.length}`);
    objects[pageId - 1] = {
      head: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
    };
    objects[contentId - 1] = { head: `<< /Length ${stream.length} >>`, stream };
  });
  return encodePdf(objects);
}

export function downloadReportPdf(document: TreeDocument, title: string): void {
  const pdf = buildReportPdf(document, title);
  const bytes = new ArrayBuffer(pdf.byteLength);
  new Uint8Array(bytes).set(pdf);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = `${fileSlug(title)}-report.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

function reportRows(document: TreeDocument, title: string): Row[] {
  const focus = (document.focusId && getPerson(document, document.focusId)) || document.people[0];
  if (!focus) throw new Error("There is nobody to report.");
  const rows: Row[] = [
    { role: "title", text: title.trim() || "Family tree" },
    { role: "subtitle", text: `Ancestors and descendants of ${displayName(focus)}` },
  ];
  pushPerson(rows, document, focus, true);
  pushGenerations(rows, document, focus.id, "up");
  pushGenerations(rows, document, focus.id, "down");
  return rows;
}

function pushGenerations(rows: Row[], document: TreeDocument, startId: string, direction: "up" | "down"): void {
  const generations = relativeGenerations(document, startId, direction);
  if (generations.length === 0) return;
  rows.push({ role: "section", text: direction === "up" ? "Ancestors" : "Descendants" });
  generations.forEach((people, index) => {
    rows.push({ role: "section", text: generationLabel(index + 1, direction) });
    for (const person of people) pushPerson(rows, document, person, false);
  });
}

function pushPerson(rows: Row[], document: TreeDocument, person: Person, summary: boolean): void {
  rows.push({ role: "name", text: displayName(person) });
  for (const line of factLines(document, person, summary)) {
    rows.push({ role: "body", text: line });
  }
}

function relativeGenerations(document: TreeDocument, startId: string, direction: "up" | "down"): Person[][] {
  const seen = new Set<string>([startId]);
  let frontier = direction === "up" ? parentsOf(document, startId) : childrenOf(document, startId);
  const generations: Person[][] = [];
  while (frontier.length > 0) {
    const people: Person[] = [];
    for (const person of frontier) {
      if (seen.has(person.id)) continue;
      seen.add(person.id);
      people.push(person);
    }
    if (people.length === 0) break;
    generations.push(people);
    frontier = people.flatMap((person) =>
      direction === "up" ? parentsOf(document, person.id) : childrenOf(document, person.id),
    );
  }
  return generations;
}

function factLines(document: TreeDocument, person: Person, summary: boolean): string[] {
  const lines: string[] = [];
  const born = eventLine("Born", person.birthDate, person.birthPlace);
  if (born) lines.push(born);
  const died = eventLine("Died", person.deathDate, person.deathPlace);
  if (died) lines.push(died);
  if (isAlive(person)) lines.push("Living.");
  if (person.note?.trim()) lines.push(`Note: ${person.note.trim()}`);
  for (const partnership of partnershipsAsPartner(document, person.id)) {
    if (partnership.partnerIds.length < 2) continue;
    const names = partnership.partnerIds
      .filter((id) => id !== person.id)
      .flatMap((id) => {
        const partner = getPerson(document, id);
        return partner ? [displayName(partner)] : [];
      });
    if (names.length === 0) continue;
    const married = eventLine("Married", partnership.marriageDate, partnership.marriagePlace);
    lines.push(married ? `With ${joinNames(names)}. ${married}.` : `With ${joinNames(names)}.`);
  }
  if (!summary) return lines;
  const parents = parentsOf(document, person.id).map(displayName);
  if (parents.length > 0) lines.push(`Parents: ${joinNames(parents)}.`);
  const children = childrenOf(document, person.id).map(displayName);
  if (children.length > 0) lines.push(`Children: ${joinNames(children)}.`);
  return lines;
}

function eventLine(label: string, date: string | undefined, place: string | undefined): string {
  const when = date?.trim();
  const where = place?.trim();
  if (when && where) return `${label} ${when} in ${where}`;
  if (when) return `${label} ${when}`;
  if (where) return `${label} in ${where}`;
  return "";
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function generationLabel(distance: number, direction: "up" | "down"): string {
  if (direction === "up") {
    if (distance === 1) return "Parents";
    if (distance === 2) return "Grandparents";
    return greatLabel(distance, "grandparents");
  }
  if (distance === 1) return "Children";
  if (distance === 2) return "Grandchildren";
  return greatLabel(distance, "grandchildren");
}

function greatLabel(distance: number, word: "grandparents" | "grandchildren"): string {
  const degree = distance - 2;
  if (degree <= 1) return `Great-${word}`;
  return `${ordinal(degree)} great-${word}`;
}

function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = value % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}

type Draw = { text: string; size: number; color: string; x: number; y: number };

function layoutPages(rows: Row[]): Draw[][] {
  const pages: Draw[][] = [[]];
  let y = PAGE_HEIGHT - MARGIN;
  for (const row of rows) {
    if (!row.text) continue;
    const size = fontSize(row.role);
    const color = fontColor(row.role);
    const height = size + 6;
    for (const line of wrap(row.text, size)) {
      if (y - height < MARGIN + 18) {
        pages.push([]);
        y = PAGE_HEIGHT - MARGIN;
      }
      y -= height;
      pages[pages.length - 1].push({ text: line, size, color, x: MARGIN, y });
    }
    y -= row.role === "title" || row.role === "section" ? 6 : 2;
  }
  return pages.filter((page) => page.length > 0);
}

function fontSize(role: Role): number {
  if (role === "title") return 18;
  if (role === "section") return 13;
  if (role === "name" || role === "subtitle") return 12;
  return 11;
}

function fontColor(role: Role): string {
  if (role === "title" || role === "section") return "0.137 0.259 0.216";
  if (role === "name") return "0.118 0.102 0.078";
  return "0.435 0.404 0.361";
}

function wrap(text: string, size: number): string[] {
  const width = Math.max(24, Math.floor(490 / (size * 0.52)));
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const pieces = word.length > width ? chunk(word, width) : [word];
      for (const piece of pieces) {
        const next = current ? `${current} ${piece}` : piece;
        if (current && next.length > width) {
          lines.push(current);
          current = piece;
        } else current = next;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

function chunk(word: string, width: number): string[] {
  const pieces: string[] = [];
  for (let index = 0; index < word.length; index += width) pieces.push(word.slice(index, index + width));
  return pieces;
}

function pageStream(draws: Draw[], footer: string): Uint8Array {
  const parts: Uint8Array[] = [textBytes(`0.953 0.937 0.902 rg\n0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f\n`)];
  for (const draw of draws) {
    parts.push(textBytes(`BT\n/F1 ${draw.size} Tf\n${draw.color} rg\n1 0 0 1 ${draw.x.toFixed(2)} ${draw.y.toFixed(2)} Tm\n`));
    parts.push(literalBytes(draw.text));
    parts.push(textBytes(" Tj\nET\n"));
  }
  parts.push(textBytes("BT\n/F1 9 Tf\n0.137 0.259 0.216 rg\n1 0 0 1 50 28 Tm\n"));
  parts.push(literalBytes(footer));
  parts.push(textBytes(" Tj\nET\n"));
  return concat(parts);
}

type PdfObject = { head: string; stream?: Uint8Array };

function encodePdf(objects: PdfObject[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets = [0];
  let length = 0;
  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    length += bytes.length;
  };
  push(textBytes("%PDF-1.4\n"));
  objects.forEach((object, index) => {
    offsets.push(length);
    const id = index + 1;
    if (!object.stream) {
      push(textBytes(`${id} 0 obj\n${object.head}\nendobj\n`));
      return;
    }
    push(textBytes(`${id} 0 obj\n${object.head}\nstream\n`));
    push(object.stream);
    push(textBytes("\nendstream\nendobj\n"));
  });
  const xref = length;
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    table += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  push(textBytes(table));
  push(textBytes(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));
  return concat(chunks);
}

const WINANSI: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function literalBytes(value: string): Uint8Array {
  const bytes = [0x28];
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0x5c || code === 0x28 || code === 0x29) {
      bytes.push(0x5c, code);
      continue;
    }
    if (code >= 32 && code <= 126) {
      bytes.push(code);
      continue;
    }
    if (code >= 160 && code <= 255) {
      bytes.push(code);
      continue;
    }
    bytes.push(WINANSI[code] ?? 0x3f);
  }
  bytes.push(0x29);
  return Uint8Array.from(bytes);
}

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let cursor = 0;
  for (const part of parts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  return output;
}

function fileSlug(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "family-tree";
}
