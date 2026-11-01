"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TreeCanvas, type TreeCanvasHandle } from "@/components/TreeCanvas";
import { PersonFinder } from "@/components/PersonFinder";
import { loadShare } from "@/model/shareLink";
import { displayName, lifeSpan, personMenuLabel, setFocus } from "@/model/tree";
import type { Person, TreeDocument } from "@/model/types";

export function SharedView({ token }: { token: string }) {
  const canvasRef = useRef<TreeCanvasHandle>(null);
  const [title, setTitle] = useState("Shared family tree");
  const [document, setDocument] = useState<TreeDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    loadShare(token).then(
      (shared) => {
        if (cancel) return;
        setTitle(shared.title.trim() || "Shared family tree");
        setDocument(shared.document);
      },
      (reason: unknown) => {
        if (cancel) return;
        setError(reason instanceof Error ? reason.message : "That share link could not be found.");
      },
    );
    return () => {
      cancel = true;
    };
  }, [token]);

  const person = document?.people.find((item) => item.id === document.focusId) ?? null;

  return (
    <main className={document && document.people.length > 0 ? "app" : "app is-empty"}>
      <header className="toolbar">
        <p className="home-return">
          <Link href="/">Family tree</Link>
        </p>
        <h1>{title}</h1>
        <p className="share-banner">Shared view. This link can only be viewed.</p>
        <div className="toolbar-actions">
          <button type="button" aria-label="Zoom in" onClick={() => canvasRef.current?.zoomIn()}>
            +
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => canvasRef.current?.zoomOut()}>
            −
          </button>
          <button type="button" onClick={() => canvasRef.current?.fit()}>
            Fit
          </button>
        </div>
        {error ? (
          <p className="toolbar-message" role="alert">
            {error}
          </p>
        ) : null}
      </header>
      {document && person ? (
        <aside className="panel">
          <div className="panel-scroll">
            <p className="eyebrow">Shared view</p>
            <h2>{displayName(person)}</h2>
            <SharedDetails person={person} />
            <PersonFinder
              document={document}
              focusId={person.id}
              onFocus={(personId) => setDocument(setFocus(document, personId))}
            />
            <div className="everyone">
              <h3>Everyone</h3>
              <ul>
                {document.people.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={item.id === person.id ? "person-link current" : "person-link"}
                      aria-current={item.id === person.id ? "true" : undefined}
                      onClick={() => setDocument(setFocus(document, item.id))}
                    >
                      {personMenuLabel(item)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      ) : null}
      {document && document.people.length > 0 ? (
        <TreeCanvas
          ref={canvasRef}
          document={document}
          onFocus={(personId) => setDocument(setFocus(document, personId))}
        />
      ) : (
        <section className="empty-state">
          <p className="eyebrow">Shared view</p>
          <h2>{error ? "This link is not available" : document ? "This shared tree is empty" : "Opening the shared tree"}</h2>
        </section>
      )}
    </main>
  );
}

function SharedDetails({ person }: { person: Person }) {
  const lines = [
    lifeSpan(person),
    person.birthPlace ? `Born in ${person.birthPlace}` : "",
    person.deathPlace ? `Died in ${person.deathPlace}` : "",
    person.note ?? "",
  ].filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <div className="shared-details">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}
