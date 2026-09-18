import { YinshuError } from './yinshuClient';
import { rasterizeCjkFields } from './zplGfa';

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

type PrintZplClient = {
  sendRaw(req: { printerName: string; zpl?: string; zplBase64?: string }): Promise<void>;
};

export type PrintZplOptions = {
  /** 把含非 ASCII 的 ^FD 画成 ^GFA。默认开启。 */
  rasterizeCjk?: boolean;
};

/** 按出现顺序去重，列出 {{donCode}} 这类占位符。 */
export function listPlaceholders(templateText: string): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const match of templateText.matchAll(PLACEHOLDER)) {
    const key = match[1];
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

/** 把命令里的变量打成可直接粘贴的对象字面量。 */
export function printTemplateVars(templateText: string): string {
  const vars = listPlaceholders(assertTemplateText(templateText));
  const text = vars.length ? `{\n${vars.map((key) => `  ${key}: "",`).join('\n')}\n}` : '{}';
  console.log(text);
  return text;
}

function applyTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(PLACEHOLDER, (all, key: string) =>
    Object.hasOwn(vars, key) ? vars[key] ?? '' : all
  );
}

async function prepareZplText(text: string, options?: PrintZplOptions): Promise<string> {
  if (options?.rasterizeCjk === false || /~D[GY]/i.test(text)) {
    return text;
  }
  return rasterizeCjkFields(text);
}

function assertTemplateText(templateText: string): string {
  const text = templateText.trim();
  if (!text) {
    throw new YinshuError('指令为空', 'INVALID_DATA');
  }
  const looksLikePath =
    !/\^XA/i.test(text) && (/\.zpl$/i.test(text) || /^(\.\/|\.\.\/|\/|[A-Za-z]:[\\/])/.test(text));
  if (looksLikePath) {
    throw new YinshuError(
      '请传入模板内容，不要传文件路径。用 ?raw 引入后再交给 printZpl。',
      'INVALID_DATA'
    );
  }
  return text;
}

/** 研发设什么就替换什么，然后转中文、交给印枢。第三参是模板 text，不是路径。 */
export async function printZpl(
  client: PrintZplClient,
  printerName: string,
  templateText: string,
  vars: Record<string, string>,
  options?: PrintZplOptions
): Promise<void> {
  if (!printerName.trim()) {
    throw new YinshuError('请指定打印机', 'NO_PRINTER');
  }
  const filled = applyTemplate(assertTemplateText(templateText), vars);
  await client.sendRaw({
    printerName,
    zpl: await prepareZplText(filled, options)
  });
}
