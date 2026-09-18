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
import rhPositive from './templates/rh-positive.zpl?raw';
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
printTemplateVars(rhPositive);

const client = new YinshuClient();
await client.connect();
const printerName = pickPrinter(await client.getPrintersList());

await printZpl(client, printerName, rhPositive, {
  // paste keys from printTemplateVars, then fill
});
```

Pass **template text**, not a file path. Missing keys stay `{{key}}`. Extra keys are ignored. No barcode math. No prefixes.

CJK in `^FD` is drawn as `^GFA` by default. Turn off with `{ rasterizeCjk: false }`.

## 4. Examples

Chongqing sample. Rh-negative only changes `RHD`. Unqualified has 19 keys. Join discard reasons with `\\&`.

### Rh-positive — `rh-positive.zpl` (25 keys)

```ts
await printZpl(client, printerName, rhPositive, {
  donCode_Bar: '=5>500002606533455',
  donCode_Station: '50000',
  donCode_Year: '26',
  donCode_NO: '065334',
  donCode_State: '55',
  donCode_Check: 'W',
  bloodTypeCode_Bar: '=%>52800',
  bloodTypeCode: '2800',
  expiryCode_Bar: '&>0>50272321357',
  prodCode_Bar: '=<D2140600',
  prodCode: 'D2140600',
  expiryCode: '0272321357',
  ABO: 'AB',
  RHD: 'Rh(D)阳性',
  prodName: '病毒灭活新鲜冰冻血浆150ml',
  volumeAndUnit: '150 ml',
  expiryTime: '2027-08-20 13:57',
  collectTime: '2026-08-20 13:57',
  prepTime: '2027-08-20 20:08',
  indications: '临床适应症：适用于凝血因子缺乏或大量输血伴有凝血障碍',
  precautions: '注意事项：输注前请检查包装是否完好无损，外观是否正常',
  solution: 'ACD-B',
  temperature: '2-6℃',
  collector: '085',
  preparer: 'JSK'
});
```

### Rh-negative — `rh-negative.zpl` (same 25 keys)

```ts
import rhNegative from './templates/rh-negative.zpl?raw';

await printZpl(client, printerName, rhNegative, {
  donCode_Bar: '=5>500002606533455',
  donCode_Station: '50000',
  donCode_Year: '26',
  donCode_NO: '065334',
  donCode_State: '55',
  donCode_Check: 'W',
  bloodTypeCode_Bar: '=%>52800',
  bloodTypeCode: '2800',
  expiryCode_Bar: '&>0>50272321357',
  prodCode_Bar: '=<D2140600',
  prodCode: 'D2140600',
  expiryCode: '0272321357',
  ABO: 'AB',
  RHD: 'Rh(D)阴性',
  prodName: '病毒灭活新鲜冰冻血浆150ml',
  volumeAndUnit: '150 ml',
  expiryTime: '2027-08-20 13:57',
  collectTime: '2026-08-20 13:57',
  prepTime: '2027-08-20 20:08',
  indications: '临床适应症：适用于凝血因子缺乏或大量输血伴有凝血障碍',
  precautions: '注意事项：输注前请检查包装是否完好无损，外观是否正常',
  solution: 'ACD-B',
  temperature: '2-6℃',
  collector: '085',
  preparer: 'JSK'
});
```

### Unqualified — `unqualified.zpl` (19 keys)

```ts
import unqualified from './templates/unqualified.zpl?raw';

await printZpl(client, printerName, unqualified, {
  donCode_Bar: '=5>500002606533455',
  donCode_Station: '50000',
  donCode_Year: '26',
  donCode_NO: '065334',
  donCode_State: '55',
  donCode_Check: 'W',
  bloodTypeCode_Bar: '=%>52800',
  bloodTypeCode: '2800',
  prodCode_Bar: '=<D2140600',
  prodCode: 'D2140600',
  ABO: 'AB',
  RHD: 'Rh(D)阳性',
  prodName: '病毒灭活新鲜冰冻血浆150ml',
  discardReason: 'ALT不合格\\&HBsAg阳性',
  volumeAndUnit: '150 ml',
  solution: 'ACD-B',
  temperature: '2-6℃',
  collector: '085',
  preparer: 'JSK'
});
```

## 5. Surface

| Use | Name |
| --- | --- |
| Connect / list / PDF test | `YinshuClient` |
| Print a blood label | `printZpl` |
| Dump keys to the console | `printTemplateVars` |
| Form fields | `listPlaceholders` |
| First online printer | `pickPrinter` |

Blood labels: `printZpl` only. Do not use `printPdf` / `@brick/arjs`. These templates are `^PW672` / `^LL1240` at **203 DPI**.
