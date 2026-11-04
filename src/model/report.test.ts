import { describe, expect, it, vi } from "vitest";
import { buildReportPdf, downloadReportPdf, reportDocument } from "./report";
import type { TreeDocument } from "./types";

const family: TreeDocument = {
  version: 1,
  focusId: "ada",
  people: [
    {
      id: "ada",
      givenName: "Ada",
      familyName: "Lovelace",
      birthDate: "1815-12-10",
      birthPlace: "London",
      deathDate: "1852-11-27",
      deathPlace: "Marylebone",
      note: "Kept (the) stories",
      email: "ada@example.com",
      phone: "+44 20",
      socials: [{ network: "website", url: "https://ada.example" }],
    },
    { id: "ann", givenName: "Ann", familyName: "King", birthDate: "1788-01-01", living: true },
    { id: "byron", givenName: "George", familyName: "Byron", deathDate: "1824-04-19" },
    { id: "john", givenName: "John", familyName: "Byron" },
    { id: "noel", givenName: "Noel", familyName: "Byron" },
    { id: "richard", givenName: "Richard", familyName: "Byron" },
    { id: "william", givenName: "William", familyName: "King" },
    { id: "anne", givenName: "Anne", familyName: "Blunt" },
    { id: "ralph", givenName: "Ralph", familyName: "Blunt" },
    { id: "judith", givenName: "Judith", familyName: "Blunt" },
  ],
  partnerships: [
    {
      id: "parents",
      partnerIds: ["ann", "byron"],
      childIds: ["ada"],
      marriageDate: "1815-01-02",
      marriagePlace: "Kirkby",
    },
    { id: "johns", partnerIds: ["john"], childIds: ["byron"] },
    { id: "noels", partnerIds: ["noel"], childIds: ["john"] },
    { id: "richards", partnerIds: ["richard"], childIds: ["noel"] },
    { id: "marriage", partnerIds: ["ada", "william"], childIds: ["anne", "ralph"], marriageDate: "1835-07-08" },
    { id: "next", partnerIds: ["anne", "ralph"], childIds: ["judith"] },
  ],
};

describe("written report", () => {
  it("writes the focus person, then ancestors and descendants by generation", () => {
    const text = reportDocument(family, " Lovelace side ");
    expect(text.startsWith("Lovelace side\nAncestors and descendants of Ada Lovelace\nAda Lovelace\n")).toBe(true);
    expect(text).toContain("Born 1815-12-10 in London");
    expect(text).toContain("Died 1852-11-27 in Marylebone");
    expect(text).toContain("Email: ada@example.com");
    expect(text).toContain("Phone: +44 20");
    expect(text).toContain("Website: https://ada.example");
    expect(text).toContain("Note: Kept (the) stories");
    expect(text).toContain("With William King. Married 1835-07-08.");
    expect(text).toContain("Parents: Ann King and George Byron.");
    expect(text).toContain("Children: Anne Blunt and Ralph Blunt.");
    expect(text).toContain("With Ann King. Married 1815-01-02 in Kirkby.");
    expect(section(text, "Ancestors")).toContain("Parents\nAnn King\nBorn 1788-01-01\nLiving.");
    expect(section(text, "Ancestors")).toContain("George Byron\nDied 1824-04-19");
    expect(section(text, "Ancestors")).toContain("Grandparents\nJohn Byron");
    expect(section(text, "Ancestors")).toContain("Great-grandparents\nNoel Byron");
    expect(section(text, "Ancestors")).toContain("2nd great-grandparents\nRichard Byron");
    const descendants = section(text, "Descendants");
    expect(descendants).toContain("Children\nAnne Blunt");
    expect(descendants).toContain("Ralph Blunt");
    expect(descendants).toContain("Grandchildren\nJudith Blunt");
    expect(descendants.split("Judith Blunt").length - 1).toBe(1);
    expect(text).not.toContain("Descendants\n\nGreat-");
  });

  it("omits empty ancestor and descendant sections", () => {
    const text = reportDocument(
      {
        version: 1,
        focusId: "ada",
        people: [{ id: "ada", givenName: "Ada", familyName: "Lovelace" }],
        partnerships: [],
      },
      "",
    );
    expect(text.startsWith("Family tree\nAncestors and descendants of Ada Lovelace")).toBe(true);
    expect(text).not.toContain("\nAncestors\n");
    expect(text).not.toContain("\nDescendants\n");
    expect(() => reportDocument({ version: 1, focusId: null, people: [], partnerships: [] }, "Family tree")).toThrow(
      "There is nobody to report.",
    );
  });

  it("builds a multi-page PDF and keeps Latin letters", () => {
    const note = "Story ".repeat(400).trim();
    const people = ["José", "Martín", "Lucía"].map((givenName, index) => ({
      id: `p${index}`,
      givenName,
      familyName: "Martín",
      note,
    }));
    const pdf = buildReportPdf(
      {
        version: 1,
        focusId: "p0",
        people,
        partnerships: [
          { id: "a", partnerIds: ["p1"], childIds: ["p0"] },
          { id: "b", partnerIds: ["p0"], childIds: ["p2"] },
        ],
      },
      "Café",
    );
    const latin = new TextDecoder("latin1").decode(pdf);
    expect(latin.startsWith("%PDF-1.4")).toBe(true);
    expect(latin).toContain("/Count 3");
    expect(latin).toContain("Jos\u00e9");
    expect(latin).toContain("Mart\u00edn");
    expect(latin).toContain("Luc\u00eda");
    expect(latin).toContain("Caf\u00e9");
    expect(latin).toContain("1 / 3");
    expect(latin).toContain("3 / 3");
    const familyPdf = new TextDecoder("latin1").decode(buildReportPdf(family, "Lovelace"));
    expect(familyPdf).toContain("Kept \\(the\\) stories");
  });

  it("downloads the report under its own file name", () => {
    const downloads: string[] = [];
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:report",
      revokeObjectURL: () => undefined,
    });
    vi.stubGlobal("window", {
      document: {
        createElement: () => ({
          href: "",
          download: "",
          click(this: { download: string }) {
            downloads.push(this.download);
          },
        }),
      },
    });
    downloadReportPdf(family, "Ada & Ann");
    downloadReportPdf(family, "!!!");
    expect(downloads).toEqual(["ada-ann-report.pdf", "family-tree-report.pdf"]);
    vi.unstubAllGlobals();
  });
});

function section(text: string, heading: string): string {
  const start = text.indexOf(`\n${heading}\n`);
  if (start < 0) throw new Error(`Missing ${heading}`);
  const rest = text.slice(start + heading.length + 2);
  const end = heading === "Ancestors" ? rest.indexOf("\nDescendants\n") : -1;
  return end < 0 ? rest : rest.slice(0, end);
}
