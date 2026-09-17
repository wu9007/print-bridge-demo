# printZpl demo

`feat/print-zpl` 只验证启奥托盘标签打印。SDK 在 `packages/print`，包名 `@brick/print`。

研发用法见 `packages/print/README.md`。

```ts
import rhPositive from "./templates/rh-positive.zpl?raw";
import { DriverTrayClient, printZpl } from "@brick/print";

const client = new DriverTrayClient();
await client.connect();
await printZpl(client, printerName, rhPositive, vars);
```

模板放在业务仓 `src/templates/`，用 `?raw` 引入后把 **内容** 传给 SDK。不要传路径。先用 `minimal` 试通路。

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:5173/`。本机先起 brick-device-driver。
