export const GUIDE_STEPS = [
  {
    title: "1. 连接本机，列出并选中打印机",
    code: `import { PrintBridgeClient } from "print-bridge-sdk";

// 用户电脑先启动 PrintBridge，并把本页 Origin 加白名单。
const client = new PrintBridgeClient({
  ip: "127.0.0.1",
  port: 17890,
});

await client.connect();

const printers = await client.getPrintersList();
// [
//   { name: "CITIZEN_CL_S700", isDefault: false },
//   { name: "Pantum_P2210", isDefault: true },
// ]

// 把 name 绑到下拉框，打印时原样传回去，不要写死机型。
const printerName = selectedName;

// 页面关掉时
client.disconnect();
`,
  },
  {
    title: "2. 读取项目里的 .prn",
    code: `import labelUrl from "./templates/label.prn?url";

// 业务项目把 BarTender 导出的文件放到 templates/，和这份 demo 一样。
const bytes = new Uint8Array(
  await (await fetch(labelUrl)).arrayBuffer(),
);

// 用户临时上传时：
const uploaded = new Uint8Array(await file.arrayBuffer());
`,
  },
  {
    title: "3. 用业务数据替换变量",
    code: `import { applyTemplate, applyTemplateToBytes } from "./lib/printRaw";

// key 必须和 .prn / 指令里的 {{donCode}} 一致。
const fields = {
  donCode: "500000261429227",
  prodName: "病毒灭活新鲜冰冻血浆200ml",
};

// 文本指令
const text = applyTemplate("{{donCode}}", fields);
// "500000261429227"

// .prn 只改占位符字节，STX、图形不动
const replaced = applyTemplateToBytes(bytes, fields);
`,
  },
  {
    title: "4. 打印",
    code: `import { printRawLabel, printRawUrl, printRawFile } from "./lib/printRaw";

// 项目里的模板
await printRawUrl(client, printerName, labelUrl, fields);

// 页面上的指令文本
await printRawLabel(client, printerName, command, fields);

// 用户上传的 .prn
await printRawFile(client, printerName, file, fields);

// 上面三条都是 type: "raw"。print() 只表示 Agent 收了单。
client.on("status", (event) => {
  // queued → submitted → completed / failed
});

// 普通打印机才用 PDF，标签机不要走这条。
await client.print({
  type: "pdf",
  printerName,
  fileUrl,
  copies: 1,
  paper: { widthMm: 210, heightMm: 297 },
});
`,
  },
];
