import { afterEach, describe, expect, it, vi } from "vitest";
import { loadLibrary, saveLibrary } from "./storage";
import type { TreeDocument } from "./types";

const document: TreeDocument = {
  version: 1,
  people: [{ id: "ada", givenName: "Ada", familyName: "Lovelace" }],
  partnerships: [],
  focusId: "ada",
};

function memoryStorage() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  vi.stubGlobal("localStorage", storage);
  return storage;
}

describe("storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts an empty library when nothing is stored", () => {
    memoryStorage();
    const library = loadLibrary();
    expect(library.trees).toHaveLength(1);
    expect(library.trees[0].document.people).toEqual([]);
  });

  it("saves a library and loads it back", () => {
    memoryStorage();
    const library = loadLibrary();
    const titled = { ...library, trees: [{ ...library.trees[0], title: "Lovelace", document }] };
    saveLibrary(titled);
    expect(loadLibrary().trees[0]).toMatchObject({ title: "Lovelace", document });
  });

  it("migrates a single saved tree into a library", () => {
    const storage = memoryStorage();
    storage.setItem("family-tree-builder:v1", JSON.stringify(document));
    const library = loadLibrary();
    expect(library.trees).toHaveLength(1);
    expect(library.trees[0].document).toEqual(document);
  });

  it("skips a broken tree and falls back when the active id is missing", () => {
    const storage = memoryStorage();
    storage.setItem(
      "family-tree-builder:v1",
      JSON.stringify({
        version: 1,
        activeId: "gone",
        trees: [
          { id: "bad", title: "Broken", document: { version: 2 } },
          { title: "Untitled" },
          { id: "ok", title: "x".repeat(100), document },
        ],
      }),
    );
    const library = loadLibrary();
    expect(library.trees).toHaveLength(1);
    expect(library.activeId).toBe("ok");
    expect(library.trees[0].title).toHaveLength(80);
  });

  it("uses a default title and an empty library when the saved value cannot be read", () => {
    const storage = memoryStorage();
    storage.setItem(
      "family-tree-builder:v1",
      JSON.stringify({
        version: 1,
        activeId: "ok",
        trees: [{ id: "ok", title: 4, document }],
      }),
    );
    expect(loadLibrary().trees[0].title).toBe("Family tree");

    storage.setItem("family-tree-builder:v1", "{");
    expect(loadLibrary().trees[0].document.people).toEqual([]);
    storage.setItem("family-tree-builder:v1", JSON.stringify({ version: 1, activeId: "x", trees: [] }));
    expect(loadLibrary().trees[0].document.people).toEqual([]);
  });

  it("keeps working when the browser refuses the write or has no storage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(saveLibrary(loadLibrary())).toBe(false);

    vi.unstubAllGlobals();
    expect(loadLibrary().version).toBe(1);
    expect(saveLibrary(loadLibrary())).toBe(true);
  });
});
