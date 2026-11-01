"use client";

import { useEffect, useId, useState } from "react";
import { PersonFinder } from "@/components/PersonFinder";
import { SourceEditor } from "@/components/SourceEditor";
import { coupleLabel, personName, personOption } from "@/i18n/format";
import { useI18n } from "@/i18n/I18nProvider";
import { translateError } from "@/i18n/errors";
import { readProfilePhoto } from "@/model/photo";
import { SuggestionList } from "@/components/SuggestionList";
import { addMarriageSource, addPersonSource, removeMarriageSource, removePersonSource } from "@/model/source";
import type { StoredSuggestion } from "@/model/suggestion";
import {
  childrenOf,
  eligiblePeople,
  isAlive,
  parentsOf,
  partnershipsAsPartner,
  partnersOf,
} from "@/model/tree";
import type { Person, RelativeSource, TreeDocument } from "@/model/types";

type Role = "parent" | "partner" | "child";
type PanelTab = "profile" | "family" | "sources" | "people" | "record" | "suggestions";

export function EditorPanel({
  document,
  sharing,
  onFocus,
  onUpdate,
  onUpdatePartnership,
  onAddParent,
  onAddPartner,
  onAddChild,
  onMerge,
  onDelete,
  onDocument,
  suggestions,
  suggestionBusy,
  onAcceptSuggestion,
  onDeclineSuggestion,
}: {
  document: TreeDocument;
  sharing: boolean;
  onFocus: (personId: string) => void;
  onUpdate: (personId: string, patch: Partial<Omit<Person, "id">>) => void;
  onUpdatePartnership: (
    partnershipId: string,
    patch: { marriageDate?: string; marriagePlace?: string },
  ) => void;
  onAddParent: (source: RelativeSource) => boolean;
  onAddPartner: (source: RelativeSource) => boolean;
  onAddChild: (source: RelativeSource, partnershipId?: string) => boolean;
  onMerge: (personId: string) => boolean;
  onDelete: (personId: string) => void;
  onDocument: (document: TreeDocument) => void;
  suggestions: StoredSuggestion[];
  suggestionBusy: boolean;
  onAcceptSuggestion: (suggestionId: string) => void;
  onDeclineSuggestion: (suggestionId: string) => void;
}) {
  const person = document.people.find((item) => item.id === document.focusId);
  const { locale, messages } = useI18n();
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [tab, setTab] = useState<PanelTab>("profile");

  useEffect(() => {
    setPhotoError(null);
  }, [person?.id]);

  useEffect(() => {
    if (tab === "suggestions" && suggestions.length === 0) setTab("profile");
  }, [tab, suggestions.length]);

  if (!person) return null;

  const alive = isAlive(person);
  const datesInverted = Boolean(
    person.birthDate && person.deathDate && person.deathDate < person.birthDate,
  );

  const parents = parentsOf(document, person.id);
  const partners = partnersOf(document, person.id);
  const children = childrenOf(document, person.id);
  const partnerships = partnershipsAsPartner(document, person.id);
  const couples = partnerships.filter((partnership) => partnership.partnerIds.length === 2);
  const tabs: { id: PanelTab; label: string }[] = [
    { id: "profile", label: messages.panel.profile },
    { id: "family", label: messages.panel.family },
    { id: "sources", label: messages.panel.sources },
    { id: "people", label: messages.panel.people },
    { id: "record", label: messages.panel.record },
  ];
  if (suggestions.length > 0) tabs.unshift({ id: "suggestions", label: messages.panel.suggestions });

  return (
    <aside className="panel">
      <header className="panel-head">
        {sharing ? (
          <p className="share-banner">
            {messages.panel.shareBanner}
          </p>
        ) : null}
        <p className="eyebrow">{messages.panel.selected}</p>
        <h2>{personName(person, messages)}</h2>
      </header>
      <div className="panel-tabs" role="tablist" aria-label={messages.panel.details}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`person-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`person-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.id === "suggestions" ? <span className="tab-count">{suggestions.length}</span> : null}
          </button>
        ))}
      </div>
      <div
        className="panel-tab"
        role="tabpanel"
        id={`person-panel-${tab}`}
        aria-labelledby={`person-tab-${tab}`}
      >
        {tab === "suggestions" ? (
          <SuggestionList
            document={document}
            suggestions={suggestions}
            busy={suggestionBusy}
            onAccept={onAcceptSuggestion}
            onDecline={onDeclineSuggestion}
          />
        ) : null}

        {tab === "profile" ? (
        <>
        <label className="field">
          {messages.profile.givenName}
          <input
            value={person.givenName}
            onChange={(event) => onUpdate(person.id, { givenName: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label className="field">
          {messages.profile.familyName}
          <input
            value={person.familyName}
            onChange={(event) => onUpdate(person.id, { familyName: event.target.value })}
            autoComplete="off"
          />
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={alive}
            onChange={(event) => onUpdate(person.id, { living: event.target.checked })}
          />
          {messages.profile.alive}
        </label>
        <p className="hint">{messages.profile.aliveHint}</p>

        <div className="photo-row">
          {person.photo ? (
            <img className="photo-preview" src={person.photo} alt="" />
          ) : (
            <div className="photo-preview empty" aria-hidden="true" />
          )}
          <div className="photo-actions">
            <label className="file-button">
              {person.photo ? messages.profile.changePhoto : messages.profile.addPhoto}
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  readProfilePhoto(file).then(
                    (photo) => {
                      setPhotoError(null);
                      onUpdate(person.id, { photo });
                    },
                    (error: unknown) => {
                      setPhotoError(error instanceof Error ? error.message : "That image could not be read.");
                    },
                  );
                }}
              />
            </label>
            {person.photo ? (
              <button type="button" onClick={() => onUpdate(person.id, { photo: "" })}>
                {messages.profile.removePhoto}
              </button>
            ) : null}
          </div>
        </div>
        {photoError ? (
          <p className="message" role="alert">
            {translateError(locale, photoError)}
          </p>
        ) : null}

        <div className="profile-grid">
          <label className="field">
            {messages.profile.birthDate}
            <input
              type="date"
              value={person.birthDate ?? ""}
              onChange={(event) => onUpdate(person.id, { birthDate: event.target.value })}
            />
          </label>
          <label className="field">
            {messages.profile.birthPlace}
            <input
              value={person.birthPlace ?? ""}
              onChange={(event) => onUpdate(person.id, { birthPlace: event.target.value })}
              autoComplete="off"
            />
          </label>
          {alive ? null : (
            <>
              <label className="field">
                {messages.profile.deathDate}
                <input
                  type="date"
                  value={person.deathDate ?? ""}
                  onChange={(event) => onUpdate(person.id, { deathDate: event.target.value })}
                />
              </label>
              <label className="field">
                {messages.profile.deathPlace}
                <input
                  value={person.deathPlace ?? ""}
                  onChange={(event) => onUpdate(person.id, { deathPlace: event.target.value })}
                  autoComplete="off"
                />
              </label>
            </>
          )}
        </div>
        {datesInverted ? <p className="hint">{messages.profile.datesInverted}</p> : null}
        <label className="field">
          {messages.profile.note}
          <textarea
            rows={2}
            maxLength={2000}
            value={person.note ?? ""}
            onChange={(event) => onUpdate(person.id, { note: event.target.value })}
          />
        </label>
        </>
        ) : null}

        {tab === "family" ? (
        <>
          <p className="hint">{messages.family.hint}</p>
          <dl className="relations">
            <RelationList label={messages.family.parents} people={parents} onFocus={onFocus} />
            <RelationList label={messages.family.partners} people={partners} onFocus={onFocus} />
            <RelationList label={messages.family.children} people={children} onFocus={onFocus} />
          </dl>

        {couples.map((partnership) => (
            <fieldset key={partnership.id} className="marriage">
              <legend>{coupleLabel(document, partnership, person.id, messages)}</legend>
              <label className="field">
                {messages.family.marriageDate}
                <input
                  type="date"
                  value={partnership.marriageDate ?? ""}
                  onChange={(event) =>
                    onUpdatePartnership(partnership.id, { marriageDate: event.target.value })
                  }
                />
              </label>
              <label className="field">
                {messages.family.marriagePlace}
                <input
                  value={partnership.marriagePlace ?? ""}
                  maxLength={160}
                  autoComplete="off"
                  onChange={(event) =>
                    onUpdatePartnership(partnership.id, { marriagePlace: event.target.value })
                  }
                />
              </label>
            </fieldset>
          ))}

        {parents.length >= 2 ? (
          <p className="hint">{messages.family.twoParents}</p>
        ) : (
          <RelativeForm
            key={`parent-${person.id}`}
            title={messages.family.addParent}
            role="parent"
            document={document}
            personId={person.id}
            partnerships={[]}
            onSubmit={(source) => onAddParent(source)}
          />
        )}
        <RelativeForm
          key={`partner-${person.id}`}
          title={messages.family.addPartner}
          role="partner"
          document={document}
          personId={person.id}
          partnerships={[]}
          onSubmit={(source) => onAddPartner(source)}
        />
        <RelativeForm
          key={`child-${person.id}`}
          title={messages.family.addChild}
          role="child"
          document={document}
          personId={person.id}
          partnerships={partnerships.map((partnership) => ({
            id: partnership.id,
            label: coupleLabel(document, partnership, person.id, messages),
          }))}
          onSubmit={(source, partnershipId) => onAddChild(source, partnershipId)}
        />
        </>
        ) : null}

        {tab === "sources" ? (
        <>
          <SourceEditor
            key={person.id}
            sources={(person.sources ?? []).filter((source) => source.fact !== "marriage")}
            facts={alive ? ["name", "birth"] : ["name", "birth", "death"]}
            onAdd={(input) => {
              const result = addPersonSource(document, person.id, input);
              if (!result.ok) return result.error;
              onDocument(result.document);
              return null;
            }}
            onRemove={(sourceId) => onDocument(removePersonSource(document, person.id, sourceId))}
            heading={false}
          />
          {couples.map((partnership) => (
            <fieldset key={`${partnership.id}-sources`} className="marriage">
              <legend>{coupleLabel(document, partnership, person.id, messages)}</legend>
              <SourceEditor
                sources={partnership.sources ?? []}
                facts={["marriage"]}
                onAdd={(input) => {
                  const result = addMarriageSource(document, partnership.id, input);
                  if (!result.ok) return result.error;
                  onDocument(result.document);
                  return null;
                }}
                onRemove={(sourceId) => onDocument(removeMarriageSource(document, partnership.id, sourceId))}
                heading={false}
              />
            </fieldset>
          ))}
        </>
        ) : null}

        {tab === "people" ? (
        <>
          <PersonFinder document={document} focusId={person.id} onFocus={onFocus} />
          <div className="everyone">
          <h3>{messages.shared.everyone}</h3>
          <ul>
            {document.people.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={item.id === person.id ? "person-link current" : "person-link"}
                  aria-current={item.id === person.id ? "true" : undefined}
                  onClick={() => onFocus(item.id)}
                >
                  {personOption(item, messages)}
                </button>
              </li>
            ))}
          </ul>
          </div>
        </>
        ) : null}

        {tab === "record" ? (
        <>
          {document.people.length > 1 ? (
            <MergeForm
              person={person}
              others={document.people.filter((item) => item.id !== person.id)}
              onMerge={onMerge}
            />
          ) : null}
          <button type="button" className="danger" onClick={() => onDelete(person.id)}>
            {messages.record.delete(personName(person, messages))}
          </button>
        </>
        ) : null}
      </div>
    </aside>
  );
}

