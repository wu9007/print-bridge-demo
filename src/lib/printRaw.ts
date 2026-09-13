import type { PrintBridgeClient } from "print-bridge-sdk";
import { rasterizeCjkFields, shouldRasterizeZpl } from "./zplGfa";

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export type PrintRawOptions = {
  /** 把含非 ASCII 的 ^FD 画成 ^GFA。默认开启。 */
  rasterizeCjk?: boolean;
};

/** 按出现顺序去重，列出 {{donCode}} 这类占位符。 */
export function listPlaceholders(source: string | Uint8Array): string[] {
  const text = typeof source === "string" ? source : bytesToBinary(source);
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER)) {
    const key = match[1];
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

/** 把 {{donCode}} 换成业务数据。缺的键保持原样。 */
export function applyTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(PLACEHOLDER, (all, key: string) =>
    Object.hasOwn(vars, key) ? vars[key] ?? "" : all,
  );
}

/** 二进制模板只改 {{变量}} 这几段字节，其余原样保留。 */
export function applyTemplateToBytes(bytes: Uint8Array, vars: Record<string, string>): Uint8Array {
  const replaced = bytesToBinary(bytes).replace(PLACEHOLDER, (all, key: string) => {
    if (!Object.hasOwn(vars, key)) {
      return all;
    }
    return bytesToBinary(new TextEncoder().encode(vars[key] ?? ""));
  });
  const out = new Uint8Array(replaced.length);
  for (let i = 0; i < replaced.length; i += 1) {
    out[i] = replaced.charCodeAt(i) & 0xff;
  }
  return out;
}

/** 指令文本 → base64。<STX> 换成 0x02，换行换成 CR。 */
function textToBase64(text: string): string {
  const normalized = text
    .replace(/<STX>/gi, "\x02")
    .replace(/\r\n/g, "\r")
    .replace(/\n/g, "\r");
  return btoa(bytesToBinary(new TextEncoder().encode(normalized)));
}

function bytesToBinary(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return binary;
}

function bytesToLog(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("latin1").decode(bytes);
  }
}

function logStage(label: string, body: string): void {
  console.log(`[打印] ${label}\n${body}`);
  debugger;
}

async function prepareZplText(text: string, options?: PrintRawOptions): Promise<string> {
  if (options?.rasterizeCjk === false || /~D[GY]/i.test(text)) {
    return text;
  }
  return rasterizeCjkFields(text);
}

export async function printRawLabel(
  client: PrintBridgeClient,
  printerName: string,
  template: string,
  vars: Record<string, string>,
  options?: PrintRawOptions,
): Promise<void> {
  const source = template.trim();
  logStage("1 填充前", source);
  const filled = applyTemplate(source, vars);
  if (!filled) {
    throw new Error("指令为空");
  }
  logStage("2 填充后", filled);
  const converted = await prepareZplText(filled, options);
  logStage("3 转中文后", converted);
  await client.print({
    type: "raw",
    printerName,
    dataBase64: textToBase64(converted),
  });
}

/** 读项目里的模板。url 用 `import file from "./templates/label.zpl?url"`。 */
async function loadProjectTemplate(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("模板读取失败");
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function printRawBytes(
  client: PrintBridgeClient,
  printerName: string,
  bytes: Uint8Array,
  vars: Record<string, string>,
  options?: PrintRawOptions,
): Promise<void> {
  logStage("1 填充前", bytesToLog(bytes));
  const replaced = applyTemplateToBytes(bytes, vars);
  if (!replaced.length) {
    throw new Error("文件为空");
  }
  logStage("2 填充后", bytesToLog(replaced));
  let dataBase64: string;
  if (options?.rasterizeCjk !== false && shouldRasterizeZpl(replaced)) {
    const converted = await prepareZplText(new TextDecoder().decode(replaced), options);
    logStage("3 转中文后", converted);
    dataBase64 = textToBase64(converted);
  } else {
    logStage("3 转中文后", "跳过（原字节下发）");
    dataBase64 = btoa(bytesToBinary(replaced));
  }
  await client.print({
    type: "raw",
    printerName,
    dataBase64,
  });
}

export async function printRawUrl(
  client: PrintBridgeClient,
  printerName: string,
  url: string,
  vars: Record<string, string>,
  options?: PrintRawOptions,
): Promise<void> {
  await printRawBytes(client, printerName, await loadProjectTemplate(url), vars, options);
}

export async function printRawFile(
  client: PrintBridgeClient,
  printerName: string,
  file: File,
  vars: Record<string, string>,
  options?: PrintRawOptions,
): Promise<void> {
  await printRawBytes(
    client,
    printerName,
    new Uint8Array(await file.arrayBuffer()),
    vars,
    options,
  );
}
