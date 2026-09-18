# 印枢 Demo

[English](README.md) · **中文**

印枢血签 **ZPL RAW** 演示。拿走 `packages/print-zpl`。不是 PDF / ARJS。

研发用法以 [packages/print-zpl/README.zh-CN.md](packages/print-zpl/README.zh-CN.md) 为准。

## 1. 跑起来

先启动印枢。网站名单加上 `http://127.0.0.1:5173`。

```bash
npm install
npm run dev
```

打开 http://127.0.0.1:5173/ — 选模板、填变量、打印。

## 2. 怎么打

模板放在业务仓。用 `?raw` 引入 **内容**，不要传文件路径。研发设什么，`{{变量}}` 就换成什么。不算条码，不加前缀。

```ts
import { YinshuClient, pickPrinter, printTemplateVars, printZpl } from '@yinshu/print-zpl';
import rhPositive from './templates/rh-positive.zpl?raw';

printTemplateVars(rhPositive);

const client = new YinshuClient();
await client.connect();
const printerName = pickPrinter(await client.getPrintersList());
```

不确定有哪些键时，用 `printTemplateVars` 打出可粘贴对象。

## 3. 完整示例

值来自重庆合格签样例。阴性只改 `RHD`。不合格 19 个键。多原因用 `\\&` 换行。

### 阳性合格 — `rh-positive.zpl`（25 键）

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

### 阴性合格 — `rh-negative.zpl`（同样 25 键）

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

### 不合格 — `unqualified.zpl`（19 键）

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

## 4. 约定

- 拿走：`packages/print-zpl`
- 包面：`YinshuClient` · `printZpl` · `printTemplateVars` · `pickPrinter` · `listPlaceholders`
- 血签只走 ZPL RAW，不要用 `@brick/arjs` 的 `printPdf`
- 模板在 `src/templates/`。先用 `minimal` 试通路