function MergeForm({
  person,
  others,
  onMerge,
}: {
  person: Person;
  others: Person[];
  onMerge: (personId: string) => boolean;
}) {
  const [otherId, setOtherId] = useState(others[0]?.id ?? "");
  const [confirming, setConfirming] = useState(false);
  const { messages } = useI18n();
  const other = others.find((item) => item.id === otherId);

  useEffect(() => {
    if (!others.some((item) => item.id === otherId)) {
      setOtherId(others[0]?.id ?? "");
      setConfirming(false);
    }
  }, [others, otherId]);

  return (
    <section className="adder merge">
      <h3>{messages.record.mergeTitle}</h3>
      <p className="hint">{messages.record.mergeHint}</p>
      <label className="field">
        {messages.record.other}
        <select
          value={otherId}
          onChange={(event) => {
            setOtherId(event.target.value);
            setConfirming(false);
          }}
        >
          {others.map((item) => (
            <option key={item.id} value={item.id}>
              {personOption(item, messages)}
            </option>
          ))}
        </select>
      </label>
      {confirming && other ? (
        <div className="merge-actions">
          <p>
            {messages.record.ask(personName(other, messages), personName(person, messages))}
          </p>
          <button
            type="button"
            className="primary"
            onClick={() => {
              if (onMerge(other.id)) setConfirming(false);
            }}
          >
            {messages.record.merge}
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            {messages.cancel}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} disabled={!other}>
          {messages.record.into}
        </button>
      )}
    </section>
  );
}

