# @yinshu-print/print-zpl

**English** · [中文](README.zh-CN.md)

Fill `{{keys}}` as-is. Send **ZPL RAW** to Yinshu (`ws://127.0.0.1:17890/ws`). Not PDF / ARJS.

Needs a browser. Templates still use Vite `?raw`.

## 1. Install

```bash
npm install @yinshu-print/print-zpl
```

```ts
import { YinshuClient, pickPrinter, printTemplateVars, printZpl } from '@yinshu-print/print-zpl';
import hospital from './templates/hospital.zpl?raw';
```

Or copy this folder and import `./print-zpl`.

## 2. Yinshu

1. Start Yinshu.
2. Website list must include this page Origin (`http://127.0.0.1:5173` for this demo).
3. `queued` means accepted. It does not mean paper is out.

## 3. Print

```ts
printTemplateVars(hospital);

const client = new YinshuClient();
await client.connect();
const printerName = pickPrinter(await client.getPrintersList());

await printZpl(client, printerName, hospital, {
  // paste keys from printTemplateVars, then fill
});
```

Pass **template text**, not a file path. Missing keys stay `{{key}}`. Extra keys are ignored. No barcode math. No prefixes.

CJK in `^FD` is drawn as `^GFA` by default. Turn off with `{ rasterizeCjk: false }`.

## 4. Examples

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

## 5. Surface

| Use | Name |
| --- | --- |
| Connect / list | `YinshuClient` |
| Print ZPL | `printZpl` |
| Dump keys to the console | `printTemplateVars` |
| Form fields | `listPlaceholders` |
| First online printer | `pickPrinter` |

Labels: `printZpl` only. Not PDF / ARJS. These templates are `^PW576` at **203 DPI**.
