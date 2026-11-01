"use client";

import { formatSuggestion } from "@/i18n/format";
import { useI18n } from "@/i18n/I18nProvider";
import type { StoredSuggestion } from "@/model/suggestion";
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
  const { messages } = useI18n();
  if (suggestions.length === 0) return null;
  return (
    <section className="suggestions">
      <h3>{messages.suggestions.title}</h3>
      <ul>
        {suggestions.map((suggestion) => (
          <li key={suggestion.id} className="suggestion">
            <p>{formatSuggestion(document, suggestion, messages)}</p>
            <div className="suggestion-actions">
              <button type="button" className="primary" disabled={busy} onClick={() => onAccept(suggestion.id)}>
                {messages.suggestions.accept}
              </button>
              <button type="button" disabled={busy} onClick={() => onDecline(suggestion.id)}>
                {messages.suggestions.decline}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
