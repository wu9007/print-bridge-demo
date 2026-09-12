import type { PrintBridgeClient } from "print-bridge-sdk";

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** 把 {{donCode}} 换成业务数据。缺的键保持原样。 */
export function applyTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(PLACEHOLDER, (all, key: string) =>
    Object.hasOwn(vars, key) ? vars[key] ?? "" : all,
  );
}

/** .prn 只改 {{变量}} 这几段字节，其余原样保留。 */
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
export function textToBase64(text: string): string {
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

export async function printRawLabel(
  client: PrintBridgeClient,
  printerName: string,
  template: string,
  vars: Record<string, string>,
): Promise<void> {
  const body = applyTemplate(template.trim(), vars);
  if (!body) {
    throw new Error("指令为空");
  }
  await client.print({
    type: "raw",
    printerName,
    dataBase64: textToBase64(body),
  });
}

/** 读项目里的 .prn。url 用 `import file from "./templates/label.prn?url"`。 */
export async function loadProjectTemplate(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("模板读取失败");
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function printRawBytes(
  client: PrintBridgeClient,
  printerName: string,
  bytes: Uint8Array,
  vars: Record<string, string>,
): Promise<void> {
  const body = applyTemplateToBytes(bytes, vars);
  if (!body.length) {
    throw new Error("文件为空");
  }
  await client.print({
    type: "raw",
    printerName,
    dataBase64: btoa(bytesToBinary(body)),
  });
}

export async function printRawUrl(
  client: PrintBridgeClient,
  printerName: string,
  url: string,
  vars: Record<string, string>,
): Promise<void> {
  await printRawBytes(client, printerName, await loadProjectTemplate(url), vars);
}

export async function printRawFile(
  client: PrintBridgeClient,
  printerName: string,
  file: File,
  vars: Record<string, string>,
): Promise<void> {
  await printRawBytes(client, printerName, new Uint8Array(await file.arrayBuffer()), vars);
}
