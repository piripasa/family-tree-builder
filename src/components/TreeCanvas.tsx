"use client";

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PersonPortrait, Avatar } from "@/components/PersonPortrait";
import { personName, personYears } from "@/i18n/format";
import { useI18n } from "@/i18n/I18nProvider";
import type { Messages } from "@/i18n/en";
import { CARD_HEIGHT, CARD_WIDTH, layoutTree, type TreeLayout } from "@/model/layout";
import { portraitKind } from "@/model/portrait";
import { getPerson, isAlive } from "@/model/tree";
import { isHiddenOnShare } from "@/model/share";
import type { Person, TreeDocument } from "@/model/types";

export type TreeCanvasHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
};

type View = { x: number; y: number; scale: number };

const MIN_SCALE = 0.2;
const MAX_SCALE = 2.5;

export const TreeCanvas = forwardRef<
  TreeCanvasHandle,
  { document: TreeDocument; onFocus: (personId: string) => void }
>(function TreeCanvas({ document, onFocus }, ref) {
  const { messages } = useI18n();
  const layout = useMemo(() => layoutTree(document), [document]);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipCard = useRef<SVGGraphicsElement | null>(null);
  const tipTimer = useRef<number | null>(null);
  const viewRef = useRef<View>({ x: 40, y: 40, scale: 1 });
  const [view, setView] = useState<View>(viewRef.current);
  const [tipId, setTipId] = useState<string | null>(null);
  const [tipPlace, setTipPlace] = useState<TipPlace | null>(null);
  const signature = layout
    ? `${document.focusId}:${layout.cards.map((card) => card.personId).join(",")}`
    : "";

  function updateView(next: View) {
    viewRef.current = next;
    setView(next);
  }

  function fit() {
    const svg = svgRef.current;
    if (!svg || !layout) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    updateView(fitView(rect.width, rect.height, layout));
  }

  function zoom(factor: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    updateView(zoomAt(viewRef.current, rect.left + rect.width / 2, rect.top + rect.height / 2, rect, factor));
  }

  useImperativeHandle(ref, () => ({
    zoomIn: () => zoom(1.2),
    zoomOut: () => zoom(1 / 1.2),
    fit,
  }));

  useLayoutEffect(() => {
    fit();
    // Refit when the visible people change, not when a name is edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    setTipId(null);
    tipCard.current = null;
  }, [signature]);

  useEffect(() => {
    return () => {
      if (tipTimer.current != null) window.clearTimeout(tipTimer.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (!tipId || !tipCard.current || !wrapRef.current) return;
    const tip = wrapRef.current.querySelector(".person-tip");
    const next = placeTip(tipCard.current, wrapRef.current, tip);
    setTipPlace((current) => (samePlace(current, next) ? current : next));
  }, [tipId, view]);

  function showTip(card: SVGGraphicsElement, personId: string) {
    if (tipTimer.current != null) window.clearTimeout(tipTimer.current);
    tipTimer.current = window.setTimeout(() => {
      tipCard.current = card;
      setTipId(personId);
      setTipPlace(placeTip(card, wrapRef.current, null));
    }, 280);
  }

  function hideTip() {
    if (tipTimer.current != null) window.clearTimeout(tipTimer.current);
    tipTimer.current = null;
    tipCard.current = null;
    setTipId(null);
  }

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = svg!.getBoundingClientRect();
      const factor = event.deltaY < 0 ? 1.1 : 0.9;
      const next = zoomAt(viewRef.current, event.clientX, event.clientY, rect, factor);
      viewRef.current = next;
      setView(next);
    }
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [signature]);

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest(".person-card")) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = viewRef.current;
    event.currentTarget.setPointerCapture(event.pointerId);

    function onMove(move: PointerEvent) {
      const next = {
        ...origin,
        x: origin.x + (move.clientX - startX),
        y: origin.y + (move.clientY - startY),
      };
      viewRef.current = next;
      setView(next);
    }
    function onUp(up: PointerEvent) {
      svgRef.current?.releasePointerCapture(up.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const tipped = tipId ? getPerson(document, tipId) : undefined;

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <svg
        ref={svgRef}
        className="tree-svg"
        role="application"
        aria-label={messages.canvas.label}
        onPointerDown={onPointerDown}
      >
        <rect className="pan-surface" width="100%" height="100%" />
        {layout ? (
          <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            {layout.lines.map((line, index) => (
              <g key={index}>
                <path d={line.d} className="tree-line" />
                {line.label != null && line.labelX != null && line.labelY != null ? (
                  <text x={line.labelX} y={line.labelY} className="tree-label">
                    {marriageLabel(line.label, messages)}
                  </text>
                ) : null}
              </g>
            ))}
            {layout.cards.map((card, index) => {
              const person = getPerson(document, card.personId);
              if (!person) return null;
              const hidden = isHiddenOnShare(person);
              const family = hidden ? "" : person.familyName.trim();
              const given = hidden ? messages.living : person.givenName.trim() || messages.unnamed;
              const span = personYears(person, messages);
              const kind = portraitKind(person);
              const textX = 56;
              const label = [personName(person, messages), span].filter(Boolean).join(", ");
              return (
                <g
                  key={`${card.personId}-${index}`}
                  className={card.isFocus ? "person-card is-focus" : "person-card"}
                  transform={`translate(${card.x} ${card.y})`}
                  tabIndex={0}
                  role="button"
                  aria-pressed={card.isFocus}
                  aria-label={label}
                  onPointerEnter={(event) => showTip(event.currentTarget, card.personId)}
                  onPointerLeave={hideTip}
                  onClick={() => onFocus(card.personId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onFocus(card.personId);
                    }
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <rect width={card.width} height={card.height} rx="12" />
                  <g transform={`translate(12 ${CARD_HEIGHT / 2 - 16})`} aria-hidden="true">
                    {kind === "photo" ? (
                      <>
                        <clipPath id={`photo-${card.personId}-${index}`}>
                          <circle cx="16" cy="16" r="16" />
                        </clipPath>
                        <image
                          href={person.photo}
                          x="0"
                          y="0"
                          width="32"
                          height="32"
                          clipPath={`url(#photo-${card.personId}-${index})`}
                          preserveAspectRatio="xMidYMid slice"
                        />
                      </>
                    ) : (
                      <Avatar kind={kind} />
                    )}
                  </g>
                  <text x={textX} y={span ? 28 : family ? 36 : 50} className="card-given">
                    {truncate(given, 13)}
                  </text>
                  {family ? (
                    <text x={textX} y={span ? 48 : 58} className="card-family">
                      {truncate(family, 16)}
                    </text>
                  ) : null}
                  {span ? (
                    <text x={textX} y="72" className="card-span">
                      {span}
                    </text>
                  ) : null}
                  {card.hiddenUp ? (
                    <circle cx={CARD_WIDTH / 2} cy={-8} r="3.5" className="more-mark">
                      <title>{messages.canvas.moreAncestors}</title>
                    </circle>
                  ) : null}
                  {card.hiddenDown ? (
                    <circle cx={CARD_WIDTH / 2} cy={CARD_HEIGHT + 8} r="3.5" className="more-mark">
                      <title>{messages.canvas.moreDescendants}</title>
                    </circle>
                  ) : null}
                </g>
              );
            })}
          </g>
        ) : null}
      </svg>
      {tipped && tipPlace ? (
        <div
          className={`person-tip ${tipPlace.side}`}
          style={{ left: tipPlace.left, top: tipPlace.top }}
          role="tooltip"
        >
          <div className="tip-head">
            <PersonPortrait person={tipped} size={40} />
            <div>
              <strong>{personName(tipped, messages)}</strong>
              {isAlive(tipped) ? <p className="tip-alive">{messages.profile.alive}</p> : null}
            </div>
          </div>
          <ProfileFacts person={tipped} messages={messages} />
        </div>
      ) : null}
    </div>
  );
});

type TipPlace = { left: number; top: number; side: "left" | "right" | "above" | "below" };

function ProfileFacts({ person, messages }: { person: Person; messages: Messages }) {
  if (isHiddenOnShare(person)) return null;
  const facts: { label: string; value: string }[] = [];
  if (person.gender === "male" || person.gender === "female" || person.gender === "other") {
    facts.push({ label: messages.profile.gender, value: messages.profile[person.gender] });
  }
  if (person.birthDate) facts.push({ label: messages.profile.birthDate, value: person.birthDate });
  if (person.birthPlace) facts.push({ label: messages.profile.birthPlace, value: person.birthPlace });
  if (person.deathDate) facts.push({ label: messages.profile.deathDate, value: person.deathDate });
  if (person.deathPlace) facts.push({ label: messages.profile.deathPlace, value: person.deathPlace });
  if (person.email) facts.push({ label: messages.profile.email, value: person.email });
  if (person.phone) facts.push({ label: messages.profile.phone, value: person.phone });
  for (const social of person.socials ?? []) {
    facts.push({ label: messages.profile.socials[social.network], value: social.url });
  }
  if (person.note?.trim()) facts.push({ label: messages.profile.note, value: person.note.trim() });
  if (facts.length === 0) return null;
  return (
    <dl>
      {facts.map((fact) => (
        <div key={`${fact.label}:${fact.value}`}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function placeTip(card: SVGGraphicsElement, wrap: HTMLElement | null, tip: Element | null): TipPlace | null {
  if (!wrap) return null;
  const bounds = card.getBoundingClientRect();
  const frame = wrap.getBoundingClientRect();
  if (bounds.width < 1 || frame.width < 1) return null;
  const measured = tip?.getBoundingClientRect();
  const tipW = measured && measured.width > 1 ? measured.width : 220;
  const tipH = measured && measured.height > 1 ? measured.height : 120;
  const gap = 10;
  const others = [...wrap.querySelectorAll(".person-card")]
    .filter((item) => item !== card)
    .map((item) => item.getBoundingClientRect());
  const sides: TipPlace["side"][] = ["right", "left", "above", "below"];
  let best: { place: TipPlace; cost: number } | null = null;
  for (const side of sides) {
    const anchor = anchorFor(side, bounds, frame, gap);
    const box = tipBox(side, anchor, frame, tipW, tipH);
    const cost = coverage(box, frame, others);
    if (!best || cost < best.cost) best = { place: { ...anchor, side }, cost };
  }
  return best?.place ?? null;
}

function anchorFor(
  side: TipPlace["side"],
  bounds: DOMRect,
  frame: DOMRect,
  gap: number,
): { left: number; top: number } {
  if (side === "right") return { left: bounds.right - frame.left + gap, top: bounds.top - frame.top };
  if (side === "left") return { left: bounds.left - frame.left - gap, top: bounds.top - frame.top };
  if (side === "above") return { left: bounds.left - frame.left + bounds.width / 2, top: bounds.top - frame.top - gap };
  return { left: bounds.left - frame.left + bounds.width / 2, top: bounds.bottom - frame.top + gap };
}

function tipBox(
  side: TipPlace["side"],
  anchor: { left: number; top: number },
  frame: DOMRect,
  tipW: number,
  tipH: number,
): DOMRect {
  const left =
    side === "left" ? frame.left + anchor.left - tipW : side === "right" ? frame.left + anchor.left : frame.left + anchor.left - tipW / 2;
  const top = side === "above" ? frame.top + anchor.top - tipH : frame.top + anchor.top;
  return new DOMRect(left, top, tipW, tipH);
}

function coverage(box: DOMRect, frame: DOMRect, others: DOMRect[]): number {
  const outside =
    Math.max(0, frame.left + 8 - box.left) +
    Math.max(0, box.right - (frame.right - 8)) +
    Math.max(0, frame.top + 8 - box.top) +
    Math.max(0, box.bottom - (frame.bottom - 8));
  const covered = others.reduce((sum, other) => sum + intersection(box, other), 0);
  return outside * 1000 + covered;
}

function intersection(a: DOMRect, b: DOMRect): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}

function samePlace(current: TipPlace | null, next: TipPlace | null): boolean {
  if (current === next) return true;
  if (!current || !next) return false;
  return current.side === next.side && Math.abs(current.left - next.left) < 0.5 && Math.abs(current.top - next.top) < 0.5;
}

function marriageLabel(label: string, messages: ReturnType<typeof useI18n>["messages"]): string {
  const married = /^m\. (\d{4})$/.exec(label);
  return married ? messages.canvas.married(married[1]) : label;
}

function fitView(viewportW: number, viewportH: number, layout: TreeLayout): View {
  const pad = 48;
  const scale = clamp(
    Math.min((viewportW - pad * 2) / layout.width, (viewportH - pad * 2) / layout.height),
    MIN_SCALE,
    1.35,
  );
  return {
    scale,
    x: (viewportW - layout.width * scale) / 2 - layout.minX * scale,
    y: (viewportH - layout.height * scale) / 2 - layout.minY * scale,
  };
}

function zoomAt(view: View, clientX: number, clientY: number, rect: DOMRect, factor: number): View {
  const nextScale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  const worldX = (px - view.x) / view.scale;
  const worldY = (py - view.y) / view.scale;
  return {
    scale: nextScale,
    x: px - worldX * nextScale,
    y: py - worldY * nextScale,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
