<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { PrintBridgeClient, PrintBridgeError } from "print-bridge-sdk";

type Printer = Awaited<ReturnType<PrintBridgeClient["getPrintersList"]>>[number];
import { textToBase64 } from "./lib/encode";
import { sampleFor, type CommandLanguage } from "./lib/templates";

type LogLevel = "info" | "ok" | "warn" | "bad";

interface LogItem {
  id: number;
  time: string;
  level: LogLevel;
  text: string;
}

const host = ref("127.0.0.1");
const port = ref(17890);
const language = ref<CommandLanguage>("zpl");
const command = ref(sampleFor("zpl"));
const printerName = ref("");
const printers = ref<Printer[]>([]);
const connected = ref(false);
const busy = ref(false);
const origin = ref("");
const logs = ref<LogItem[]>([]);

let client: PrintBridgeClient | null = null;
let logSeq = 0;
const unsubs: Array<() => void> = [];

const endpoint = computed(() => `ws://${host.value}:${port.value}/ws`);

function nowTime(): string {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function log(level: LogLevel, text: string): void {
  logs.value = [{ id: ++logSeq, time: nowTime(), level, text }, ...logs.value].slice(0, 40);
}

function errorText(error: unknown): string {
  if (error instanceof PrintBridgeError) {
    return `${error.code}：${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function bindClient(next: PrintBridgeClient): void {
  unsubs.push(
    next.on("connect", () => {
      connected.value = true;
      log("ok", "已连接本机 PrintBridge");
    }),
    next.on("disconnect", (event) => {
      connected.value = false;
      log("warn", `连接断开${event.reason ? `：${event.reason}` : ""}`);
    }),
    next.on("status", (event) => {
      log("info", `任务 ${event.jobId} → ${event.status}${event.message ? ` · ${event.message}` : ""}`);
    }),
    next.on("error", (error) => {
      log("bad", errorText(error));
    }),
  );
}

function disposeClient(): void {
  unsubs.splice(0).forEach((off) => off());
  client?.disconnect();
  client = null;
  connected.value = false;
}

async function connect(): Promise<void> {
  busy.value = true;
  try {
    disposeClient();
    const next = new PrintBridgeClient({
      ip: host.value.trim() || "127.0.0.1",
      port: Number(port.value) || 17890,
    });
    bindClient(next);
    await next.connect();
    client = next;
    await refreshPrinters();
  } catch (error) {
    disposeClient();
    log("bad", `连接失败：${errorText(error)}。请确认本机已启动 PrintBridge，并把 ${origin.value} 加入网站白名单。`);
  } finally {
    busy.value = false;
  }
}

function disconnect(): void {
  disposeClient();
  printers.value = [];
  log("info", "已手动断开");
}

async function refreshPrinters(): Promise<void> {
  if (!client?.isConnected()) {
    log("warn", "还没连上 PrintBridge");
    return;
  }
  try {
    printers.value = await client.getPrintersList();
    const selected = printers.value.find((item) => item.name === printerName.value);
    if (!selected) {
      printerName.value = printers.value.find((item) => item.isDefault)?.name ?? printers.value[0]?.name ?? "";
    }
    log("ok", `拿到 ${printers.value.length} 台打印机`);
  } catch (error) {
    log("bad", `读取打印机失败：${errorText(error)}`);
  }
}

function applySample(): void {
  command.value = sampleFor(language.value);
}

async function printRaw(): Promise<void> {
  if (!client?.isConnected()) {
    log("warn", "请先连接 PrintBridge");
    return;
  }
  const body = command.value.trim();
  if (!body) {
    log("warn", "指令是空的");
    return;
  }
  busy.value = true;
  try {
    const accepted = await client.print({
      type: "raw",
      printerName: printerName.value || undefined,
      dataBase64: textToBase64(body),
    });
    log("ok", `已入队 ${accepted.jobId}（${accepted.status}）`);
  } catch (error) {
    log("bad", `下发失败：${errorText(error)}`);
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  origin.value = window.location.origin;
  log("info", `页面 Origin 是 ${window.location.origin}，需要写进 PrintBridge 网站白名单`);
});

onUnmounted(() => {
  disposeClient();
});
</script>

<template>
  <div class="page">
    <header class="hero">
      <p class="kicker">本地打印代理</p>
      <h1>PrintBridge Demo</h1>
      <p class="lede">
        网页只负责填指令。本机
        <a href="https://github.com/vergil-lai/print-bridge" target="_blank" rel="noreferrer">PrintBridge</a>
        把 RAW 原样丢给打印机，不走 PDF 栅格。
      </p>
    </header>

    <main class="layout">
      <section class="panel">
        <div class="panel-head">
          <h2>本机连接</h2>
          <span class="pill" :data-on="connected">{{ connected ? "在线" : "未连接" }}</span>
        </div>
        <label>
          Agent 地址
          <input v-model.trim="host" :disabled="connected" autocomplete="off" />
        </label>
        <label>
          端口
          <input v-model.number="port" type="number" min="1" max="65535" :disabled="connected" />
        </label>
        <p class="hint">默认 {{ endpoint }}。把 <code>{{ origin || "当前页面 Origin" }}</code> 加入网站白名单。</p>
        <div class="actions">
          <button type="button" class="primary" :disabled="busy || connected" @click="connect">连接</button>
          <button type="button" :disabled="!connected" @click="disconnect">断开</button>
          <button type="button" :disabled="!connected || busy" @click="refreshPrinters">刷新打印机</button>
        </div>

        <div class="printers">
          <h3>打印机</h3>
          <p v-if="!printers.length" class="empty">连接后会列出本机队列里的打印机。</p>
          <label v-for="item in printers" :key="item.name" class="printer">
            <input v-model="printerName" type="radio" :value="item.name" />
            <span>
              <strong>{{ item.name }}</strong>
              <small>
                {{ item.isDefault ? "默认 · " : "" }}{{ item.dpi ? `${item.dpi} dpi · ` : "" }}{{ item.port || "系统队列" }}
              </small>
            </span>
          </label>
        </div>
      </section>

      <section class="panel wide">
        <div class="panel-head">
          <h2>RAW 指令</h2>
          <div class="langs">
            <button type="button" :class="{ on: language === 'zpl' }" @click="language = 'zpl'; applySample()">ZPL</button>
            <button type="button" :class="{ on: language === 'tspl' }" @click="language = 'tspl'; applySample()">TSPL</button>
          </div>
        </div>
        <textarea v-model="command" spellcheck="false" />
        <div class="actions">
          <button type="button" class="primary" :disabled="busy || !connected" @click="printRaw">下发 RAW</button>
          <button type="button" @click="applySample">恢复示例</button>
        </div>
        <p class="hint">raw 任务只接受 base64 指令，纸张和份数写在 ZPL / TSPL 里。页面已按 UTF-8 编码，中文可用。</p>

        <div class="log">
          <h3>事件</h3>
          <ol>
            <li v-for="item in logs" :key="item.id" :data-level="item.level">
              <time>{{ item.time }}</time>
              <span>{{ item.text }}</span>
            </li>
          </ol>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.page {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 40px 0 72px;
}

.hero {
  margin-bottom: 28px;
}

.kicker {
  margin: 0 0 8px;
  color: var(--gold);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-size: 12px;
}

h1,
h2,
h3 {
  margin: 0;
  font-weight: 650;
}

h1 {
  font-size: clamp(36px, 6vw, 64px);
  letter-spacing: -0.04em;
}

.lede,
.hint,
.empty,
small {
  color: var(--muted);
}

.lede {
  max-width: 38rem;
  font-size: 18px;
  line-height: 1.5;
}

.lede a {
  color: var(--gold);
}

.layout {
  display: grid;
  grid-template-columns: minmax(280px, 360px) 1fr;
  gap: 18px;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 22px;
  padding: 20px;
  box-shadow: var(--shadow);
}

.panel-head,
.actions,
.langs,
.printer {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-head {
  justify-content: space-between;
  margin-bottom: 16px;
}

.pill {
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid var(--line);
  color: var(--muted);
}

.pill[data-on="true"] {
  color: var(--ok);
  border-color: rgba(125, 202, 154, 0.35);
}

label {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--muted);
}

input,
textarea {
  width: 100%;
  border: 1px solid var(--line);
  background: var(--panel-2);
  color: var(--ink);
  border-radius: 12px;
  padding: 10px 12px;
}

textarea {
  min-height: 260px;
  resize: vertical;
  font-family: "SF Mono", "Menlo", "Consolas", monospace;
  font-size: 13px;
  line-height: 1.55;
}

.actions {
  flex-wrap: wrap;
  margin: 8px 0 4px;
}

button {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
  border-radius: 999px;
  padding: 8px 14px;
}

button.primary,
.langs .on {
  background: var(--gold);
  color: #21180a;
  border-color: transparent;
}

.printers,
.log {
  margin-top: 22px;
}

.printers h3,
.log h3 {
  margin-bottom: 10px;
  font-size: 15px;
}

.printer {
  align-items: flex-start;
  padding: 10px 0;
  border-top: 1px solid var(--line);
}

.printer strong,
.printer small {
  display: block;
}

.printer strong {
  color: var(--ink);
}

.log ol {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 280px;
  overflow: auto;
}

.log li {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 10px;
  padding: 8px 0;
  border-top: 1px solid var(--line);
  font-size: 13px;
}

.log time {
  color: var(--muted);
}

.log li[data-level="ok"] span {
  color: var(--ok);
}

.log li[data-level="warn"] span {
  color: var(--warn);
}

.log li[data-level="bad"] span {
  color: var(--bad);
}

@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
