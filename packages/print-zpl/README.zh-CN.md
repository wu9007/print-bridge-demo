# @yinshu/print-zpl

[English](README.md) · **中文**

把这个目录拷进业务仓。`{{变量}}` 原样替换，发 **ZPL RAW** 给印枢（`ws://127.0.0.1:17890/ws`）。不是 PDF / ARJS。

需要浏览器 + Vite（`?raw`、`?url`）。不用先发包。

## 1. 拿走

```text
your-app/
  print-zpl/          ← 本目录
  templates/*.zpl
```

```ts
import { YinshuClient, pickPrinter, printTemplateVars, printZpl } from './print-zpl';
import rhPositive from './templates/rh-positive.zpl?raw';
```

可选别名：

```ts
// vite.config.ts
{ '@yinshu/print-zpl': fileURLToPath(new URL('./print-zpl/src/index.ts', import.meta.url)) }
```

## 2. 印枢

1. 启动印枢。
2. 网站名单必须包含当前页面 Origin（本 demo：`http://127.0.0.1:5173`）。
3. `queued` 是收下了，不是纸已经出来。

## 3. 打印

```ts
printTemplateVars(rhPositive);

const client = new YinshuClient();
await client.connect();
const printerName = pickPrinter(await client.getPrintersList());

await printZpl(client, printerName, rhPositive, {
  // 把 printTemplateVars 打出的键填上
});
```

传模板 **内容**，不要传文件路径。没设的键会留下 `{{key}}`。多传的键忽略。不算条码，不加前缀。

`^FD` 里的汉字默认画成 `^GFA`。关掉：`{ rasterizeCjk: false }`。

## 4. 完整示例

重庆合格签样例。阴性只改 `RHD`。不合格 19 个键。多原因用 `\\&` 换行。

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

## 5. 包面

| 干什么 | 用什么 |
| --- | --- |
| 连接 / 列表 / 测 PDF | `YinshuClient` |
| 打血签 | `printZpl` |
| 打出可粘贴的键 | `printTemplateVars` |
| 做表单 | `listPlaceholders` |
| 选一台在线打印机 | `pickPrinter` |

血签只走 `printZpl`。不要用 `printPdf` / `@brick/arjs`。这些模板是 `^PW672` / `^LL1240`，按 **203 DPI** 排的。
