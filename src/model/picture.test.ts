import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadTreeImage, downloadTreePdf } from "./picture";
import { addFirstPerson, addParent } from "./tree";
import type { TreeDocument } from "./types";

const downloads: string[] = [];
const blobs: Blob[] = [];

function canvas() {
  return {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage() {},
      fillRect() {},
      save() {},
      restore() {},
      beginPath() {},
      arc() {},
      clip() {},
      fillStyle: "",
    }),
    toBlob(callback: (blob: Blob | null) => void, type: string) {
      const bytes = type === "image/jpeg" ? new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) : new Uint8Array([137, 80, 78, 71]);
      callback(new Blob([bytes], { type }));
    },
  };
}

function installBrowser() {
  downloads.length = 0;
  blobs.length = 0;
  vi.stubGlobal(
    "Image",
    class {
      width = 8;
      height = 8;
      onload: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  vi.stubGlobal("URL", {
    createObjectURL: (blob: Blob) => {
      blobs.push(blob);
      return "blob:picture";
    },
    revokeObjectURL: () => undefined,
  });
  vi.stubGlobal("window", {
    document: {
      createElement: (tag: string) => {
        if (tag === "a") {
          return {
            href: "",
            download: "",
            click(this: { download: string }) {
              downloads.push(this.download);
            },
          };
        }
        return canvas();
      },
    },
  });
}

describe("picture export", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("downloads a PNG and a one-page PDF of the focused tree", async () => {
    installBrowser();
    const started = addFirstPerson(
      { version: 1, people: [], partnerships: [], focusId: null },
      "Ada",
      "Lovelace",
    );
    if (!started.ok) throw new Error(started.error);
    const withParent = addParent(started.document, started.personId, {
      type: "new",
      givenName: "Ann",
      familyName: "King",
    });
    if (!withParent.ok) throw new Error(withParent.error);
    const tree: TreeDocument = updatePhoto(withParent.document);
    await downloadTreeImage(tree, "Lovelace side");
    await downloadTreePdf(tree, "Lovelace side");
    expect(downloads).toEqual(["lovelace-side.png", "lovelace-side.pdf"]);
    expect(blobs.map((blob) => blob.type)).toContain("image/png");
    expect(blobs.map((blob) => blob.type)).toContain("application/pdf");
    const pdf = blobs.find((blob) => blob.type === "application/pdf");
    const text = new TextDecoder().decode(new Uint8Array(await pdf!.arrayBuffer()));
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Count 1");
    expect(text).toContain("Lovelace side");
  });

  it("escapes a title and uses a plain name when the title is blank", async () => {
    installBrowser();
    const started = addFirstPerson(
      { version: 1, people: [], partnerships: [], focusId: null },
      "A&B <C> \"D\" and a very long given name",
      "Lovelace",
    );
    if (!started.ok) throw new Error(started.error);
    await downloadTreePdf(started.document, "Ada & Ann (1) café");
    await downloadTreeImage(started.document, "!!!");
    expect(downloads).toEqual(["ada-ann-1-caf.pdf", "family-tree.png"]);
    const pdf = blobs.find((blob) => blob.type === "application/pdf");
    const text = new TextDecoder().decode(new Uint8Array(await pdf!.arrayBuffer()));
    expect(text).toContain("Ada & Ann \\(1\\)");
  });

  it("puts the logo in the header and a faint watermark on the PDF", async () => {
    installBrowser();
    vi.stubGlobal("window", {
      document: {
        createElement: (tag: string) => {
          if (tag === "a") {
            return {
              href: "",
              download: "",
              click(this: { download: string }) {
                downloads.push(this.download);
              },
            };
          }
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              drawImage() {},
              fillRect() {},
              clearRect() {},
              save() {},
              restore() {},
              beginPath() {},
              arc() {},
              clip() {},
              fillStyle: "",
              getImageData: () => ({ data: new Uint8ClampedArray(240 * 240 * 4).fill(255) }),
            }),
            toBlob(callback: (blob: Blob | null) => void, type: string) {
              const bytes = type === "image/jpeg" ? new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) : new Uint8Array([137, 80, 78, 71]);
              callback(new Blob([bytes], { type }));
            },
          };
        },
      },
    });
    const started = addFirstPerson(
      { version: 1, people: [], partnerships: [], focusId: null },
      "Ada",
      "Lovelace",
    );
    if (!started.ok) throw new Error(started.error);
    await downloadTreePdf(started.document, "Lovelace side");
    const pdf = blobs.find((blob) => blob.type === "application/pdf");
    const text = new TextDecoder().decode(new Uint8Array(await pdf!.arrayBuffer()));
    expect(text).toContain("/SMask 5 0 R");
    expect(text).toContain("/ca 0.14");
    expect(text).toContain("/Logo Do");
    expect(text).toContain("/GS1 gs");
    expect(text).toContain("Lovelace side");
  });

  it("reports a canvas that cannot encode the picture", async () => {
    installBrowser();
    vi.stubGlobal("window", {
      document: {
        createElement: () => ({
          width: 0,
          height: 0,
          getContext: () => ({
            drawImage() {},
            fillRect() {},
            save() {},
            restore() {},
            beginPath() {},
            arc() {},
            clip() {},
          }),
          toBlob(callback: (blob: Blob | null) => void) {
            callback(null);
          },
        }),
      },
    });
    const started = addFirstPerson({ version: 1, people: [], partnerships: [], focusId: null }, "Ada", "Lovelace");
    if (!started.ok) throw new Error(started.error);
    await expect(downloadTreeImage(started.document, "Ada")).rejects.toThrow("The picture could not be created.");
  });

  it("reports a canvas that cannot be drawn on", async () => {
    installBrowser();
    vi.stubGlobal("window", {
      document: {
        createElement: () => ({
          width: 0,
          height: 0,
          getContext: () => null,
          toBlob(callback: (blob: Blob | null) => void) {
            callback(null);
          },
        }),
      },
    });
    const started = addFirstPerson({ version: 1, people: [], partnerships: [], focusId: null }, "Ada", "Lovelace");
    if (!started.ok) throw new Error(started.error);
    await expect(downloadTreeImage(started.document, "Ada")).rejects.toThrow("The picture could not be created.");
  });

  it("refuses to draw a tree with nobody in focus", async () => {
    installBrowser();
    const empty: TreeDocument = { version: 1, people: [], partnerships: [], focusId: null };
    await expect(downloadTreeImage(empty, "Family tree")).rejects.toThrow("The picture could not be created.");
    await expect(downloadTreePdf(empty, "Family tree")).rejects.toThrow("The picture could not be created.");
  });
});

function updatePhoto(tree: TreeDocument): TreeDocument {
  return {
    ...tree,
    people: tree.people.map((person) => ({ ...person, photo: "data:image/jpeg;base64,abc" })),
  };
}
