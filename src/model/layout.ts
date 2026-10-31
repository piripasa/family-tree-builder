import { parentPartnershipOf, partnershipsAsPartner } from "./tree";
import type { TreeDocument } from "./types";

export const CARD_WIDTH = 176;
export const CARD_HEIGHT = 78;
export const MAX_GENERATIONS = 4;

const SIBLING_GAP = 36;
const PARTNER_GAP = 22;
const LEVEL_GAP = 168;

export type LayoutCard = {
  personId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isFocus: boolean;
  hiddenUp: boolean;
  hiddenDown: boolean;
};

export type LayoutLine = {
  d: string;
};

export type TreeLayout = {
  cards: LayoutCard[];
  lines: LayoutLine[];
  minX: number;
  minY: number;
  width: number;
  height: number;
};

type ChildSlot = {
  node: DescNode;
  x: number;
};

type DescGroup = {
  partnerId: string | null;
  anchorX: number;
  children: ChildSlot[];
};

type DescNode = {
  personId: string;
  personX: number;
  partners: { id: string; x: number }[];
  groups: DescGroup[];
  width: number;
  hiddenDown: boolean;
};

export function layoutTree(doc: TreeDocument): TreeLayout | null {
  if (!doc.focusId || !doc.people.some((person) => person.id === doc.focusId)) return null;

  const seen = new Set<string>();
  const root = buildDescendant(doc, doc.focusId, 0, seen);
  const cards: LayoutCard[] = [];
  const lines: LayoutLine[] = [];
  placeDescendant(doc, root, 0, 0, doc.focusId, cards, lines);

  const focus = cards.find((card) => card.personId === doc.focusId);
  if (focus) {
    placeAncestors(doc, doc.focusId, focus.x + CARD_WIDTH / 2, focus.y, 0, cards, lines);
  }

  if (cards.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const card of cards) {
    minX = Math.min(minX, card.x);
    minY = Math.min(minY, card.y);
    maxX = Math.max(maxX, card.x + card.width);
    maxY = Math.max(maxY, card.y + card.height);
  }
  const pad = 24;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;

  return {
    cards,
    lines,
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function buildDescendant(
  doc: TreeDocument,
  personId: string,
  depth: number,
  seen: Set<string>,
): DescNode {
  seen.add(personId);
  const hasChildren = partnershipsAsPartner(doc, personId).some(
    (partnership) => partnership.childIds.length > 0,
  );
  if (depth >= MAX_GENERATIONS) {
    return {
      personId,
      personX: 0,
      partners: [],
      groups: [],
      width: CARD_WIDTH,
      hiddenDown: hasChildren,
    };
  }

  const builtGroups: { partnerId: string | null; nodes: DescNode[] }[] = [];
  for (const partnership of partnershipsAsPartner(doc, personId)) {
    const partnerId = partnership.partnerIds.find((id) => id !== personId) ?? null;
    if (partnerId) seen.add(partnerId);
    const nodes: DescNode[] = [];
    if (depth + 1 <= MAX_GENERATIONS) {
      for (const childId of partnership.childIds) {
        if (seen.has(childId)) continue;
        nodes.push(buildDescendant(doc, childId, depth + 1, seen));
      }
    }
    builtGroups.push({ partnerId, nodes });
  }

  return arrangeDescendant(personId, builtGroups);
}

function placeDescendant(
  doc: TreeDocument,
  node: DescNode,
  left: number,
  top: number,
  focusId: string,
  cards: LayoutCard[],
  lines: LayoutLine[],
): number {
  const personX = left + node.personX;
  cards.push(makeCard(doc, node.personId, personX, top, focusId, false, node.hiddenDown));

  for (const partner of node.partners) {
    const partnerX = left + partner.x;
    cards.push(
      makeCard(
        doc,
        partner.id,
        partnerX,
        top,
        focusId,
        hasParents(doc, partner.id),
        false,
      ),
    );
    lines.push({
      d: `M ${personX + CARD_WIDTH / 2} ${top + CARD_HEIGHT} H ${partnerX + CARD_WIDTH / 2}`,
    });
  }

  for (const group of node.groups) {
    const centers: number[] = [];
    for (const child of group.children) {
      centers.push(
        placeDescendant(doc, child.node, left + child.x, top + LEVEL_GAP, focusId, cards, lines),
      );
    }
    if (centers.length > 0) {
      addChildBus(left + group.anchorX, top + CARD_HEIGHT, centers, top + LEVEL_GAP, lines);
    }
  }

  return personX + CARD_WIDTH / 2;
}

function placeAncestors(
  doc: TreeDocument,
  personId: string,
  childCenterX: number,
  childTop: number,
  depth: number,
  cards: LayoutCard[],
  lines: LayoutLine[],
): void {
  if (depth >= MAX_GENERATIONS) return;
  const partnership = parentPartnershipOf(doc, personId);
  if (!partnership) return;

  const parentIds = partnership.partnerIds.filter(
    (id) => !cards.some((card) => card.personId === id),
  );
  if (parentIds.length === 0) return;

  const cardXs = parentCardXs(
    childCenterX,
    parentIds.map((id) => ancestorRowWidth(doc, id, depth + 1)),
  );
  const parentTop = childTop - LEVEL_GAP;
  const placed: { x: number; y: number }[] = [];

  parentIds.forEach((id, index) => {
    const cardX = cardXs[index];
    cards.push(
      makeCard(
        doc,
        id,
        cardX,
        parentTop,
        personId,
        depth + 1 >= MAX_GENERATIONS && hasParents(doc, id),
        false,
      ),
    );
    placed.push({ x: cardX, y: parentTop });
    placeAncestors(doc, id, cardX + CARD_WIDTH / 2, parentTop, depth + 1, cards, lines);
  });

  addParentBus(placed, childCenterX, childTop, lines);
}

function ancestorRowWidth(doc: TreeDocument, personId: string, depth: number): number {
  if (depth >= MAX_GENERATIONS) return 0;
  const partnership = parentPartnershipOf(doc, personId);
  if (!partnership || partnership.partnerIds.length === 0) return 0;
  const above = partnership.partnerIds.map((id) => ancestorRowWidth(doc, id, depth + 1));
  return rowSpan(above);
}

function parentCardXs(childCenterX: number, aboveWidths: number[]): number[] {
  if (aboveWidths.length === 1) return [childCenterX - CARD_WIDTH / 2];
  const gap = coupleGap(aboveWidths);
  const total = aboveWidths.length * CARD_WIDTH + (aboveWidths.length - 1) * gap;
  let cursor = childCenterX - total / 2;
  return aboveWidths.map(() => {
    const cardX = cursor;
    cursor += CARD_WIDTH + gap;
    return cardX;
  });
}

function coupleGap(aboveWidths: number[]): number {
  if (aboveWidths.length < 2 || aboveWidths.some((width) => width <= 0)) return PARTNER_GAP;
  const needed = aboveWidths[0] / 2 + SIBLING_GAP + aboveWidths[1] / 2;
  return Math.max(PARTNER_GAP, needed - CARD_WIDTH);
}

function rowSpan(aboveWidths: number[]): number {
  if (aboveWidths.length === 0) return 0;
  const gap = aboveWidths.length === 1 ? 0 : coupleGap(aboveWidths);
  const widths = aboveWidths.map((width) => Math.max(CARD_WIDTH, width));
  return widths.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * gap;
}

function addParentBus(
  parents: { x: number; y: number }[],
  childCenterX: number,
  childTop: number,
  lines: LayoutLine[],
): void {
  if (parents.length === 0) return;
  const centers = parents.map((parent) => parent.x + CARD_WIDTH / 2);
  const parentBottom = parents[0].y + CARD_HEIGHT;
  const busY = parentBottom + (childTop - parentBottom) / 2;
  if (centers.length === 1 && Math.abs(centers[0] - childCenterX) < 1) {
    lines.push({ d: `M ${centers[0]} ${parentBottom} V ${childTop}` });
    return;
  }
  const left = Math.min(...centers, childCenterX);
  const right = Math.max(...centers, childCenterX);
  for (const center of centers) {
    lines.push({ d: `M ${center} ${parentBottom} V ${busY}` });
  }
  lines.push({ d: `M ${left} ${busY} H ${right}` });
  lines.push({ d: `M ${childCenterX} ${busY} V ${childTop}` });
}

function addChildBus(
  parentMidX: number,
  parentBottom: number,
  childCenters: number[],
  childTop: number,
  lines: LayoutLine[],
): void {
  const busY = parentBottom + (childTop - parentBottom) / 2;
  const left = Math.min(parentMidX, ...childCenters);
  const right = Math.max(parentMidX, ...childCenters);
  lines.push({ d: `M ${parentMidX} ${parentBottom} V ${busY}` });
  if (right - left > 1) lines.push({ d: `M ${left} ${busY} H ${right}` });
  for (const center of childCenters) {
    lines.push({ d: `M ${center} ${busY} V ${childTop}` });
  }
}

function makeCard(
  doc: TreeDocument,
  personId: string,
  x: number,
  y: number,
  focusId: string,
  hiddenUp: boolean,
  hiddenDown: boolean,
): LayoutCard {
  return {
    personId,
    x,
    y,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    isFocus: personId === focusId,
    hiddenUp,
    hiddenDown,
  };
}

function hasParents(doc: TreeDocument, personId: string): boolean {
  return parentPartnershipOf(doc, personId) !== undefined;
}

function arrangeDescendant(
  personId: string,
  builtGroups: { partnerId: string | null; nodes: DescNode[] }[],
): DescNode {
  const solo = builtGroups.filter((group) => group.partnerId === null).flatMap((group) => group.nodes);
  const unions = builtGroups.filter(
    (group): group is { partnerId: string; nodes: DescNode[] } => group.partnerId !== null,
  );
  let personX = 0;
  const partners: { id: string; x: number }[] = [];
  const groups: DescGroup[] = [];

  if (unions.length === 0) {
    const childWidth = rowWidth(solo);
    const width = Math.max(CARD_WIDTH, childWidth);
    personX = (width - CARD_WIDTH) / 2;
    if (solo.length > 0) {
      groups.push(makeGroup(null, solo, (width - childWidth) / 2, personX + CARD_WIDTH / 2));
    }
    return normalizeDescendant(personId, personX, partners, groups);
  }

  const first = unions[0];
  const firstWidth = rowWidth(first.nodes);
  const firstPartnerX = CARD_WIDTH + PARTNER_GAP;
  const firstAnchor = (CARD_WIDTH / 2 + firstPartnerX + CARD_WIDTH / 2) / 2;
  partners.push({ id: first.partnerId, x: firstPartnerX });
  if (first.nodes.length > 0) {
    groups.push(makeGroup(first.partnerId, first.nodes, firstAnchor - firstWidth / 2, firstAnchor));
  }
  let rightEdge = Math.max(firstPartnerX + CARD_WIDTH, CARD_WIDTH);
  if (first.nodes.length > 0) {
    rightEdge = Math.max(rightEdge, firstAnchor - firstWidth / 2 + firstWidth);
  }

  for (const union of unions.slice(1)) {
    const childWidth = rowWidth(union.nodes);
    let cardX = rightEdge + PARTNER_GAP;
    if (union.nodes.length > 0) {
      const naturalLeft = cardX + CARD_WIDTH / 2 - childWidth / 2;
      if (naturalLeft < rightEdge + SIBLING_GAP) {
        cardX += rightEdge + SIBLING_GAP - naturalLeft;
      }
    }
    const anchorX = cardX + CARD_WIDTH / 2;
    partners.push({ id: union.partnerId, x: cardX });
    if (union.nodes.length > 0) {
      const left = anchorX - childWidth / 2;
      groups.push(makeGroup(union.partnerId, union.nodes, left, anchorX));
      rightEdge = Math.max(cardX + CARD_WIDTH, left + childWidth);
    } else {
      rightEdge = cardX + CARD_WIDTH;
    }
  }

  if (solo.length > 0) {
    const childWidth = rowWidth(solo);
    let left = personX + CARD_WIDTH / 2 - childWidth / 2;
    const neighbor = groups[0];
    if (neighbor && left + childWidth + SIBLING_GAP > neighbor.children[0].x) {
      left = neighbor.children[0].x - SIBLING_GAP - childWidth;
    }
    groups.unshift(makeGroup(null, solo, left, left + childWidth / 2));
  }

  return normalizeDescendant(personId, personX, partners, groups);
}

function makeGroup(
  partnerId: string | null,
  nodes: DescNode[],
  left: number,
  anchorX: number,
): DescGroup {
  let childX = left;
  const children: ChildSlot[] = nodes.map((node) => {
    const slot = { node, x: childX };
    childX += node.width + SIBLING_GAP;
    return slot;
  });
  return { partnerId, anchorX, children };
}

function normalizeDescendant(
  personId: string,
  personX: number,
  partners: { id: string; x: number }[],
  groups: DescGroup[],
): DescNode {
  let minX = Math.min(personX, 0);
  let maxX = personX + CARD_WIDTH;
  for (const partner of partners) {
    minX = Math.min(minX, partner.x);
    maxX = Math.max(maxX, partner.x + CARD_WIDTH);
  }
  for (const group of groups) {
    for (const child of group.children) {
      minX = Math.min(minX, child.x);
      maxX = Math.max(maxX, child.x + child.node.width);
    }
  }

  const shift = -minX;
  return {
    personId,
    personX: personX + shift,
    partners: partners.map((partner) => ({ ...partner, x: partner.x + shift })),
    groups: groups.map((group) => ({
      ...group,
      anchorX: group.anchorX + shift,
      children: group.children.map((child) => ({ ...child, x: child.x + shift })),
    })),
    width: Math.max(CARD_WIDTH, maxX - minX),
    hiddenDown: false,
  };
}

function rowWidth(nodes: DescNode[]): number {
  if (nodes.length === 0) return 0;
  return nodes.reduce((sum, node) => sum + node.width, 0) + (nodes.length - 1) * SIBLING_GAP;
}
