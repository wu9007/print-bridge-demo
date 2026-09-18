# @yinshu/print-zpl

**English** · [中文](README.zh-CN.md)

Copy this folder. Fill `{{keys}}` as-is. Send **ZPL RAW** to Yinshu (`ws://127.0.0.1:17890/ws`). Not PDF / ARJS.

Needs a browser + Vite (`?raw`, `?url`). No publish step.

## 1. Take

```text
your-app/
  print-zpl/          ← this folder
  templates/*.zpl
```

```ts
import { YinshuClient, pickPrinter, printTemplateVars, printZpl } from './print-zpl';
import label from './templates/label.zpl?raw';
```

Optional alias:

```ts
// vite.config.ts
{ '@yinshu/print-zpl': fileURLToPath(new URL('./print-zpl/src/index.ts', import.meta.url)) }
```

## 2. Yinshu

1. Start Yinshu.
2. Website list must include this page Origin (`http://127.0.0.1:5173` for this demo).
3. `queued` means accepted. It does not mean paper is out.

## 3. Print

```ts
printTemplateVars(label);

const client = new YinshuClient();
await client.connect();
const printerName = pickPrinter(await client.getPrintersList());

await printZpl(client, printerName, label, {
  title: 'Sample',
  sku: 'A-1001',
  note: 'Line 1\\&Line 2',
});
```

Pass **template text**, not a file path. Missing keys stay `{{key}}`. Extra keys are ignored. No barcode math. No prefixes. Join lines in one field with `\\&`.

CJK in `^FD` is drawn as `^GFA` by default. Turn off with `{ rasterizeCjk: false }`.

Unsure which keys exist? `printTemplateVars` logs a copy-paste object.

## 4. Surface

| Use | Name |
| --- | --- |
| Connect / list | `YinshuClient` |
| Print ZPL | `printZpl` |
| Dump keys to the console | `printTemplateVars` |
| Form fields | `listPlaceholders` |
| First online printer | `pickPrinter` |
