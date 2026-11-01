"use client";

import { useEffect, useRef, useState } from "react";
import { EditorPanel } from "@/components/EditorPanel";
import { Toolbar } from "@/components/Toolbar";
import { TreeCanvas, type TreeCanvasHandle } from "@/components/TreeCanvas";
import { applyLibraryChanges, fetchSession, loadAccountLibrary, signIn, signOut, signUp } from "@/model/account";
import { downloadGedcom, parseGedcom } from "@/model/gedcom";
import { downloadTree, parseTreeDocument } from "@/model/io";
import {
  ACCOUNT_TREE_LIMIT,
  LOCAL_TREE_LIMIT,
  activeTree,
  addTree,
  deleteActiveTree,
  renameActive,
  replaceActive,
  selectTree,
} from "@/model/library";
import { downloadTreeImage, downloadTreePdf } from "@/model/picture";
import { sharedTree } from "@/model/share";
import { createShareLink, readShareLink, replaceShareLink, revokeShareLink } from "@/model/shareLink";
import { loadLibrary, saveLibrary } from "@/model/storage";
import { libraryChanges } from "@/model/sync";
import {
  addChild,
  addFirstPerson,
  addParent,
  addPartner,
  deletePerson,
  displayName,
  setFocus,
  updatePerson,
  updatePartnership,
} from "@/model/tree";
import type { RelativeSource, TreeDocument, TreeLibrary, TreeResult } from "@/model/types";

const SAVE_FAILED = "This tree could not be saved in this browser. Export a file so you do not lose it.";
const ACCOUNT_SAVE_FAILED = "This tree could not be saved to your account. Export a file so you do not lose it.";

