"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { translateError } from "@/i18n/errors";
import { sourceDetailLimit } from "@/model/source";
import type { FactSource, SourceFact, SourceKind } from "@/model/types";

export function SourceEditor({
  sources,
  facts,
  onAdd,
  onRemove,
  heading = true,
}: {
  sources: FactSource[];
  facts: SourceFact[];
  onAdd: (input: { fact: SourceFact; kind: SourceKind; detail: string }) => string | null;
  onRemove: (sourceId: string) => void;
  heading?: boolean;
}) {
  const [fact, setFact] = useState<SourceFact>(facts[0] ?? "name");
  const [kind, setKind] = useState<SourceKind>("person");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { locale, messages } = useI18n();
  const chosenFact = facts.includes(fact) ? fact : facts[0];

  if (!chosenFact) return null;

  function submit() {
    const message = onAdd({ fact: chosenFact as SourceFact, kind, detail });
    if (message) {
      setError(message);
      return;
    }
    setDetail("");
    setError(null);
  }

  return (
    <section className="sources">
      {heading ? <h3>{messages.sources.heading}</h3> : null}
      {facts.includes("marriage") ? null : <p className="hint">{messages.sources.hint}</p>}
      {sources.length > 0 ? (
        <ul>
          {sources.map((source) => (
            <li key={source.id} className="source">
              <p>
                {messages.facts[source.fact]} · {messages.sourceKinds[source.kind]} · {source.detail}
              </p>
              <button type="button" onClick={() => onRemove(source.id)}>
                {messages.sources.remove(messages.facts[source.fact])}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {facts.length > 1 ? (
        <label className="field">
          {messages.sources.fact}
          <select
            value={chosenFact}
            onChange={(event) => {
              setFact(event.target.value as SourceFact);
              setError(null);
            }}
          >
            {facts.map((item) => (
              <option key={item} value={item}>
                {messages.facts[item]}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="field">
        {messages.sources.from}
        <select
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as SourceKind);
            setError(null);
          }}
        >
          <option value="person">{messages.sourceKinds.person}</option>
          <option value="certificate">{messages.sourceKinds.certificate}</option>
          <option value="note">{messages.sourceKinds.note}</option>
        </select>
      </label>
      <label className="field">
        {messages.sourceFields[kind]}
        <input
          value={detail}
          maxLength={sourceDetailLimit(kind)}
          autoComplete="off"
          onChange={(event) => setDetail(event.target.value)}
        />
      </label>
      {error ? (
        <p className="message" role="alert">
          {translateError(locale, error)}
        </p>
      ) : null}
      <button type="button" className="primary" onClick={submit}>
        {messages.sources.add}
      </button>
    </section>
  );
}
