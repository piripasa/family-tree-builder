"use client";

import { useEffect, useState } from "react";
import { describeRelation, searchPeople } from "@/model/find";
import { personMenuLabel } from "@/model/tree";
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
  const matches = searchPeople(document, query);
  const others = document.people.filter((person) => person.id !== focusId);
  const relation = otherId && otherId !== focusId ? describeRelation(document, focusId, otherId) : null;

  useEffect(() => {
    if (otherId === focusId) setOtherId("");
  }, [focusId, otherId]);

  return (
    <section className="finder">
      <h3>Find</h3>
      <label className="field">
        Name
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search names"
          autoComplete="off"
        />
      </label>
      {query.trim() ? (
        matches.length > 0 ? (
          <ul className="finder-matches">
            {matches.map((person) => (
              <li key={person.id}>
                <button type="button" className="person-link" onClick={() => onFocus(person.id)}>
                  {personMenuLabel(person)}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">No one matches that name.</p>
        )
      ) : null}
      {others.length > 0 ? (
        <label className="field">
          How they connect
          <select value={otherId} onChange={(event) => setOtherId(event.target.value)}>
            <option value="">Choose a person</option>
            {others.map((person) => (
              <option key={person.id} value={person.id}>
                {personMenuLabel(person)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {relation ? <p className="finder-result">{relation}</p> : null}
    </section>
  );
}
