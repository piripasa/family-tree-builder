"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { SuggestionForm } from "@/components/SuggestionForm";
import { TreeCanvas, type TreeCanvasHandle } from "@/components/TreeCanvas";
import { PersonFinder } from "@/components/PersonFinder";
import { personName, personOption, personYears } from "@/i18n/format";
import { useI18n } from "@/i18n/I18nProvider";
import { translateError } from "@/i18n/errors";
import { loadShare } from "@/model/shareLink";
import { setFocus } from "@/model/tree";
import type { Person, TreeDocument } from "@/model/types";

export function SharedView({ token }: { token: string }) {
  const canvasRef = useRef<TreeCanvasHandle>(null);
  const { locale, messages } = useI18n();
  const [title, setTitle] = useState("");
  useEffect(() => {
    window.document.title = messages.sharedTitle;
  }, [messages.sharedTitle]);
  const [document, setDocument] = useState<TreeDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    loadShare(token).then(
      (shared) => {
        if (cancel) return;
        setTitle(shared.title.trim() || messages.shared.fallbackTitle);
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
  }, [token, messages.shared.fallbackTitle]);

  const person = document?.people.find((item) => item.id === document.focusId) ?? null;

  return (
    <main className={document && document.people.length > 0 ? "app" : "app is-empty"}>
      <header className="toolbar">
        <div className="toolbar-bar">
          <Link className="brand" href="/" aria-label={messages.appName}>
            <img src="/family-tree-logo.png" alt="" />
          </Link>
          <h1>{title || messages.shared.fallbackTitle}</h1>
          <LanguageSwitch bare />
          <div className="tool-group toolbar-zoom">
            <button type="button" aria-label={messages.toolbar.zoomIn} onClick={() => canvasRef.current?.zoomIn()}>
              +
            </button>
            <button type="button" aria-label={messages.toolbar.zoomOut} onClick={() => canvasRef.current?.zoomOut()}>
              −
            </button>
            <button type="button" onClick={() => canvasRef.current?.fit()}>
              {messages.toolbar.fit}
            </button>
          </div>
        </div>
        <p className="share-banner">{messages.shared.banner}</p>
        {error ? (
          <p className="toolbar-message" role="alert">
            {translateError(locale, error)}
          </p>
        ) : null}
      </header>
      {document && person ? (
        <aside className="panel">
          <div className="panel-scroll">
            <p className="eyebrow">{messages.shared.eyebrow}</p>
            <h2>{personName(person, messages)}</h2>
            <SharedDetails person={person} />
            <PersonFinder
              document={document}
              focusId={person.id}
              onFocus={(personId) => setDocument(setFocus(document, personId))}
            />
            <div className="everyone">
              <h3>{messages.shared.everyone}</h3>
              <ul>
                {document.people.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={item.id === person.id ? "person-link current" : "person-link"}
                      aria-current={item.id === person.id ? "true" : undefined}
                      onClick={() => setDocument(setFocus(document, item.id))}
                    >
                      {personOption(item, messages)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <SuggestionForm token={token} document={document} />
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
          <p className="eyebrow">{messages.shared.eyebrow}</p>
          <h2>
            {error ? messages.shared.unavailable : document ? messages.shared.empty : messages.shared.opening}
          </h2>
        </section>
      )}
    </main>
  );
}

function SharedDetails({ person }: { person: Person }) {
  const { messages } = useI18n();
  const lines = [
    personYears(person, messages),
    person.birthPlace ? messages.shared.bornIn(person.birthPlace) : "",
    person.deathPlace ? messages.shared.diedIn(person.deathPlace) : "",
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
