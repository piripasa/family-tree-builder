"use client";

import { useEffect, useState } from "react";
import { formatConnection, personOption } from "@/i18n/format";
import { useI18n } from "@/i18n/I18nProvider";
import { connection, searchPeople } from "@/model/find";
import type { TreeDocument } from "@/model/types";

export function PersonFinder({
  document,
  focusId,
  onFocus,
}: {
  document: TreeDocument;
  focusId: string;
  onFocus: (personId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [otherId, setOtherId] = useState("");
  const { messages } = useI18n();
  const matches = searchPeople(document, query);
  const others = document.people.filter((person) => person.id !== focusId);
  const relation =
    otherId && otherId !== focusId ? formatConnection(document, connection(document, focusId, otherId), messages) : null;

  useEffect(() => {
    if (otherId === focusId) setOtherId("");
  }, [focusId, otherId]);

  return (
    <section className="finder">
      <h3>{messages.finder.title}</h3>
      <label className="field">
        {messages.finder.name}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={messages.finder.placeholder}
          autoComplete="off"
        />
      </label>
      {query.trim() ? (
        matches.length > 0 ? (
          <ul className="finder-matches">
            {matches.map((person) => (
              <li key={person.id}>
                <button type="button" className="person-link" onClick={() => onFocus(person.id)}>
                  {personOption(person, messages)}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">{messages.finder.noMatch}</p>
        )
      ) : null}
      {others.length > 0 ? (
        <label className="field">
          {messages.finder.how}
          <select value={otherId} onChange={(event) => setOtherId(event.target.value)}>
            <option value="">{messages.finder.choose}</option>
            {others.map((person) => (
              <option key={person.id} value={person.id}>
                {personOption(person, messages)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {relation ? <p className="finder-result">{relation}</p> : null}
    </section>
  );
}
