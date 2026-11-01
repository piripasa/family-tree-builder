"use client";

import { useMemo, useState } from "react";
import { coupleLabel, personOption } from "@/i18n/format";
import { useI18n } from "@/i18n/I18nProvider";
import { translateError } from "@/i18n/errors";
import { submitSuggestion } from "@/model/suggestionClient";
import { isHiddenOnShare } from "@/model/share";
import type { SuggestionDraft } from "@/model/suggestion";
import { partnershipsAsPartner } from "@/model/tree";
import type { TreeDocument } from "@/model/types";

type Kind = SuggestionDraft["kind"];

export function SuggestionForm({ token, document }: { token: string; document: TreeDocument }) {
  const people = document.people;
  const visible = people.filter((person) => !isHiddenOnShare(person));
  const [kind, setKind] = useState<Kind>("person");
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [relation, setRelation] = useState<"parent" | "partner" | "child">("child");
  const [relatedToId, setRelatedToId] = useState(document.focusId ?? people[0]?.id ?? "");
  const [partnershipId, setPartnershipId] = useState("");
  const [personId, setPersonId] = useState(visible[0]?.id ?? "");
  const [dateField, setDateField] = useState<"birthDate" | "deathDate">("birthDate");
  const [dateValue, setDateValue] = useState("");
  const [correctionField, setCorrectionField] = useState<"givenName" | "familyName" | "birthPlace" | "deathPlace" | "note">(
    "birthPlace",
  );
  const [correction, setCorrection] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const { locale, messages } = useI18n();
  const text = messages.suggestions;

  const partnerships = useMemo(
    () => (relation === "child" ? partnershipsAsPartner(document, relatedToId) : []),
    [document, relatedToId, relation],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSent(false);
    if (kind === "person" && relation === "child" && partnerships.length > 1 && !partnershipId) {
      setError("Choose which couple this child belongs to.");
      return;
    }
    const suggestion = draft();
    if (!suggestion) {
      setError(
        kind === "person" ? "Enter a given name and choose who they belong with." : "Choose a person whose details are on this page.",
      );
      return;
    }
    setBusy(true);
    try {
      await submitSuggestion(token, suggestion);
      setSent(true);
      setGivenName("");
      setFamilyName("");
      setDateValue("");
      setCorrection("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That suggestion could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  function draft(): SuggestionDraft | null {
    if (kind === "person") {
      if (!givenName.trim() || !relatedToId) return null;
      const suggestion: SuggestionDraft = {
        kind: "person",
        givenName,
        familyName,
        relation,
        relatedToId,
      };
      if (relation === "child" && partnerships.length > 1) {
        if (!partnershipId) return null;
        suggestion.partnershipId = partnershipId;
      }
      return suggestion;
    }
    if (!personId) return null;
    if (kind === "date") {
      if (!dateValue) return null;
      return { kind: "date", personId, field: dateField, value: dateValue };
    }
    if (!correction.trim()) return null;
    return { kind: "correction", personId, field: correctionField, value: correction };
  }

  return (
    <form className="suggest" onSubmit={(event) => void submit(event)}>
      <h3>{text.heading}</h3>
      <p className="hint">{text.hint}</p>
      <label className="field">
        {text.kind}
        <select
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as Kind);
            setError(null);
            setSent(false);
          }}
        >
          <option value="person">{text.addAPerson}</option>
          <option value="date">{text.aDate}</option>
          <option value="correction">{text.aCorrection}</option>
        </select>
      </label>
      {kind === "person" ? (
        <>
          <label className="field">
            {messages.profile.givenName}
            <input value={givenName} onChange={(event) => setGivenName(event.target.value)} autoComplete="off" maxLength={80} required />
          </label>
          <label className="field">
            {messages.profile.familyName}
            <input value={familyName} onChange={(event) => setFamilyName(event.target.value)} autoComplete="off" maxLength={80} />
          </label>
          <label className="field">
            {text.relation}
            <select value={relation} onChange={(event) => setRelation(event.target.value as "parent" | "partner" | "child")}>
              <option value="parent">{text.parent}</option>
              <option value="partner">{text.partner}</option>
              <option value="child">{text.child}</option>
            </select>
          </label>
          <label className="field">
            {text.of}
            <select value={relatedToId} onChange={(event) => setRelatedToId(event.target.value)}>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {personOption(person, messages)}
                </option>
              ))}
            </select>
          </label>
          {partnerships.length > 1 ? (
            <label className="field">
              {text.couple}
              <select value={partnershipId} onChange={(event) => setPartnershipId(event.target.value)} required>
                <option value="">{text.choose}</option>
                {partnerships.map((partnership) => (
                  <option key={partnership.id} value={partnership.id}>
                    {coupleLabel(document, partnership, relatedToId, messages)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </>
      ) : visible.length === 0 ? (
        <p className="hint">{text.everyoneLiving}</p>
      ) : (
        <>
          <label className="field">
            {messages.family.person}
            <select value={personId} onChange={(event) => setPersonId(event.target.value)}>
              {visible.map((person) => (
                <option key={person.id} value={person.id}>
                  {personOption(person, messages)}
                </option>
              ))}
            </select>
          </label>
          {kind === "date" ? (
            <>
              <label className="field">
                {text.date}
                <select value={dateField} onChange={(event) => setDateField(event.target.value as "birthDate" | "deathDate")}>
                  <option value="birthDate">{messages.profile.birthDate}</option>
                  <option value="deathDate">{messages.profile.deathDate}</option>
                </select>
              </label>
              <label className="field">
                {text.when}
                <input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} required />
              </label>
            </>
          ) : (
            <>
              <label className="field">
                {text.correct}
                <select
                  value={correctionField}
                  onChange={(event) =>
                    setCorrectionField(event.target.value as "givenName" | "familyName" | "birthPlace" | "deathPlace" | "note")
                  }
                >
                  <option value="givenName">{messages.profile.givenName}</option>
                  <option value="familyName">{messages.profile.familyName}</option>
                  <option value="birthPlace">{messages.profile.birthPlace}</option>
                  <option value="deathPlace">{messages.profile.deathPlace}</option>
                  <option value="note">{messages.profile.note}</option>
                </select>
              </label>
              <label className="field">
                {text.newValue}
                {correctionField === "note" ? (
                  <textarea value={correction} onChange={(event) => setCorrection(event.target.value)} maxLength={2000} rows={3} required />
                ) : (
                  <input
                    value={correction}
                    onChange={(event) => setCorrection(event.target.value)}
                    autoComplete="off"
                    maxLength={correctionField.endsWith("Place") ? 160 : 80}
                    required
                  />
                )}
              </label>
            </>
          )}
        </>
      )}
      {error ? (
        <p className="message" role="alert">
          {translateError(locale, error)}
        </p>
      ) : null}
      {sent ? <p className="hint">{text.sent}</p> : null}
      <button type="submit" className="primary" disabled={busy || (kind !== "person" && visible.length === 0)}>
        {text.send}
      </button>
    </form>
  );
}
