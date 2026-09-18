# 印枢 demo

只验证本机驱动助手标签打印。SDK 用私有源 `@brick/print-zpl`（ZPL RAW，不是 PDF / ARJS）。

研发用法见 `docs/print-examples.md`。

```ts
import rhPositive from "./templates/rh-positive.zpl?raw";
import { DriverTrayClient, printZpl } from "@brick/print-zpl";

const client = new DriverTrayClient();
await client.connect();
await printZpl(client, printerName, rhPositive, vars);
```

模板放在 `src/templates/`，用 `?raw` 引入后把 **内容** 传给 SDK。不要传路径。先用 `minimal` 试通路。

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:5173/`。本机先起 brick-device-driver。
