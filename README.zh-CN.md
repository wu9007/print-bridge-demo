# 印枢 Demo

[English](README.md) · **中文**

印枢 **ZPL RAW** 演示。SDK 是 [`@yinshu-print/print-zpl`](https://www.npmjs.com/package/@yinshu-print/print-zpl)。不是 PDF / ARJS。

怎么打：[packages/print-zpl/README.zh-CN.md](packages/print-zpl/README.zh-CN.md)

## 1. 跑 demo

先启动印枢。网站名单加上 `http://127.0.0.1:5173`。

```bash
npm install
npm run dev
```

这次安装拉的是 **npm 上的包**。打开 http://127.0.0.1:5173/ — 选模板、填变量、打印。

根目录 **不要** 写包含 `packages/print-zpl` 的 `workspaces`。写了 npm 会永远 link 本地目录，装不到仓库里的包。

页面提示 `当前是 npm 包。` 就是走的已发布构建。

## 2. 业务仓怎么打

```bash
npm install @yinshu-print/print-zpl
```

模板放在业务仓。用 `?raw` 引入 **内容**，不要传文件路径。研发设什么，`{{变量}}` 就换成什么。不算条码，不加前缀。

```ts
import { YinshuClient, pickPrinter, printTemplateVars, printZpl } from '@yinshu-print/print-zpl';
import hospital from './templates/hospital.zpl?raw';

printTemplateVars(hospital);

const client = new YinshuClient();
await client.connect();
const printerName = pickPrinter(await client.getPrintersList());
```

不确定有哪些键时，用 `printTemplateVars` 打出可粘贴对象。已经填过值就传第二参。

## 3. 完整示例

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

## 4. 在本仓改 SDK

```bash
npm run dev:local
```

Vite 会把 `@yinshu-print/print-zpl` 指到 `packages/print-zpl/src/index.ts`。改源码，demo 热更新。页面提示 `当前是本地 SDK 源码。`

不用先打 `dist`。`npm run dev`（不带 `:local`）仍然用 `node_modules` 里的包。

要发新版：改 `packages/print-zpl/package.json` 的版本号，推 `print-zpl-v*` 标签，或手动跑 GitHub Action **Publish print-zpl**。

## 5. 约定

- 业务仓安装：`npm install @yinshu-print/print-zpl`
- 包面：`YinshuClient` · `printZpl` · `printTemplateVars` · `pickPrinter` · `listPlaceholders`
- 标签只走 ZPL RAW，不是 PDF / ARJS
- 模板在 `src/templates/`。先用 `minimal` 试通路
- 中文字体在包里。`queued` 是收下了，不是纸已经出来
