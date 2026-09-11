# PrintBridge Demo

浏览器小页面，用来试 [PrintBridge](https://github.com/vergil-lai/print-bridge) 的本机 RAW 打印。

页面只做三件事：连上本机 Agent、列出打印机、把 ZPL / TSPL 指令编成 base64 后按 `type: "raw"` 下发。不走 PDF、图片或 HTML，避免标签机再栅格化。

## 本机准备

1. 安装并启动 [PrintBridge](https://github.com/vergil-lai/print-bridge/releases)。
2. 在 Agent 里选好默认打印机。
3. 把页面 Origin 加进网站白名单。本地开发是 `http://127.0.0.1:5173`。
4. 标签机请用系统里的 RAW / 原始队列。麒麟 V10 优先装 Headless（`print-bridge-server`）。

## 运行

```bash
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:5173`，点「连接」，再「下发 RAW」。

默认连 `ws://127.0.0.1:17890/ws`，和官方 SDK 一致。

## 说明

- 用的是 [`print-bridge-sdk`](https://github.com/vergil-lai/print-bridge-jssdk)。
- `print()` 返回 `queued` 只表示 Agent 已收单；后续看页面事件里的 `submitted` / `completed` / `failed`。
- 中文指令按 UTF-8 再转 base64，不要直接 `btoa`。
