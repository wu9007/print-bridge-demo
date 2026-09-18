# @yinshu-print/print-zpl

[English](README.md) · **中文**

`{{变量}}` 原样替换，发 **ZPL RAW** 给印枢（`ws://127.0.0.1:17890/ws`）。不是 PDF / ARJS。

需要浏览器。模板仍用 Vite `?raw`。中文字体打在包里。

## 1. 安装

```bash
npm install @yinshu-print/print-zpl
```

```ts
import { YinshuClient, pickPrinter, printTemplateVars, printZpl } from '@yinshu-print/print-zpl';
import hospital from './templates/hospital.zpl?raw';
```

装不了 npm 再拷本目录，改成 `import from './print-zpl'`。

## 2. 印枢

1. 启动印枢。
2. 网站名单必须包含当前页面 Origin（本 demo：`http://127.0.0.1:5173`）。
3. `queued` 是收下了，不是纸已经出来。

## 3. 打印

```ts
printTemplateVars(hospital);

const client = new YinshuClient();
await client.connect();
const printerName = pickPrinter(await client.getPrintersList());

await printZpl(client, printerName, hospital, {
  // 把 printTemplateVars 打出的键填上
});
```

`printTemplateVars(text, values?)` 打出可粘贴对象。已经填过值就传 `values`。

传模板 **内容**，不要传文件路径。没设的键会留下 `{{key}}`。多传的键忽略。不算条码，不加前缀。静态模板可以不传 `vars`。

`^FD` 里的汉字默认画成 `^GFA`。关掉：`{ rasterizeCjk: false }`。

这些示例模板是 `^PW576`，按 **203 DPI** 排的。300 DPI 的机子看起来会更小，要按分辨率改模板。

## 4. 完整示例

同一字段多行用 `\\&`。

### 医院就诊签 — `hospital.zpl`（5 键）

```ts
await printZpl(client, printerName, hospital, {
  hospital: '市第一医院',
  dept: '骨科',
  bed: '12-03',
  name: '张三',
  visitNo: '20260918001'
});
```

### 航材标签 — `aerospace.zpl`（5 键）

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

### 工业物料签 — `industrial.zpl`（5 键）

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

## 5. 包面

| 干什么 | 用什么 |
| --- | --- |
| 连接 / 列表 | `YinshuClient` |
| 打 ZPL | `printZpl` |
| 打出可粘贴的键 | `printTemplateVars` |
| 做表单 | `listPlaceholders` |
| 选一台在线打印机 | `pickPrinter` |

标签只走 `printZpl`。不是 PDF / ARJS。

本仓 demo 默认用 npm 包（`npm run dev`）。要改这个目录并热更新：在仓库根目录跑 `npm run dev:local`。
