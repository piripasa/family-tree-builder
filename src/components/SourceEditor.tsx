"use client";

import { useState } from "react";
import {
  describeSource,
  sourceDetailLimit,
  sourceFactLabel,
  sourceKindLabel,
} from "@/model/source";
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
      {heading ? <h3>Sources</h3> : null}
      {facts.includes("marriage") ? null : (
        <p className="hint">
          A person, a certificate, or a short note for a fact. A share link leaves every source out.
        </p>
      )}
      {sources.length > 0 ? (
        <ul>
          {sources.map((source) => (
            <li key={source.id} className="source">
              <p>{describeSource(source)}</p>
              <button type="button" onClick={() => onRemove(source.id)}>
                Remove {sourceFactLabel(source.fact).toLowerCase()} source
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {facts.length > 1 ? (
        <label className="field">
          Fact
          <select
            value={chosenFact}
            onChange={(event) => {
              setFact(event.target.value as SourceFact);
              setError(null);
            }}
          >
            {facts.map((item) => (
              <option key={item} value={item}>
                {sourceFactLabel(item)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="field">
        From
        <select
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as SourceKind);
            setError(null);
          }}
        >
          <option value="person">{sourceKindLabel("person")}</option>
          <option value="certificate">{sourceKindLabel("certificate")}</option>
          <option value="note">{sourceKindLabel("note")}</option>
        </select>
      </label>
      <label className="field">
        {kind === "person" ? "Person" : kind === "certificate" ? "Certificate" : "Short note"}
        <input
          value={detail}
          maxLength={sourceDetailLimit(kind)}
          autoComplete="off"
          onChange={(event) => setDetail(event.target.value)}
        />
      </label>
      {error ? (
        <p className="message" role="alert">
          {error}
        </p>
      ) : null}
      <button type="button" className="primary" onClick={submit}>
        Add source
      </button>
    </section>
  );
}
