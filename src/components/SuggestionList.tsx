"use client";

import { describeSuggestion, type StoredSuggestion } from "@/model/suggestion";
import type { TreeDocument } from "@/model/types";

export function SuggestionList({
  document,
  suggestions,
  busy,
  onAccept,
  onDecline,
}: {
  document: TreeDocument;
  suggestions: StoredSuggestion[];
  busy: boolean;
  onAccept: (suggestionId: string) => void;
  onDecline: (suggestionId: string) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <section className="suggestions">
      <h3>Suggestions</h3>
      <ul>
        {suggestions.map((suggestion) => (
          <li key={suggestion.id} className="suggestion">
            <p>{describeSuggestion(document, suggestion)}</p>
            <div className="suggestion-actions">
              <button type="button" className="primary" disabled={busy} onClick={() => onAccept(suggestion.id)}>
                Accept
              </button>
              <button type="button" disabled={busy} onClick={() => onDecline(suggestion.id)}>
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
