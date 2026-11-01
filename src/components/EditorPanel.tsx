"use client";

import { useEffect, useId, useState } from "react";
import { readProfilePhoto } from "@/model/photo";
import { SuggestionList } from "@/components/SuggestionList";
import type { StoredSuggestion } from "@/model/suggestion";
import {
  childrenOf,
  displayName,
  eligiblePeople,
  isAlive,
  parentsOf,
  personMenuLabel,
  partnershipLabel,
  partnershipsAsPartner,
  partnersOf,
} from "@/model/tree";
import type { Person, RelativeSource, TreeDocument } from "@/model/types";

type Role = "parent" | "partner" | "child";

export function EditorPanel({
  document,
  sharing,
  onFocus,
  onUpdate,
  onUpdatePartnership,
  onAddParent,
  onAddPartner,
  onAddChild,
  onDelete,
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
  onDelete: (personId: string) => void;
  suggestions: StoredSuggestion[];
  suggestionBusy: boolean;
  onAcceptSuggestion: (suggestionId: string) => void;
  onDeclineSuggestion: (suggestionId: string) => void;
}) {
  const person = document.people.find((item) => item.id === document.focusId);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    setPhotoError(null);
  }, [person?.id]);

  if (!person) return null;

  const alive = isAlive(person);
  const datesInverted = Boolean(
    person.birthDate && person.deathDate && person.deathDate < person.birthDate,
  );

  const parents = parentsOf(document, person.id);
  const partners = partnersOf(document, person.id);
  const children = childrenOf(document, person.id);
  const partnerships = partnershipsAsPartner(document, person.id);

  return (
    <aside className="panel">
      <div className="panel-scroll">
        <SuggestionList
          document={document}
          suggestions={suggestions}
          busy={suggestionBusy}
          onAccept={onAcceptSuggestion}
          onDecline={onDeclineSuggestion}
        />
        {sharing ? (
          <p className="share-banner">
            Shared view. Living people stay in the tree and appear as Living, without their private details.
          </p>
        ) : null}
        <p className="eyebrow">Selected person</p>
        <h2>{displayName(person)}</h2>
        <p className="lede">Parents are above this person. Partners and children are below.</p>

        <label className="field">
          Given name
          <input
            value={person.givenName}
            onChange={(event) => onUpdate(person.id, { givenName: event.target.value })}
            autoComplete="off"
          />
        </label>
        <label className="field">
          Family name
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
          Alive
        </label>
        <p className="hint">A share link leaves out the name, photo, dates, places, and note of anyone marked alive. A person with no mark keeps their details.</p>

        <div className="photo-row">
          {person.photo ? (
            <img className="photo-preview" src={person.photo} alt="" />
          ) : (
            <div className="photo-preview empty" aria-hidden="true" />
          )}
          <div className="photo-actions">
            <label className="file-button">
              {person.photo ? "Change photo" : "Add photo"}
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
                Remove photo
              </button>
            ) : null}
          </div>
        </div>
        {photoError ? (
          <p className="message" role="alert">
            {photoError}
          </p>
        ) : null}

        <div className="profile-grid">
          <label className="field">
            Birth date
            <input
              type="date"
              value={person.birthDate ?? ""}
              onChange={(event) => onUpdate(person.id, { birthDate: event.target.value })}
            />
          </label>
          <label className="field">
            Birth place
            <input
              value={person.birthPlace ?? ""}
              onChange={(event) => onUpdate(person.id, { birthPlace: event.target.value })}
              autoComplete="off"
            />
          </label>
          {alive ? null : (
            <>
              <label className="field">
                Death date
                <input
                  type="date"
                  value={person.deathDate ?? ""}
                  onChange={(event) => onUpdate(person.id, { deathDate: event.target.value })}
                />
              </label>
              <label className="field">
                Death place
                <input
                  value={person.deathPlace ?? ""}
                  onChange={(event) => onUpdate(person.id, { deathPlace: event.target.value })}
                  autoComplete="off"
                />
              </label>
            </>
          )}
        </div>
        {datesInverted ? <p className="hint">The death date is earlier than the birth date.</p> : null}
        <label className="field">
          Note
          <textarea
            rows={3}
            maxLength={2000}
            value={person.note ?? ""}
            onChange={(event) => onUpdate(person.id, { note: event.target.value })}
          />
        </label>

        <dl className="relations">
          <RelationList label="Parents" people={parents} onFocus={onFocus} />
          <RelationList label="Partners" people={partners} onFocus={onFocus} />
          <RelationList label="Children" people={children} onFocus={onFocus} />
        </dl>

        {partnerships
          .filter((partnership) => partnership.partnerIds.length === 2)
          .map((partnership) => (
            <fieldset key={partnership.id} className="marriage">
              <legend>{partnershipLabel(document, partnership, person.id)}</legend>
              <label className="field">
                Marriage date
                <input
                  type="date"
                  value={partnership.marriageDate ?? ""}
                  onChange={(event) =>
                    onUpdatePartnership(partnership.id, { marriageDate: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Marriage place
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
          <p className="hint">This person already has two parents.</p>
        ) : (
          <RelativeForm
            key={`parent-${person.id}`}
            title="Add parent"
            role="parent"
            document={document}
            personId={person.id}
            partnerships={[]}
            onSubmit={(source) => onAddParent(source)}
          />
        )}
        <RelativeForm
          key={`partner-${person.id}`}
          title="Add partner"
          role="partner"
          document={document}
          personId={person.id}
          partnerships={[]}
          onSubmit={(source) => onAddPartner(source)}
        />
        <RelativeForm
          key={`child-${person.id}`}
          title="Add child"
          role="child"
          document={document}
          personId={person.id}
          partnerships={partnerships.map((partnership) => ({
            id: partnership.id,
            label: partnershipLabel(document, partnership, person.id),
          }))}
          onSubmit={(source, partnershipId) => onAddChild(source, partnershipId)}
        />

        <button type="button" className="danger" onClick={() => onDelete(person.id)}>
          Delete {displayName(person)}
        </button>

        <div className="everyone">
          <h3>Everyone</h3>
          <ul>
            {document.people.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={item.id === person.id ? "person-link current" : "person-link"}
                  aria-current={item.id === person.id ? "true" : undefined}
                  onClick={() => onFocus(item.id)}
                >
                  {personMenuLabel(item)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
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
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {people.length === 0
          ? "None yet"
          : people.map((person) => (
              <button key={person.id} type="button" className="text-link" onClick={() => onFocus(person.id)}>
                {personMenuLabel(person)}
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
              Partnership
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
            <div className="segmented" role="group" aria-label={`${title} source`}>
              <button type="button" aria-pressed={mode === "new"} onClick={() => setMode("new")}>
                New person
              </button>
              <button type="button" aria-pressed={mode === "existing"} onClick={() => setMode("existing")}>
                In this tree
              </button>
            </div>
          ) : null}

          {mode === "existing" && candidates.length > 0 ? (
            <label className="field">
              Person
              <select value={existingId} onChange={(event) => setExistingId(event.target.value)}>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {personMenuLabel(candidate)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="field" htmlFor={`${formId}-given`}>
                Given name
                <input
                  id={`${formId}-given`}
                  value={givenName}
                  onChange={(event) => setGivenName(event.target.value)}
                  autoComplete="off"
                />
              </label>
              <label className="field" htmlFor={`${formId}-family`}>
                Family name
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
