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
import label from './templates/label.zpl?raw';
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
printTemplateVars(label);

const client = new YinshuClient();
await client.connect();
const printerName = pickPrinter(await client.getPrintersList());

await printZpl(client, printerName, label, {
  title: 'Sample',
  sku: 'A-1001',
  note: '第一行\\&第二行',
});
```

传模板 **内容**，不要传文件路径。没设的键会留下 `{{key}}`。多传的键忽略。不算条码，不加前缀。同一字段多行用 `\\&`。

`^FD` 里的汉字默认画成 `^GFA`。关掉：`{ rasterizeCjk: false }`。

不确定有哪些键时，用 `printTemplateVars` 打出可粘贴对象。

## 4. 包面

| 干什么 | 用什么 |
| --- | --- |
| 连接 / 列表 | `YinshuClient` |
| 打 ZPL | `printZpl` |
| 打出可粘贴的键 | `printTemplateVars` |
| 做表单 | `listPlaceholders` |
| 选一台在线打印机 | `pickPrinter` |
