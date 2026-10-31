"use client";

import { useEffect, useRef, useState } from "react";
import { EditorPanel } from "@/components/EditorPanel";
import { Toolbar } from "@/components/Toolbar";
import { TreeCanvas, type TreeCanvasHandle } from "@/components/TreeCanvas";
import { parseTreeDocument, downloadTree } from "@/model/io";
import {
  activeTree,
  addTree,
  deleteActiveTree,
  renameActive,
  replaceActive,
  selectTree,
} from "@/model/library";
import { downloadTreeImage, downloadTreePdf } from "@/model/picture";
import { sharedTree } from "@/model/share";
import { loadLibrary, saveLibrary } from "@/model/storage";
import {
  addChild,
  addFirstPerson,
  addParent,
  addPartner,
  deletePerson,
  displayName,
  setFocus,
  updatePerson,
} from "@/model/tree";
import type { RelativeSource, TreeDocument, TreeLibrary, TreeResult } from "@/model/types";

export function TreeApp() {
  const [library, setLibrary] = useState<TreeLibrary | null>(null);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const canvasRef = useRef<TreeCanvasHandle>(null);

  useEffect(() => {
    setLibrary(loadLibrary());
  }, []);

  useEffect(() => {
    if (!library) return;
    saveLibrary(library);
  }, [library]);

  if (!library) {
    return <main className="app loading">Loading family tree…</main>;
  }

  const shelf = library;
  const current = activeTree(shelf);
  const document = current.document;
  const hasPeople = document.people.length > 0;
  const shown = sharing ? sharedTree(document) : document;

  function updateDocument(next: TreeDocument) {
    setLibrary(replaceActive(shelf, next));
  }

  function apply(result: TreeResult): boolean {
    if (!result.ok) {
      setMessage(result.error);
      return false;
    }
    setMessage(null);
    updateDocument(result.document);
    return true;
  }

  function onStart(event: React.FormEvent) {
    event.preventDefault();
    if (apply(addFirstPerson(document, givenName, familyName))) {
      setGivenName("");
      setFamilyName("");
    }
  }

  function onNew() {
    setMessage(null);
    setGivenName("");
    setFamilyName("");
    setSharing(false);
    setLibrary(addTree(shelf));
  }

  function onDeleteTree() {
    const title = current.title.trim() || "Untitled";
    const only = shelf.trees.length === 1;
    if (!hasPeople) {
      if (only) return;
      setSharing(false);
      setLibrary(deleteActiveTree(shelf));
      return;
    }
    const question = only
      ? `Clear ${title}? The people in it will be removed from this browser.`
      : `Delete ${title}? It will be removed from this browser.`;
    if (!window.confirm(question)) return;
    setMessage(null);
    setGivenName("");
    setFamilyName("");
    setSharing(false);
    setLibrary(deleteActiveTree(shelf));
  }

  async function onImport(file: File) {
    let parsed: ReturnType<typeof parseTreeDocument>;
    try {
      parsed = parseTreeDocument(JSON.parse(await file.text()));
    } catch {
      setMessage("That file is not valid JSON.");
      return;
    }
    if (!parsed.ok) {
      setMessage(parsed.error);
      return;
    }
    if (hasPeople && !window.confirm("Replace the current tree with this file?")) return;
    setMessage(null);
    setSharing(false);
    updateDocument(parsed.document);
  }

  function onDelete(personId: string) {
    const person = document.people.find((item) => item.id === personId);
    if (!person) return;
    if (!window.confirm(`Remove ${displayName(person)} from the tree? Their relationships will be detached.`)) {
      return;
    }
    const next = deletePerson(document, personId);
    if (next.people.length === 0) setSharing(false);
    setMessage(null);
    updateDocument(next);
  }

  function addRelative(source: RelativeSource, run: (source: RelativeSource) => TreeResult): boolean {
    return apply(run(source));
  }

  return (
    <main className={hasPeople ? "app" : "app is-empty"}>
      <Toolbar
        trees={shelf.trees}
        activeId={current.id}
        title={current.title}
        message={message}
        canExport={hasPeople}
        canDelete={shelf.trees.length > 1 || hasPeople}
        sharing={sharing}
        onSelectTree={(id) => {
          setSharing(false);
          setMessage(null);
          setGivenName("");
          setFamilyName("");
          setLibrary(selectTree(shelf, id));
        }}
        onRenameTree={(title) => setLibrary(renameActive(shelf, title))}
        onNew={onNew}
        onDeleteTree={onDeleteTree}
        onImport={onImport}
        onExport={() => downloadTree(document)}
        onExportImage={() => {
          void downloadTreeImage(shown, current.title).then(
            () => setMessage(null),
            () => setMessage("The picture could not be created."),
          );
        }}
        onExportPdf={() => {
          void downloadTreePdf(shown, current.title).then(
            () => setMessage(null),
            () => setMessage("The PDF could not be created."),
          );
        }}
        onShare={() => downloadTree(sharedTree(document), "family-tree-shared.json")}
        onToggleShare={() => setSharing((value) => !value)}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onFit={() => canvasRef.current?.fit()}
      />
      {hasPeople ? (
        <EditorPanel
          document={document}
          sharing={sharing}
          onFocus={(personId) => updateDocument(setFocus(document, personId))}
          onUpdate={(personId, patch) => updateDocument(updatePerson(document, personId, patch))}
          onAddParent={(source) => addRelative(source, (item) => addParent(document, document.focusId as string, item))}
          onAddPartner={(source) =>
            addRelative(source, (item) => addPartner(document, document.focusId as string, item))
          }
          onAddChild={(source, partnershipId) =>
            apply(addChild(document, document.focusId as string, source, partnershipId))
          }
          onDelete={onDelete}
        />
      ) : null}
      {hasPeople ? (
        <TreeCanvas
          ref={canvasRef}
          document={shown}
          onFocus={(personId) => updateDocument(setFocus(document, personId))}
        />
      ) : (
        <section className="empty-state">
          <form onSubmit={onStart}>
            <p className="eyebrow">A private tree in this browser</p>
            <h2>Start a family tree</h2>
            <p className="lede">
              Add one person, then attach parents, a partner, and children. Click anyone to follow the tree backward
              or forward. Export keeps every detail. Share leaves out living people&apos;s private details.
            </p>
            <label className="field">
              Given name
              <input
                value={givenName}
                onChange={(event) => setGivenName(event.target.value)}
                autoComplete="off"
                autoFocus
                required
              />
            </label>
            <label className="field">
              Family name
              <input
                value={familyName}
                onChange={(event) => setFamilyName(event.target.value)}
                autoComplete="off"
              />
            </label>
            <button type="submit" className="primary">
              Start with this person
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
