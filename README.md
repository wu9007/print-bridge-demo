# Yinshu Demo

**English** · [中文](README.zh-CN.md)

Local Yinshu demo for **ZPL RAW**. Take `packages/print-zpl`. Not PDF / ARJS.

How to print: [packages/print-zpl/README.md](packages/print-zpl/README.md)

## 1. Run

Start Yinshu. Add `http://127.0.0.1:5173` to the website list.

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173/ — pick a template, fill vars, print.

## 2. Print

Keep the template in your app. Import **text** with `?raw`. Do not pass a file path. Whatever you set replaces `{{key}}` as-is. No barcode math. No prefixes.

```ts
import { YinshuClient, pickPrinter, printTemplateVars, printZpl } from '@yinshu/print-zpl';
import hospital from './templates/hospital.zpl?raw';

printTemplateVars(hospital);

const client = new YinshuClient();
await client.connect();
const printerName = pickPrinter(await client.getPrintersList());
```

Unsure which keys exist? `printTemplateVars` logs a copy-paste object.

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

## 4. Rules

- Takeaway: `packages/print-zpl`
- Surface: `YinshuClient` · `printZpl` · `printTemplateVars` · `pickPrinter` · `listPlaceholders`
- Labels: ZPL RAW only. Not PDF / ARJS
- Templates live in `src/templates/`. Start with `minimal` to test the path
