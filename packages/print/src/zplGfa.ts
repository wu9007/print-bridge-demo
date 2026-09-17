import heiUrl from "./assets/HEI.TTF?url";

/** 机内字体不可靠：汉字、≤、℃ 等非 ASCII。 */
const NEEDS_RASTER = /[^\x00-\x7F]/;
/** 中间只吃 ^A / ^BY / ^CI 等。允许 Bartender 的换行，在第一个 ^FD 停。 */
const FIELD =
  /\^(FO|FT)(-?\d+),(-?\d+)((?:\s*\^(?!FD|FS|FO|FT|XA|XZ)[^^]+)*)\s*\^FD([^^]*)\^FS/g;
const FONT = /\^A[@0-9A-Za-z][^,]*,(\d+)(?:,(\d+))?/i;
const FIELD_BLOCK = /\^FB(\d+),(\d+)(?:,(-?\d+))?(?:,([LCRJ]))?(?:,(-?\d+))?/i;
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

type Align = "L" | "C" | "R";

type FieldBlock = {
  width: number;
  maxLines: number;
  lineGap: number;
  align: Align;
  hang: number;
};

/** `^FB330,4,0,L,0`：宽、行数、行距、对齐、悬挂缩进。 */
function fieldBlockFromCommands(commands: string): FieldBlock | null {
  const match = commands.match(FIELD_BLOCK);
  if (!match) {
    return null;
  }
  const width = Number(match[1]);
  const maxLines = Number(match[2]);
  const lineGap = Number(match[3] || 0);
  const alignRaw = (match[4] || "L").toUpperCase();
  const hang = Number(match[5] || 0);
  if (!Number.isFinite(width) || width <= 0) {
    return null;
  }
  return {
    width,
    maxLines: Number.isFinite(maxLines) && maxLines > 0 ? maxLines : 1,
    lineGap: Number.isFinite(lineGap) ? lineGap : 0,
    align: alignRaw === "C" || alignRaw === "R" ? alignRaw : "L",
    hang: Number.isFinite(hang) ? hang : 0,
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
  anchorY: number,
  orient: Orient,
  boxPos: RegExpMatchArray | null,
): string {
  if (boxPos) {
    return `^FO${boxPos[1]},${boxPos[2]}`;
  }
  const left = Number(x);
  const top = Number(y);
  // 正放 ^FT 是第一行基线，^GFA 上移到字顶。多行时不能按整张图高抬，否则整块上移。
  if (kind === "FT" && orient === "N") {
    return `^FO${left},${top - anchorY}`;
  }
  return `^FO${left},${top}`;
}

function measureDrawnWidth(
  text: string,
  measureNatural: (value: string) => number,
  charWidth: number,
): number {
  if (!text) {
    return 0;
  }
  if (charWidth > 0) {
    return [...text].length * charWidth;
  }
  return measureNatural(text);
}

/** 按 ^FB 宽度折行。`\&` 是硬换行；汉字按字切，西文尽量在空格切。 */
function wrapFieldBlock(
  text: string,
  measure: (value: string) => number,
  block: FieldBlock,
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\\&");
  for (const paragraph of paragraphs) {
    if (lines.length >= block.maxLines) {
      break;
    }
    if (paragraph === "" && lines.length < block.maxLines) {
      lines.push("");
      continue;
    }
    let current = "";
    let breakAt = -1;
    for (const char of paragraph) {
      const indent = lines.length > 0 ? Math.max(block.hang, 0) : 0;
      const maxWidth = Math.max(block.width - indent, 1);
      const next = current + char;
      if (measure(next) <= maxWidth || current.length === 0) {
        current = next;
        if (char === " " || char === "\u3000") {
          breakAt = current.length;
        }
        continue;
      }
      if (breakAt > 0) {
        lines.push(current.slice(0, breakAt).trimEnd());
        current = `${current.slice(breakAt).replace(/^\s+/, "")}${char}`;
      } else {
        lines.push(current);
        current = char;
      }
      breakAt = -1;
      if (lines.length >= block.maxLines) {
        current = "";
        break;
      }
    }
    if (current && lines.length < block.maxLines) {
      lines.push(current);
    }
  }
  return lines.slice(0, block.maxLines);
}

function lineLeft(width: number, lineWidth: number, align: Align, indent: number): number {
  const avail = Math.max(width - indent, 0);
  if (align === "C") {
    return indent + Math.max(0, (avail - lineWidth) / 2);
  }
  if (align === "R") {
    return indent + Math.max(0, avail - lineWidth);
  }
  return indent;
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

function drawScaledLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  destX: number,
  destY: number,
  fontSize: number,
  fontFamily: string,
  charWidth: number,
): void {
  if (!line) {
    return;
  }
  ctx.font = `${fontSize}px ${fontFamily}`;
  const naturalWidth = Math.max(ctx.measureText(line).width, 1);
  const targetWidth = measureDrawnWidth(line, () => naturalWidth, charWidth);
  const scaleX = targetWidth / naturalWidth;
  ctx.setTransform(scaleX, 0, 0, 1, destX, 0);
  ctx.fillText(line, 0, destY);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
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
    block?: FieldBlock | null;
  } = {},
): Promise<{ command: string; height: number; anchorY: number }> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("无法创建画布");
  }
  const charWidth = opts.charWidth ?? 0;
  ctx.font = `${fontSize}px ${fontFamily}`;
  const sample = ctx.measureText(text || "字");
  const ascent = Math.ceil(Math.max(sample.actualBoundingBoxAscent || fontSize * 0.8, 1));
  const descent = Math.ceil(Math.max(sample.actualBoundingBoxDescent || fontSize * 0.2, 1));
  const measure = (value: string) =>
    measureDrawnWidth(value, (item) => ctx.measureText(item).width, charWidth);
  const block = opts.block;
  const lines = block ? wrapFieldBlock(text, measure, block) : [text];
  const pad = 8;
  const boxed = Boolean(opts.invert || opts.minWidth || opts.minHeight);
  const lineStep = fontSize + (block?.lineGap ?? 0);
  const longest = Math.max(...lines.map((line) => measure(line)), 1);
  const targetWidth = block ? block.width : Math.min(longest, MAX_TEXT_WIDTH);
  const width = Math.max(
    8,
    Math.ceil(Math.max(targetWidth + (block ? 0 : pad * 2), opts.minWidth ?? 0) / 8) * 8,
  );
  const textHeight = ascent + 1 + Math.max(lines.length - 1, 0) * lineStep + descent + 1;
  const height = Math.max(8, textHeight, opts.minHeight ?? 0);
  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = opts.invert ? "#000" : "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = opts.invert ? "#fff" : "#000";
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "alphabetic";
  const firstBaseline = opts.minHeight ? Math.floor((height + ascent - descent) / 2) : ascent + 1;
  lines.forEach((line, index) => {
    const indent = block && index > 0 ? Math.max(block.hang, 0) : 0;
    const lineWidth = measure(line);
    const destX = block
      ? lineLeft(block.width, lineWidth, block.align, indent)
      : boxed
        ? Math.max(0, (width - lineWidth) / 2)
        : pad;
    drawScaledLine(ctx, line, destX, firstBaseline + index * lineStep, fontSize, fontFamily, charWidth);
  });
  const keepBox = boxed || Boolean(block);
  const fitted = keepBox ? canvas : cropToInk(canvas);
  const rawBox = keepBox ? null : inkBounds(ctx.getImageData(0, 0, width, height).data, width, height);
  const anchorY = rawBox ? firstBaseline - rawBox.minY : firstBaseline;
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
    anchorY,
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
    const block = fieldBlockFromCommands(commands);
    const prefix = zpl.slice(0, match.index ?? 0);
    const box = invert ? prefix.match(BOX_BEFORE) : null;
    const boxPos = box ? box[0].match(/\^FO(-?\d+),(-?\d+)/) : null;
    pending.push({
      match: `${box?.[0] ?? ""}${all}`,
      replacement: textToGfa(text, font.height, fontFamily, {
        invert,
        orient,
        charWidth: font.width,
        block,
        minWidth: box ? Number(box[1]) : undefined,
        minHeight: box ? Number(box[2]) : undefined,
      }).then((graphic) => {
        const origin = fieldOrigin(kind, x, y, graphic.anchorY, orient, boxPos);
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
