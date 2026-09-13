# PrintBridge Demo

给业务开发看：怎么把本机打印接到自己的项目里。页面上方是表单，下方按 1～4 步写接入代码。

- **RAW / 文件**：标签机。模板里的 `{{变量}}` 替换后，`type: "raw"` 下发。含非 ASCII 的字段默认画成 `^GFA`。带 `~DG` / `~DY` 的文件走原字节。
- **PDF**：普通打印机。必须自己选 PDF，不要把标签做成 PDF 再栅格。

## 业务项目里怎么写

用户电脑先安装并启动 [PrintBridge](https://github.com/vergil-lai/print-bridge/releases)，把业务页 Origin 加进白名单。本地开发是 `http://127.0.0.1:5173`。麒麟 V10 用 Headless。默认 `ws://127.0.0.1:17890/ws`。

```bash
npm install print-bridge-sdk
```

```ts
import { PrintBridgeClient } from "print-bridge-sdk";
import { printRawFile, printRawLabel, printRawUrl } from "./lib/printRaw";
import labelZplUrl from "./templates/label.zpl?url";

const client = new PrintBridgeClient({ ip: "127.0.0.1", port: 17890 });
await client.connect();

const printers = await client.getPrintersList();
const printerName = selectedName; // 用户选的 printers[].name，不要写死机型

await printRawLabel(client, printerName, template, fields);
await printRawUrl(client, printerName, labelZplUrl, fields);
await printRawFile(client, printerName, file, fields);

await client.print({
  type: "pdf",
  printerName,
  fileUrl, // https://... 或 data:application/pdf;base64,...
  copies: 1,
  paper: { widthMm: 210, heightMm: 297 },
});
```

`print()` 只等到 `queued`。出纸看 `status`：`submitted` / `completed` / `failed` 是系统队列状态，不是物理确认。

页面卸载时 `disconnect()`。`raw` 不要传 `fileUrl`、`paper`、`copies`。

对照：

| 能力 | 文件 |
|---|---|
| 连接、选打印机、点打印 | `src/App.vue` |
| 变量替换 + RAW 下发 | `src/lib/printRaw.ts` |
| 指令模板 | `src/templates/label.zpl` |
| 非 ASCII 画图 | `src/lib/zplGfa.ts` |
| 字段 | `src/lib/bloodLabel.ts` |

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:5173`。SDK：[`print-bridge-sdk`](https://github.com/vergil-lai/print-bridge-jssdk)。