function RelationList({
  label,
  people,
  onFocus,
}: {
  label: string;
  people: Person[];
  onFocus: (personId: string) => void;
}) {
  const { messages } = useI18n();
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {people.length === 0
          ? messages.noneYet
          : people.map((person) => (
              <button key={person.id} type="button" className="text-link" onClick={() => onFocus(person.id)}>
                {personOption(person, messages)}
              </button>
            ))}
      </dd>
    </div>
  );
}

function RelativeForm({
  title,
  role,
  document,
  personId,
  partnerships,
  onSubmit,
}: {
  title: string;
  role: Role;
  document: TreeDocument;
  personId: string;
  partnerships: { id: string; label: string }[];
  onSubmit: (source: RelativeSource, partnershipId?: string) => boolean;
}) {
  const { messages } = useI18n();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const candidates = eligiblePeople(document, personId, role);
  const [existingId, setExistingId] = useState(candidates[0]?.id ?? "");
  const [partnershipId, setPartnershipId] = useState(partnerships[0]?.id ?? "");

  useEffect(() => {
    if (!candidates.some((person) => person.id === existingId)) {
      setExistingId(candidates[0]?.id ?? "");
    }
  }, [candidates, existingId]);

  useEffect(() => {
    if (!partnerships.some((partnership) => partnership.id === partnershipId)) {
      setPartnershipId(partnerships[0]?.id ?? "");
    }
  }, [partnerships, partnershipId]);

  function submit() {
    const source: RelativeSource =
      mode === "existing" && candidates.length > 0
        ? { type: "existing", personId: existingId }
        : { type: "new", givenName, familyName };
    const chosenPartnership =
      role === "child" && partnerships.length > 0 ? partnershipId : undefined;
    const ok = onSubmit(source, chosenPartnership);
    if (!ok) return;
    setGivenName("");
    setFamilyName("");
    setOpen(false);
  }

  return (
    <section className="adder">
      <button
        type="button"
        className="adder-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {title}
      </button>
      {open ? (
        <div className="adder-body">
          {role === "child" && partnerships.length > 1 ? (
            <label className="field">
              {messages.family.partnership}
              <select value={partnershipId} onChange={(event) => setPartnershipId(event.target.value)}>
                {partnerships.map((partnership) => (
                  <option key={partnership.id} value={partnership.id}>
                    {partnership.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {candidates.length > 0 ? (
            <div className="segmented" role="group" aria-label={messages.family.sourceFor(title)}>
              <button type="button" aria-pressed={mode === "new"} onClick={() => setMode("new")}>
                {messages.family.newPerson}
              </button>
              <button type="button" aria-pressed={mode === "existing"} onClick={() => setMode("existing")}>
                {messages.family.inTree}
              </button>
            </div>
          ) : null}

          {mode === "existing" && candidates.length > 0 ? (
            <label className="field">
              {messages.family.person}
              <select value={existingId} onChange={(event) => setExistingId(event.target.value)}>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {personOption(candidate, messages)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="field" htmlFor={`${formId}-given`}>
                {messages.profile.givenName}
                <input
                  id={`${formId}-given`}
                  value={givenName}
                  onChange={(event) => setGivenName(event.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="field" htmlFor={`${formId}-family`}>
                {messages.profile.familyName}
                <input
                  id={`${formId}-family`}
                  value={familyName}
                  onChange={(event) => setFamilyName(event.target.value)}
                  autoComplete="off"
                />
              </label>
            </>
          )}
          <button type="button" className="primary" onClick={submit}>
            {title}
          </button>
        </div>
      ) : null}
    </section>
  );
}