export function TreeApp() {
  const [library, setLibrary] = useState<TreeLibrary | null>(null);
  const [source, setSource] = useState<"local" | "account" | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<{ url: string; copied: boolean } | null>(null);
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const canvasRef = useRef<TreeCanvasHandle>(null);
  const remoteRef = useRef<TreeLibrary | null>(null);
  const queueRef = useRef(Promise.resolve());
  const shareTicket = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await fetchSession();
        if (cancelled) return;
        if (!session) {
          setSource("local");
          setLibrary(loadLibrary());
          return;
        }
        const remote = await loadAccountLibrary();
        if (cancelled) return;
        remoteRef.current = remote;
        setEmail(session.email);
        setSource("account");
        setLibrary(remote);
      } catch (error) {
        if (cancelled) return;
        setSource("local");
        setLibrary(loadLibrary());
        setMessage(error instanceof Error ? error.message : "Your account could not be loaded. This browser copy is open.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!library || !source) return;
    if (source === "local") {
      const saved = saveLibrary(library);
      setMessage((current) => {
        if (!saved) return SAVE_FAILED;
        return current === SAVE_FAILED ? null : current;
      });
      return;
    }
    const snapshot = library;
    const handle = window.setTimeout(() => {
      queueRef.current = queueRef.current
        .then(async () => {
          const before = remoteRef.current;
          if (!before) return;
          const changes = libraryChanges(before, snapshot);
          if (changes.length === 0) return;
          await applyLibraryChanges(changes);
          remoteRef.current = snapshot;
          setMessage((current) => (current === ACCOUNT_SAVE_FAILED ? null : current));
        })
        .catch(() => {
          setMessage(ACCOUNT_SAVE_FAILED);
        });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [library, source]);

  const shareTreeId = source === "account" && library ? activeTree(library).id : null;
  useEffect(() => {
    if (!shareTreeId) return;
    const treeId = shareTreeId;
    const ticket = ++shareTicket.current;
    let cancelled = false;
    void readShareLink(treeId).then(
      (url) => {
        if (cancelled || shareTicket.current !== ticket) return;
        setShareNotice(url ? { url, copied: false } : null);
      },
      () => {
        if (cancelled || shareTicket.current !== ticket) return;
        setShareNotice(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [shareTreeId]);

  if (!library || !source) {
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
    const limit = source === "account" ? ACCOUNT_TREE_LIMIT : LOCAL_TREE_LIMIT;
    if (shelf.trees.length >= limit) {
      setMessage(source === "account" ? "An account can keep 5 trees." : "Sign in to keep more than one tree.");
      return;
    }
    setMessage(null);
    setShareNotice(null);
    setGivenName("");
    setFamilyName("");
    setSharing(false);
    setLibrary(addTree(shelf, limit));
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
      ? `Clear ${title}? The people in it will be removed from ${source === "account" ? "your account" : "this browser"}.`
      : `Delete ${title}? It will be removed from ${source === "account" ? "your account" : "this browser"}.`;
    if (!window.confirm(question)) return;
    setMessage(null);
    setShareNotice(null);
    setGivenName("");
    setFamilyName("");
    setSharing(false);
    setLibrary(deleteActiveTree(shelf));
  }

  async function onImport(file: File) {
    const text = await file.text();
    const name = file.name.toLowerCase();
    let parsed: ReturnType<typeof parseTreeDocument>;
    if (name.endsWith(".ged") || name.endsWith(".gedcom")) {
      parsed = parseGedcom(text);
    } else if (name.endsWith(".json") || text.trimStart().startsWith("{")) {
      try {
        parsed = parseTreeDocument(JSON.parse(text));
      } catch {
        setMessage("That file is not valid JSON.");
        return;
      }
    } else {
      setMessage("Import a JSON or GEDCOM file.");
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

  function openAccount(session: { email: string; library: TreeLibrary }) {
    remoteRef.current = session.library;
    setEmail(session.email);
    setSharing(false);
    setMessage(null);
    setGivenName("");
    setFamilyName("");
    setSource("account");
    setLibrary(session.library);
  }

  async function onSignUp(address: string, password: string): Promise<string | null> {
    const result = await signUp(address, password, shelf);
    if (!result.ok) {
      setMessage(result.error);
      return result.error;
    }
    openAccount(result.session);
    return null;
  }

  async function onSignIn(address: string, password: string): Promise<string | null> {
    const result = await signIn(address, password);
    if (!result.ok) {
      setMessage(result.error);
      return result.error;
    }
    openAccount(result.session);
    return null;
  }

  async function onSignOut() {
    saveLibrary(shelf);
    const result = await signOut();
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    remoteRef.current = null;
    setEmail(null);
    setSharing(false);
    setMessage(null);
    setShareNotice(null);
    setSource("local");
  }

  async function changeShare(run: (treeId: string) => Promise<string | null>, failure: string, copy: boolean) {
    const snapshot = shelf;
    const treeId = activeTree(snapshot).id;
    const ticket = ++shareTicket.current;
    const pending = queueRef.current.then(async () => {
      const before = remoteRef.current;
      if (!before) throw new Error("Sign in to share a link.");
      const changes = libraryChanges(before, snapshot);
      if (changes.length > 0) {
        await applyLibraryChanges(changes);
        remoteRef.current = snapshot;
      }
      return run(treeId);
    });
    queueRef.current = pending.then(
      () => undefined,
      () => undefined,
    );
    try {
      const url = await pending;
      if (shareTicket.current !== ticket) return;
      if (!url) {
        setShareNotice(null);
        return;
      }
      let copied = false;
      if (copy) {
        try {
          await navigator.clipboard.writeText(url);
          copied = true;
        } catch {
          copied = false;
        }
      }
      setShareNotice({ url, copied });
    } catch (error) {
      if (shareTicket.current !== ticket) return;
      setMessage(error instanceof Error && error.message ? error.message : failure);
    }
  }

  async function onShare() {
    if (source !== "account") {
      setMessage("Sign in to share a link.");
      return;
    }
    setMessage(null);
    await changeShare(createShareLink, "The share link could not be created.", true);
  }

  async function onReplaceShare() {
    if (!window.confirm("Replace this share link? The old address will stop working.")) return;
    setMessage(null);
    await changeShare(replaceShareLink, "The share link could not be replaced.", true);
  }

  async function onRevokeShare() {
    if (!window.confirm("Turn off this share link? The old address will no longer open the tree.")) return;
    setMessage(null);
    await changeShare(
      async (treeId) => {
        await revokeShareLink(treeId);
        return null;
      },
      "The share link could not be turned off.",
      false,
    );
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
          setShareNotice(null);
          setGivenName("");
          setFamilyName("");
          setLibrary(selectTree(shelf, id));
        }}
        onRenameTree={(title) => setLibrary(renameActive(shelf, title))}
        onNew={onNew}
        onDeleteTree={onDeleteTree}
        onImport={onImport}
        onExport={() => downloadTree(document)}
        onExportGedcom={() => downloadGedcom(document, current.title)}
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
        onShare={() => {
          void onShare();
        }}
        shareNotice={shareNotice}
        onReplaceShare={() => {
          void onReplaceShare();
        }}
        onRevokeShare={() => {
          void onRevokeShare();
        }}
        onToggleShare={() => setSharing((value) => !value)}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onFit={() => canvasRef.current?.fit()}
        accountEmail={email}
        onSignIn={onSignIn}
        onSignUp={onSignUp}
        onSignOut={onSignOut}
      />
      {hasPeople ? (
        <EditorPanel
          document={document}
          sharing={sharing}
          onFocus={(personId) => updateDocument(setFocus(document, personId))}
          onUpdate={(personId, patch) => updateDocument(updatePerson(document, personId, patch))}
          onUpdatePartnership={(partnershipId, patch) =>
            updateDocument(updatePartnership(document, partnershipId, patch))
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
        <TreeCanvas
          ref={canvasRef}
          document={shown}
          onFocus={(personId) => updateDocument(setFocus(document, personId))}
        />
      ) : (
        <section className="empty-state">
          <form onSubmit={onStart}>
            <p className="eyebrow">{source === "account" ? "Saved in your account" : "A private tree in this browser"}</p>
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
