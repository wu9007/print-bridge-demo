import heiUrl from "../assets/HEI.TTF?url";

/** 机内字体不可靠：汉字、≤、℃ 等非 ASCII。 */
const NEEDS_RASTER = /[^\x00-\x7F]/;
/** 中间只吃 ^A / ^BY / ^CI 等。允许 Bartender 的换行，在第一个 ^FD 停。 */
const FIELD =
  /\^(FO|FT)(-?\d+),(-?\d+)((?:\s*\^(?!FD|FS|FO|FT|XA|XZ)[^^]+)*)\s*\^FD([^^]*)\^FS/g;
const FONT_SIZE = /\^A[@0-9A-Za-z][^,]*,(\d+)/;
const BOX_BEFORE = /\^FO-?\d+,-?\d+\s*\^GB(\d+),(\d+),[^^]*\^FS\s*$/;

const FONT_ID = "LabelHei";
const INK_THRESHOLD = 520;
const MAX_TEXT_WIDTH = 800;
const DEFAULT_FONT_SIZE = 24;
let fontFace: FontFace | null = null;

async function ensureLabelFont(): Promise<string> {
  if (fontFace) {
    return FONT_ID;
  }
  try {
    const face = new FontFace(FONT_ID, `url(${heiUrl})`);
    fontFace = await face.load();
    document.fonts.add(fontFace);
    await document.fonts.ready;
    return FONT_ID;
  } catch {
    fontFace = null;
    return '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
  }
}

function needsRaster(text: string): boolean {
  return NEEDS_RASTER.test(text);
}

function packMonoBitmap(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): { bytes: Uint8Array; bytesPerRow: number } {
  const bytesPerRow = Math.ceil(width / 8);
  const bytes = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (pixels[i] + pixels[i + 1] + pixels[i + 2] < INK_THRESHOLD) {
        bytes[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  return { bytes, bytesPerRow };
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, "0").toUpperCase();
  }
  return hex;
}

function fontSizeFromCommands(commands: string): number {
  const match = commands.match(FONT_SIZE);
  const size = match ? Number(match[1]) : DEFAULT_FONT_SIZE;
  return Number.isFinite(size) && size > 0 ? size : DEFAULT_FONT_SIZE;
}

function isBarcodeField(commands: string): boolean {
  return /\^B[A-Z0-9]/i.test(commands);
}

type Orient = "N" | "R" | "I" | "B";

function orientationFromCommands(commands: string): Orient {
  const match = commands.match(/\^A[@0-9A-Za-z]([NRIB])/i);
  const value = match?.[1]?.toUpperCase();
  return value === "R" || value === "I" || value === "B" ? value : "N";
}

function rotateCanvas(source: HTMLCanvasElement, orient: Orient): HTMLCanvasElement {
  if (orient === "N") {
    return source;
  }
  const dest = document.createElement("canvas");
  const swap = orient === "R" || orient === "B";
  dest.width = swap ? source.height : source.width;
  dest.height = swap ? source.width : source.height;
  const ctx = dest.getContext("2d");
  if (!ctx) {
    throw new Error("无法创建画布");
  }
  if (orient === "R") {
    ctx.translate(dest.width, 0);
    ctx.rotate(Math.PI / 2);
  } else if (orient === "I") {
    ctx.translate(dest.width, dest.height);
    ctx.rotate(Math.PI);
  } else {
    ctx.translate(0, dest.height);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.drawImage(source, 0, 0);
  return dest;
}

function fieldOrigin(
  kind: string,
  x: string,
  y: string,
  height: number,
  orient: Orient,
  boxPos: RegExpMatchArray | null,
): string {
  if (boxPos) {
    return `^FO${boxPos[1]},${boxPos[2]}`;
  }
  const left = Number(x);
  const top = Number(y);
  // 正放 ^FT 是基线，^GFA 要上移图高。旋转字段钉在原 ^FT，不再按图高挪。
  if (kind === "FT" && orient === "N") {
    return `^FO${left},${top - height}`;
  }
  return `^FO${left},${top}`;
}

async function textToGfa(
  text: string,
  fontSize: number,
  fontFamily: string,
  opts: { invert?: boolean; minWidth?: number; minHeight?: number; orient?: Orient } = {},
): Promise<{ command: string; height: number }> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("无法创建画布");
  }
  ctx.font = `${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text);
  const ascent = Math.ceil(Math.max(metrics.actualBoundingBoxAscent || fontSize * 0.8, 1));
  const descent = Math.ceil(Math.max(metrics.actualBoundingBoxDescent || fontSize * 0.2, 1));
  const textWidth = Math.min(Math.ceil(metrics.width + 2), MAX_TEXT_WIDTH);
  const width = Math.max(8, Math.ceil(Math.max(textWidth, opts.minWidth ?? 0) / 8) * 8);
  const height = Math.max(8, ascent + descent + 2, opts.minHeight ?? 0);
  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = opts.invert ? "#000" : "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = opts.invert ? "#fff" : "#000";
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "alphabetic";
  const textY = opts.minHeight ? Math.floor((height + ascent - descent) / 2) : ascent + 1;
  ctx.fillText(text, 8, textY);
  const oriented = rotateCanvas(canvas, opts.orient ?? "N");
  const { bytes, bytesPerRow } = packMonoBitmap(
    oriented.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, oriented.width, oriented.height).data,
    oriented.width,
    oriented.height,
  );
  const hex = toHex(bytes);
  return {
    command: `^GFA,${bytes.length},${bytes.length},${bytesPerRow},${hex}`,
    height: oriented.height,
  };
}

/** 含非 ASCII 的文字字段画成 ^GFA。条码和纯英文不动。 */
export async function rasterizeCjkFields(zpl: string): Promise<string> {
  const fontFamily = await ensureLabelFont();
  const pending: Array<{ match: string; replacement: Promise<string> }> = [];
  FIELD.lastIndex = 0;
  for (const match of zpl.matchAll(FIELD)) {
    const [all, kind, x, y, commands, text] = match;
    if (!text || isBarcodeField(commands) || !needsRaster(text)) {
      continue;
    }
    const size = fontSizeFromCommands(commands);
    const invert = /\^FR/i.test(commands);
    const orient = orientationFromCommands(commands);
    const prefix = zpl.slice(0, match.index ?? 0);
    const box = invert ? prefix.match(BOX_BEFORE) : null;
    const boxPos = box ? box[0].match(/\^FO(-?\d+),(-?\d+)/) : null;
    pending.push({
      match: `${box?.[0] ?? ""}${all}`,
      replacement: textToGfa(text, size, fontFamily, {
        invert,
        orient,
        minWidth: box ? Number(box[1]) : undefined,
        minHeight: box ? Number(box[2]) : undefined,
      }).then((graphic) => {
        const origin = fieldOrigin(kind, x, y, graphic.height, orient, boxPos);
        return `${origin}${graphic.command}^FS`;
      }),
    });
  }
  let next = zpl;
  for (const item of pending) {
    next = next.replace(item.match, await item.replacement);
  }
  return next;
}

function looksLikeZpl(bytes: Uint8Array): boolean {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 200));
  return head.includes("^XA") || head.includes("^FO") || head.includes("^FT");
}

function isUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/** 文本 ZPL 才能画非 ASCII。~DG / ~DY 或非法 UTF-8 走原字节。 */
export function shouldRasterizeZpl(bytes: Uint8Array): boolean {
  if (!looksLikeZpl(bytes) || !isUtf8(bytes)) {
    return false;
  }
  const text = new TextDecoder("latin1").decode(bytes);
  return !/~D[GY]/i.test(text);
}
