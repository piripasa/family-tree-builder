import { CARD_HEIGHT, CARD_WIDTH, layoutTree } from "./layout";
import { displayName, getPerson, lifeSpan } from "./tree";
import type { TreeDocument } from "./types";

const MAX_PT_PER_PIXEL = 0.75;
const MIN_PT_PER_PIXEL = 0.36;
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const PAGE_MARGIN = 28;
const PAGE_FOOTER = 36;

export async function downloadTreeImage(tree: TreeDocument, title: string): Promise<void> {
  const canvas = await rasterizeTree(tree, title);
  saveBlob(await canvasBlob(canvas, "image/png"), `${fileSlug(title)}.png`);
}

export async function downloadTreePdf(tree: TreeDocument, title: string): Promise<void> {
  const canvas = await rasterizeTree(tree, title);
  const slices = await pageSlices(canvas);
  const pdf = buildPdf(slices, title.trim() || "Family tree", slices[0]?.ptPerPixel ?? MAX_PT_PER_PIXEL);
  saveBlob(new Blob([copyBytes(pdf)], { type: "application/pdf" }), `${fileSlug(title)}.pdf`);
}

async function rasterizeTree(tree: TreeDocument, title: string): Promise<HTMLCanvasElement> {
  const picture = treeSvg(tree, title);
  if (!picture) throw new Error("The picture could not be created.");
  const url = URL.createObjectURL(new Blob([picture.svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = await loadImage(url);
    const canvas = window.document.createElement("canvas");
    canvas.width = picture.width;
    canvas.height = picture.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The picture could not be created.");
    context.drawImage(image, 0, 0, picture.width, picture.height);
    await drawPhotos(context, tree, picture);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function treeSvg(tree: TreeDocument, title: string): Picture | null {
  const layout = layoutTree(tree, Number.POSITIVE_INFINITY);
  if (!layout) return null;
  const titleBand = 44;
  const extra = 16;
  const x = layout.minX - extra;
  const y = layout.minY - titleBand;
  const width = layout.width + extra * 2;
  const height = layout.height + titleBand + extra;
  const scale = Math.min(2, 4096 / Math.max(width, height));
  const pixelWidth = Math.max(1, Math.ceil(width * scale));
  const pixelHeight = Math.max(1, Math.ceil(height * scale));
  const cards = layout.cards.map((card) => {
    const person = getPerson(tree, card.personId);
    if (!person) return "";
    const family = person.familyName.trim();
    const given = person.givenName.trim() || "Unnamed";
    const span = lifeSpan(person);
    const textX = person.photo ? 56 : 16;
    const stroke = card.isFocus ? `stroke="#234237" stroke-width="2.5"` : `stroke="#ddd4c6" stroke-width="1.5"`;
    const photo = person.photo
      ? `<circle cx="28" cy="${CARD_HEIGHT / 2}" r="16" fill="#e7e0d4"/>`
      : "";
    const familyText = family
      ? `<text x="${textX}" y="${span ? 48 : 58}" fill="#6f675c" font-size="13" font-family="Palatino, Georgia, serif">${xml(truncate(family, person.photo ? 16 : 22))}</text>`
      : "";
    const spanText = span
      ? `<text x="${textX}" y="72" fill="#6f675c" font-size="13" font-family="Palatino, Georgia, serif">${xml(span)}</text>`
      : "";
    const hiddenUp = card.hiddenUp
      ? `<circle cx="${CARD_WIDTH / 2}" cy="-8" r="3.5" fill="#234237"/>`
      : "";
    const hiddenDown = card.hiddenDown
      ? `<circle cx="${CARD_WIDTH / 2}" cy="${CARD_HEIGHT + 8}" r="3.5" fill="#234237"/>`
      : "";
    return `<g transform="translate(${card.x} ${card.y})"><rect width="${card.width}" height="${card.height}" rx="12" fill="#fffdf8" ${stroke}/>${photo}<text x="${textX}" y="${span ? 28 : family ? 36 : 50}" fill="#1e1a14" font-size="16" font-family="Palatino, Georgia, serif">${xml(truncate(given, person.photo ? 13 : 18))}</text>${familyText}${spanText}${hiddenUp}${hiddenDown}</g>`;
  });
  const lines = layout.lines
    .map(
      (line) =>
        `<path d="${line.d}" fill="none" stroke="#8d8374" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`,
    )
    .join("");
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}" viewBox="${x} ${y} ${width} ${height}">`,
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#f3efe6"/>`,
    `<text x="${x + 8}" y="${y + 28}" fill="#234237" font-size="22" font-family="Palatino, Georgia, serif">${xml(title.trim() || "Family tree")}</text>`,
    lines,
    cards.join(""),
    `</svg>`,
  ].join("");
  return { svg, width: pixelWidth, height: pixelHeight, x, y, viewWidth: width, viewHeight: height };
}

type Picture = {
  svg: string;
  width: number;
  height: number;
  x: number;
  y: number;
  viewWidth: number;
  viewHeight: number;
};

async function drawPhotos(context: CanvasRenderingContext2D, tree: TreeDocument, picture: Picture): Promise<void> {
  const layout = layoutTree(tree, Number.POSITIVE_INFINITY);
  if (!layout) return;
  const scaleX = picture.width / picture.viewWidth;
  const scaleY = picture.height / picture.viewHeight;
  for (const card of layout.cards) {
    const person = getPerson(tree, card.personId);
    if (!person?.photo) continue;
    const image = await loadImage(person.photo);
    const size = 32 * scaleX;
    const centerX = (card.x + 28 - picture.x) * scaleX;
    const centerY = (card.y + CARD_HEIGHT / 2 - picture.y) * scaleY;
    const cover = Math.max(size / image.width, size / image.height);
    context.save();
    context.beginPath();
    context.arc(centerX, centerY, 16 * scaleX, 0, Math.PI * 2);
    context.clip();
    context.drawImage(image, centerX - (image.width * cover) / 2, centerY - (image.height * cover) / 2, image.width * cover, image.height * cover);
    context.restore();
  }
}

async function pageSlices(canvas: HTMLCanvasElement): Promise<PageSlice[]> {
  const contentWidth = PAGE_WIDTH - PAGE_MARGIN * 2;
  const contentHeight = PAGE_HEIGHT - PAGE_MARGIN - PAGE_FOOTER;
  const fit = Math.min(contentWidth / canvas.width, contentHeight / canvas.height);
  const ptPerPixel = Math.min(MAX_PT_PER_PIXEL, Math.max(fit, MIN_PT_PER_PIXEL));
  const tileWidth = Math.floor(contentWidth / ptPerPixel);
  const tileHeight = Math.floor(contentHeight / ptPerPixel);
  const columns = tileStarts(canvas.width, tileWidth, 24);
  const rows = tileStarts(canvas.height, tileHeight, 24);
  const slices: PageSlice[] = [];
  for (const top of rows) {
    for (const left of columns) {
      const width = Math.min(tileWidth, canvas.width - left);
      const height = Math.min(tileHeight, canvas.height - top);
      const tile = window.document.createElement("canvas");
      tile.width = width;
      tile.height = height;
      const context = tile.getContext("2d");
      if (!context) throw new Error("The PDF could not be created.");
      context.fillStyle = "#f3efe6";
      context.fillRect(0, 0, width, height);
      context.drawImage(canvas, left, top, width, height, 0, 0, width, height);
      const jpeg = new Uint8Array(await (await canvasBlob(tile, "image/jpeg", 0.92)).arrayBuffer());
      slices.push({ jpeg, width, height, ptPerPixel });
    }
  }
  return slices;
}

type PageSlice = { jpeg: Uint8Array; width: number; height: number; ptPerPixel: number };

function buildPdf(slices: PageSlice[], title: string, ptPerPixel: number): Uint8Array {
  const objects: PdfObject[] = [
    { head: "<< /Type /Catalog /Pages 2 0 R >>" },
    {
      head: `<< /Type /Pages /Kids [${slices.map((_, index) => `${4 + index * 3} 0 R`).join(" ")}] /Count ${slices.length} >>`,
    },
    { head: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" },
  ];
  slices.forEach((slice, index) => {
    const pageId = 4 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const drawWidth = slice.width * ptPerPixel;
    const drawHeight = slice.height * ptPerPixel;
    const contentWidth = PAGE_WIDTH - PAGE_MARGIN * 2;
    const contentTop = PAGE_HEIGHT - PAGE_MARGIN;
    const contentHeight = contentTop - PAGE_FOOTER;
    const single = slices.length === 1;
    const x = single ? PAGE_MARGIN + Math.max(0, (contentWidth - drawWidth) / 2) : PAGE_MARGIN;
    const imageTop = single ? contentTop - Math.max(0, (contentHeight - drawHeight) / 2) : contentTop;
    const y = imageTop - drawHeight;
    const label = pdfText(`${title}  ·  ${index + 1} / ${slices.length}`);
    const content = [
      "0.953 0.937 0.902 rg",
      `0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`,
      "q",
      `${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm`,
      `/Im${index} Do`,
      "Q",
      "BT",
      "/F1 9 Tf",
      "0.137 0.259 0.216 rg",
      `28 18 Td (${label}) Tj`,
      "ET",
    ].join("\n");
    const stream = new TextEncoder().encode(content);
    objects[pageId - 1] = {
      head: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> /XObject << /Im${index} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    };
    objects[contentId - 1] = { head: `<< /Length ${stream.length} >>`, stream };
    objects[imageId - 1] = {
      head: `<< /Type /XObject /Subtype /Image /Width ${slice.width} /Height ${slice.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${slice.jpeg.length} >>`,
      stream: slice.jpeg,
    };
  });
  return encodePdf(objects);
}

type PdfObject = { head: string; stream?: Uint8Array };

function encodePdf(objects: PdfObject[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets = [0];
  let length = 0;
  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    length += bytes.length;
  };
  const pushText = (value: string) => push(encoder.encode(value));
  pushText("%PDF-1.4\n");
  objects.forEach((object, index) => {
    offsets.push(length);
    const id = index + 1;
    if (!object.stream) {
      pushText(`${id} 0 obj\n${object.head}\nendobj\n`);
      return;
    }
    pushText(`${id} 0 obj\n${object.head}\nstream\n`);
    push(object.stream);
    pushText("\nendstream\nendobj\n");
  });
  const xref = length;
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    table += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pushText(table);
  pushText(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const output = new Uint8Array(length);
  let cursor = 0;
  for (const chunk of chunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}

function tileStarts(total: number, tile: number, overlap: number): number[] {
  if (total <= tile) return [0];
  const step = Math.max(1, tile - overlap);
  const starts: number[] = [];
  for (let cursor = 0; cursor < total; cursor += step) {
    starts.push(cursor);
    if (cursor + tile >= total) break;
  }
  return starts;
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The picture could not be created."));
      },
      type,
      quality,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The picture could not be created."));
    image.src = src;
  });
}

function copyBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function fileSlug(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "family-tree";
}

function pdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .slice(0, 90);
}

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
