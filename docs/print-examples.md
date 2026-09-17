# 研发对照示例

SDK 在 brick-ui `@brick/print-zpl`（ZPL RAW，不是 PDF / ARJS）。模板放在业务仓，用 `?raw` 引入后把 **内容** 传进来。研发设什么，`{{变量}}` 就换成什么。

不确定命令里有哪些键时：

```ts
import { printTemplateVars } from "@brick/print-zpl";
printTemplateVars(templateText);
```

下面三份是完整可复制示例。值来自重庆合格签样例；阴性只改了 `RHD`；不合格按自己那份模板的 19 个键填，多原因用 `\\&` 换行。

```ts
import { DriverTrayClient, printZpl } from "@brick/print-zpl";

const client = new DriverTrayClient();
await client.connect();
const printers = await client.getPrintersList();
const printerName = printers.find((item) => item.online)?.name;
if (!printerName) {
  throw new Error("没有在线打印机");
}
```

## 阳性合格

模板：`rh-positive.zpl`（25 个变量）

```ts
import rhPositive from "./templates/rh-positive.zpl?raw";

await printZpl(client, printerName, rhPositive, {
  donCode_Bar: "=5>500002606533455",
  donCode_Station: "50000",
  donCode_Year: "26",
  donCode_NO: "065334",
  donCode_State: "55",
  donCode_Check: "W",
  bloodTypeCode_Bar: "=%>52800",
  bloodTypeCode: "2800",
  expiryCode_Bar: "&>0>50272321357",
  prodCode_Bar: "=<D2140600",
  prodCode: "D2140600",
  expiryCode: "0272321357",
  ABO: "AB",
  RHD: "Rh(D)阳性",
  prodName: "病毒灭活新鲜冰冻血浆150ml",
  volumeAndUnit: "150 ml",
  expiryTime: "2027-08-20 13:57",
  collectTime: "2026-08-20 13:57",
  prepTime: "2027-08-20 20:08",
  indications: "临床适应症：适用于凝血因子缺乏或大量输血伴有凝血障碍",
  precautions: "注意事项：输注前请检查包装是否完好无损，外观是否正常",
  solution: "ACD-B",
  temperature: "2-6℃",
  collector: "085",
  preparer: "JSK",
});
```

## 阴性合格

模板：`rh-negative.zpl`（25 个变量，键和阳性相同）

```ts
import rhNegative from "./templates/rh-negative.zpl?raw";

await printZpl(client, printerName, rhNegative, {
  donCode_Bar: "=5>500002606533455",
  donCode_Station: "50000",
  donCode_Year: "26",
  donCode_NO: "065334",
  donCode_State: "55",
  donCode_Check: "W",
  bloodTypeCode_Bar: "=%>52800",
  bloodTypeCode: "2800",
  expiryCode_Bar: "&>0>50272321357",
  prodCode_Bar: "=<D2140600",
  prodCode: "D2140600",
  expiryCode: "0272321357",
  ABO: "AB",
  RHD: "Rh(D)阴性",
  prodName: "病毒灭活新鲜冰冻血浆150ml",
  volumeAndUnit: "150 ml",
  expiryTime: "2027-08-20 13:57",
  collectTime: "2026-08-20 13:57",
  prepTime: "2027-08-20 20:08",
  indications: "临床适应症：适用于凝血因子缺乏或大量输血伴有凝血障碍",
  precautions: "注意事项：输注前请检查包装是否完好无损，外观是否正常",
  solution: "ACD-B",
  temperature: "2-6℃",
  collector: "085",
  preparer: "JSK",
});
```

## 不合格

模板：`unqualified.zpl`（19 个变量，没有有效期、适应证、注意事项）

```ts
import unqualified from "./templates/unqualified.zpl?raw";

await printZpl(client, printerName, unqualified, {
  donCode_Bar: "=5>500002606533455",
  donCode_Station: "50000",
  donCode_Year: "26",
  donCode_NO: "065334",
  donCode_State: "55",
  donCode_Check: "W",
  bloodTypeCode_Bar: "=%>52800",
  bloodTypeCode: "2800",
  prodCode_Bar: "=<D2140600",
  prodCode: "D2140600",
  ABO: "AB",
  RHD: "Rh(D)阳性",
  prodName: "病毒灭活新鲜冰冻血浆150ml",
  discardReason: "ALT不合格\\&HBsAg阳性",
  volumeAndUnit: "150 ml",
  solution: "ACD-B",
  temperature: "2-6℃",
  collector: "085",
  preparer: "JSK",
});
```

包面只有 `DriverTrayClient`、`printTemplateVars`、`printZpl`。不算条码、不加前缀。不要走 `@brick/arjs/print` 的 `printPdf` 打血签。
