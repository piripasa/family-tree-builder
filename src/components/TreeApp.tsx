"use client";

import { useEffect, useRef, useState } from "react";
import { EditorPanel } from "@/components/EditorPanel";
import { Toolbar } from "@/components/Toolbar";
import { TreeCanvas, type TreeCanvasHandle } from "@/components/TreeCanvas";
import { parseTreeDocument, downloadTree } from "@/model/io";
import { loadTree, saveTree } from "@/model/storage";
import {
  addChild,
  addFirstPerson,
  addParent,
  addPartner,
  createEmptyDocument,
  deletePerson,
  displayName,
  setFocus,
  updatePerson,
} from "@/model/tree";
import type { RelativeSource, TreeDocument, TreeResult } from "@/model/types";

export function TreeApp() {
  const [document, setDocument] = useState<TreeDocument | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const canvasRef = useRef<TreeCanvasHandle>(null);

  useEffect(() => {
    setDocument(loadTree() ?? createEmptyDocument());
  }, []);

  useEffect(() => {
    if (!document) return;
    saveTree(document);
  }, [document]);

  if (!document) {
    return <main className="app loading">Loading family tree…</main>;
  }

  const hasPeople = document.people.length > 0;

  function apply(result: TreeResult): boolean {
    if (!result.ok) {
      setMessage(result.error);
      return false;
    }
    setMessage(null);
    setDocument(result.document);
    return true;
  }

  function onStart(event: React.FormEvent) {
    event.preventDefault();
    if (!document) return;
    if (apply(addFirstPerson(document, givenName, familyName))) {
      setGivenName("");
      setFamilyName("");
    }
  }

  function onNew() {
    if (!document) return;
    if (
      document.people.length > 0 &&
      !window.confirm("Start a new tree? The current tree will be cleared from this browser.")
    ) {
      return;
    }
    setMessage(null);
    setGivenName("");
    setFamilyName("");
    setDocument(createEmptyDocument());
  }

  async function onImport(file: File) {
    if (!document) return;
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
    if (
      document.people.length > 0 &&
      !window.confirm("Replace the current tree with this file?")
    ) {
      return;
    }
    setMessage(null);
    setDocument(parsed.document);
  }

  function onDelete(personId: string) {
    if (!document) return;
    const person = document.people.find((item) => item.id === personId);
    if (!person) return;
    if (!window.confirm(`Remove ${displayName(person)} from the tree? Their relationships will be detached.`)) {
      return;
    }
    setMessage(null);
    setDocument(deletePerson(document, personId));
  }

  function addRelative(
    source: RelativeSource,
    run: (source: RelativeSource) => TreeResult,
  ): boolean {
    if (!document) return false;
    return apply(run(source));
  }

  return (
    <main className={hasPeople ? "app" : "app is-empty"}>
      <Toolbar
        message={message}
        canExport={hasPeople}
        onNew={onNew}
        onImport={onImport}
        onExport={() => downloadTree(document)}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onFit={() => canvasRef.current?.fit()}
      />
      {hasPeople ? (
        <EditorPanel
          document={document}
          onFocus={(personId) => setDocument(setFocus(document, personId))}
          onRename={(personId, nextGiven, nextFamily) =>
            setDocument(updatePerson(document, personId, nextGiven, nextFamily))
          }
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
        <TreeCanvas ref={canvasRef} document={document} onFocus={(personId) => setDocument(setFocus(document, personId))} />
      ) : (
        <section className="empty-state">
          <form onSubmit={onStart}>
            <p className="eyebrow">A private tree in this browser</p>
            <h2>Start a family tree</h2>
            <p className="lede">
              Add one person, then attach parents, a partner, and children. Click anyone to follow the tree backward
              or forward. Export a file when you want to share it.
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
