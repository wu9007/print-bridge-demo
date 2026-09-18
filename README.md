# Yinshu Demo

**English** · [中文](README.zh-CN.md)

Local Yinshu demo for **ZPL RAW**. The SDK is [`@yinshu-print/print-zpl`](https://www.npmjs.com/package/@yinshu-print/print-zpl). Not PDF / ARJS.

How to print: [packages/print-zpl/README.md](packages/print-zpl/README.md)

## 1. Run the demo

Start Yinshu. Add `http://127.0.0.1:5173` to the website list.

```bash
npm install
npm run dev
```

This install pulls **the npm package**. Open http://127.0.0.1:5173/ — pick a template, fill vars, print.

Do **not** add a root `workspaces` field that includes `packages/print-zpl`. npm would then link the folder and ignore the registry.

The page shows `当前是 npm 包。` when it is using the published build.

## 2. Print in your app

```bash
npm install @yinshu-print/print-zpl
```

Keep the template in your app. Import **text** with `?raw`. Do not pass a file path. Whatever you set replaces `{{key}}` as-is. No barcode math. No prefixes.

```ts
import { YinshuClient, pickPrinter, printTemplateVars, printZpl } from '@yinshu-print/print-zpl';
import hospital from './templates/hospital.zpl?raw';

printTemplateVars(hospital);

const client = new YinshuClient();
await client.connect();
const printerName = pickPrinter(await client.getPrintersList());
```

Unsure which keys exist? `printTemplateVars` logs a copy-paste object. Pass a second argument to fill the values you already have.

## 3. Examples

Join multiple lines in one field with `\\&`.

### Hospital — `hospital.zpl` (5 keys)

```ts
await printZpl(client, printerName, hospital, {
  hospital: '市第一医院',
  dept: '骨科',
  bed: '12-03',
  name: '张三',
  visitNo: '20260918001'
});
```

### Aerospace — `aerospace.zpl` (5 keys)

```ts
import aerospace from './templates/aerospace.zpl?raw';

await printZpl(client, printerName, aerospace, {
  partName: '液压导管',
  partNo: 'A320711234',
  serial: 'SN88421',
  batch: 'LOT2609',
  due: '2028-03-01'
});
```

### Industrial — `industrial.zpl` (5 keys)

```ts
import industrial from './templates/industrial.zpl?raw';

await printZpl(client, printerName, industrial, {
  title: '不锈钢法兰',
  sku: 'A-1001',
  qty: '24',
  loc: 'A-03-12',
  note: '防潮存放\\&轻拿轻放'
});
```

## 4. Change the SDK in this repo

```bash
npm run dev:local
```

Vite aliases `@yinshu-print/print-zpl` to `packages/print-zpl/src/index.ts`. Edit the source, the demo hot-reloads. The page shows `当前是本地 SDK 源码。`

You do not need to build `dist` first. `npm run dev` (no `:local`) still uses `node_modules`.

To ship a new SDK version: bump `packages/print-zpl/package.json`, then push tag `print-zpl-v*` or run the **Publish print-zpl** GitHub Action.

## 5. Rules

- App install: `npm install @yinshu-print/print-zpl`
- Surface: `YinshuClient` · `printZpl` · `printTemplateVars` · `pickPrinter` · `listPlaceholders`
- Labels: ZPL RAW only. Not PDF / ARJS
- Templates live in `src/templates/`. Start with `minimal` to test the path
- CJK font is inside the package. `queued` means accepted, not paper out
