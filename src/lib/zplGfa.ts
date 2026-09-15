import heiUrl from "../assets/HEI.TTF?url";

/** 机内字体不可靠：汉字、≤、℃ 等非 ASCII。 */
const NEEDS_RASTER = /[^\x00-\x7F]/;
/** 中间只吃 ^A / ^BY / ^CI 等。允许 Bartender 的换行，在第一个 ^FD 停。 */
const FIELD =
  /\^(FO|FT)(-?\d+),(-?\d+)((?:\s*\^(?!FD|FS|FO|FT|XA|XZ)[^^]+)*)\s*\^FD([^^]*)\^FS/g;
const FONT = /\^A[@0-9A-Za-z][^,]*,(\d+)(?:,(\d+))?/i;
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

/** `^A0N,43,35` → 高 43、宽 35。宽为 0 表示按字体比例，不拉扁。 */
function fontFromCommands(commands: string): { height: number; width: number } {
  const match = commands.match(FONT);
  const height = Number(match?.[1]);
  const width = Number(match?.[2]);
  return {
    height: Number.isFinite(height) && height > 0 ? height : DEFAULT_FONT_SIZE,
    width: Number.isFinite(width) && width > 0 ? width : 0,
  };
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

function inkBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (pixels[i] + pixels[i + 1] + pixels[i + 2] < INK_THRESHOLD) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

/** 裁到墨水，去掉画字时的边距，让 ^FO 对上字的左上角。 */
function cropToInk(source: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = source.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return source;
  }
  const { width, height } = source;
  const box = inkBounds(ctx.getImageData(0, 0, width, height).data, width, height);
  if (!box) {
    return source;
  }
  const cropW = box.maxX - box.minX + 1;
  const cropH = box.maxY - box.minY + 1;
  const dest = document.createElement("canvas");
  dest.width = Math.max(8, Math.ceil(cropW / 8) * 8);
  dest.height = Math.max(8, cropH);
  const destCtx = dest.getContext("2d");
  if (!destCtx) {
    throw new Error("无法创建画布");
  }
  destCtx.fillStyle = "#fff";
  destCtx.fillRect(0, 0, dest.width, dest.height);
  destCtx.drawImage(source, box.minX, box.minY, cropW, cropH, 0, 0, cropW, cropH);
  return dest;
}

async function textToGfa(
  text: string,
  fontSize: number,
  fontFamily: string,
  opts: {
    invert?: boolean;
    minWidth?: number;
    minHeight?: number;
    orient?: Orient;
    charWidth?: number;
  } = {},
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
  const chars = Math.max([...text].length, 1);
  const naturalWidth = Math.max(metrics.width, 1);
  const targetWidth =
    opts.charWidth && opts.charWidth > 0
      ? Math.min(opts.charWidth * chars, MAX_TEXT_WIDTH)
      : Math.min(naturalWidth, MAX_TEXT_WIDTH);
  const scaleX = targetWidth / naturalWidth;
  const pad = 8;
  const boxed = Boolean(opts.invert || opts.minWidth || opts.minHeight);
  const width = Math.max(8, Math.ceil(Math.max(targetWidth + pad * 2, opts.minWidth ?? 0) / 8) * 8);
  const height = Math.max(8, ascent + descent + 2, opts.minHeight ?? 0);
  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = opts.invert ? "#000" : "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = opts.invert ? "#fff" : "#000";
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "alphabetic";
  const textY = opts.minHeight ? Math.floor((height + ascent - descent) / 2) : ascent + 1;
  const originX = boxed ? Math.max(0, (width - targetWidth) / 2) : pad;
  ctx.setTransform(scaleX, 0, 0, 1, originX, 0);
  ctx.fillText(text, 0, textY);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const fitted = boxed ? canvas : cropToInk(canvas);
  const oriented = rotateCanvas(fitted, opts.orient ?? "N");
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
    const font = fontFromCommands(commands);
    const invert = /\^FR/i.test(commands);
    const orient = orientationFromCommands(commands);
    const prefix = zpl.slice(0, match.index ?? 0);
    const box = invert ? prefix.match(BOX_BEFORE) : null;
    const boxPos = box ? box[0].match(/\^FO(-?\d+),(-?\d+)/) : null;
    pending.push({
      match: `${box?.[0] ?? ""}${all}`,
      replacement: textToGfa(text, font.height, fontFamily, {
        invert,
        orient,
        charWidth: font.width,
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
