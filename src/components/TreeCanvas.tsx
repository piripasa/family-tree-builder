"use client";

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { personName, personYears } from "@/i18n/format";
import { useI18n } from "@/i18n/I18nProvider";
import { CARD_HEIGHT, CARD_WIDTH, layoutTree, type TreeLayout } from "@/model/layout";
import { getPerson } from "@/model/tree";
import { isHiddenOnShare } from "@/model/share";
import type { TreeDocument } from "@/model/types";

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
  const viewRef = useRef<View>({ x: 40, y: 40, scale: 1 });
  const [view, setView] = useState<View>(viewRef.current);
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

  return (
    <div className="canvas-wrap">
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
              const textX = person.photo ? 56 : 16;
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
                  onClick={() => onFocus(card.personId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onFocus(card.personId);
                    }
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <title>{label}</title>
                  <rect width={card.width} height={card.height} rx="12" />
                  {person.photo ? (
                    <>
                      <clipPath id={`photo-${card.personId}`}>
                        <circle cx="28" cy={CARD_HEIGHT / 2} r="16" />
                      </clipPath>
                      <image
                        href={person.photo}
                        x="12"
                        y={CARD_HEIGHT / 2 - 16}
                        width="32"
                        height="32"
                        clipPath={`url(#photo-${card.personId})`}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    </>
                  ) : null}
                  <text x={textX} y={span ? 28 : family ? 36 : 50} className="card-given">
                    {truncate(given, person.photo ? 13 : 18)}
                  </text>
                  {family ? (
                    <text x={textX} y={span ? 48 : 58} className="card-family">
                      {truncate(family, person.photo ? 16 : 22)}
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
    </div>
  );
});

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
