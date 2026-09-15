<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { PrintBridgeClient, PrintBridgeError } from "print-bridge-sdk";
import CodeFold from "./CodeFold.vue";
import { CHONGQING_SAMPLE, FIELD_LABELS } from "./lib/bloodLabel";
import { GUIDE_STEPS } from "./lib/guideSnippets";
import { listPlaceholders, printRawFile, printRawLabel, printRawUrl } from "./lib/printRaw";
import { ZPL_TEMPLATE } from "./lib/zplTemplate";
import labelZplUrl from "./templates/label.zpl?url";

type Printer = Awaited<ReturnType<PrintBridgeClient["getPrintersList"]>>[number];
type Mode = "raw" | "file" | "pdf";
type Tone = "muted" | "ok" | "bad";

const printers = ref<Printer[]>([]);
const printerName = ref("");
const connected = ref(false);
const busy = ref(false);
const showConfig = ref(false);
function isLoopback(value: string): boolean {
  return value === "127.0.0.1" || value === "localhost" || value === "::1";
}

/** 同事用局域网打开本页时，打印连这台电脑上的印枢，不要连他们自己的 127.0.0.1。 */
function defaultAgentHost(): string {
  const pageHost = window.location.hostname || "127.0.0.1";
  const stored = localStorage.getItem("pb.host")?.trim() || "";
  if (!stored || (isLoopback(stored) && !isLoopback(pageHost))) {
    return pageHost;
  }
  return stored;
}

const host = ref(defaultAgentHost());
const port = ref(Number(localStorage.getItem("pb.port")) || 17890);
const origin = ref("");
const mode = ref<Mode>("raw");
const rasterizeCjk = ref(true);
const fields = reactive<Record<string, string>>({ ...CHONGQING_SAMPLE });
const parsedKeys = ref<string[]>([]);
const command = ref(ZPL_TEMPLATE);
const pdfFile = ref<File | null>(null);
const rawFile = ref<File | null>(null);
const pdfInput = ref<HTMLInputElement | null>(null);
const rawInput = ref<HTMLInputElement | null>(null);
const rawFileHint = "不选则使用项目 templates/label.zpl，也可上传";
const status = ref("正在连接…");
const tone = ref<Tone>("muted");

const canPrint = computed(() => {
  if (busy.value || !connected.value || !printerName.value) {
    return false;
  }
  if (mode.value === "pdf") {
    return Boolean(pdfFile.value);
  }
  return true;
});

let client: PrintBridgeClient | null = null;
const unsubs: Array<() => void> = [];

function setStatus(next: string, nextTone: Tone = "muted"): void {
  status.value = next;
  tone.value = nextTone;
}

function token(key: string): string {
  return `{{${key}}}`;
}

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

function syncFields(keys: string[]): void {
  parsedKeys.value = keys;
  for (const key of keys) {
    if (!Object.hasOwn(fields, key)) {
      fields[key] = "";
    }
  }
}

const visibleFields = computed(() =>
  parsedKeys.value.map((key) => ({
    key,
    label: fieldLabel(key),
  })),
);

const emptyHint = computed(() =>
  mode.value === "pdf" ? "PDF 没有 {{变量}}" : "当前内容没有 {{变量}}",
);

watch(
  [mode, command],
  () => {
    if (mode.value === "raw") {
      syncFields(listPlaceholders(command.value));
    } else if (mode.value === "pdf") {
      parsedKeys.value = [];
    }
  },
  { immediate: true },
);

watch([mode, rawFile], async ([nextMode, file]) => {
  if (nextMode !== "file") {
    return;
  }
  if (!file) {
    syncFields(listPlaceholders(ZPL_TEMPLATE));
    return;
  }
  syncFields(listPlaceholders(new Uint8Array(await file.arrayBuffer())));
});

function errorText(error: unknown): string {
  if (error instanceof PrintBridgeError) {
    return error.message.replace(/\.$/, "");
  }
  return error instanceof Error ? error.message : String(error);
}

function bindClient(next: PrintBridgeClient): void {
  unsubs.push(
    next.on("connect", () => {
      connected.value = true;
    }),
    next.on("disconnect", () => {
      connected.value = false;
      setStatus("已断开", "bad");
    }),
    next.on("status", (event) => {
      if (event.status === "failed") {
        setStatus(event.message || "打印失败", "bad");
        return;
      }
      if ((event.status === "submitted" || event.status === "completed") && tone.value !== "ok") {
        setStatus("已发送", "ok");
      }
    }),
    next.on("error", (error) => {
      setStatus(errorText(error), "bad");
    }),
  );
}

function disposeClient(): void {
  unsubs.splice(0).forEach((off) => off());
  client?.disconnect();
  client = null;
  connected.value = false;
}

async function refreshPrinters(): Promise<void> {
  if (!client?.isConnected()) {
    return;
  }
  printers.value = await client.getPrintersList();
  if (!printers.value.some((item) => item.name === printerName.value)) {
    printerName.value = "";
  }
}

async function connect(): Promise<void> {
  busy.value = true;
  setStatus("正在连接…");
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
    setStatus(printers.value.length ? "已连接" : "已连接，未发现打印机");
  } catch (error) {
    disposeClient();
    const code = error instanceof PrintBridgeError ? error.code : "";
    if (code === "ORIGIN_NOT_ALLOWED") {
      setStatus(`未连接，把本页 Origin 加进白名单：${origin.value || "当前页面"}`, "bad");
    } else {
      setStatus(errorText(error) || "未连接，请先启动印枢", "bad");
    }
  } finally {
    busy.value = false;
  }
}

function pickFile(event: Event, target: "raw" | "pdf"): void {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  if (target === "raw") {
    rawFile.value = file;
    return;
  }
  pdfFile.value = file;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("无法读取文件"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("读取失败"));
    reader.readAsDataURL(file);
  });
}

async function saveConfig(): Promise<void> {
  localStorage.setItem("pb.host", host.value.trim() || "127.0.0.1");
  localStorage.setItem("pb.port", String(Number(port.value) || 17890));
  showConfig.value = false;
  await connect();
}

async function printJob(): Promise<void> {
  if (!client?.isConnected()) {
    await connect();
    if (!client?.isConnected()) {
      return;
    }
  }
  busy.value = true;
  setStatus("发送中…");
  await nextTick();
  try {
    if (mode.value === "pdf") {
      if (!pdfFile.value) {
        setStatus("请先选择 PDF", "bad");
        return;
      }
      await client.print({
        type: "pdf",
        printerName: printerName.value,
        fileUrl: await readAsDataUrl(pdfFile.value),
        copies: 1,
        paper: { widthMm: 210, heightMm: 297 },
      });
    } else if (mode.value === "file") {
      if (rawFile.value) {
        await printRawFile(client, printerName.value, rawFile.value, fields, {
          rasterizeCjk: rasterizeCjk.value,
        });
      } else {
        await printRawUrl(client, printerName.value, labelZplUrl, fields, {
          rasterizeCjk: rasterizeCjk.value,
        });
      }
    } else {
      await printRawLabel(client, printerName.value, command.value, fields, {
        rasterizeCjk: rasterizeCjk.value,
      });
    }
    setStatus("已发送", "ok");
  } catch (error) {
    setStatus(errorText(error), "bad");
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  origin.value = window.location.origin;
  void connect();
});

onUnmounted(() => {
  disposeClient();
});
</script>

<template>
  <div class="layout">
  <div class="page">
    <aside>
      <h2>变量</h2>
      <p v-if="!visibleFields.length" class="empty">{{ emptyHint }}</p>
      <div v-else class="form">
        <label v-for="item in visibleFields" :key="item.key">
          <span class="field-name">
            {{ item.label }}
            <code>{{ token(item.key) }}</code>
          </span>
          <input v-model="fields[item.key]" :name="item.key" autocomplete="off" />
        </label>
      </div>
    </aside>

    <div class="main">
      <header>
        <div>
          <h1>打印</h1>
          <p class="hint">选打印机、填变量、点打印。同事用本页局域网地址打开，会连这台电脑上的印枢。</p>
        </div>
        <p :class="['state', tone]">{{ status }}</p>
      </header>

      <label>
        印枢
        <span class="endpoint">
          <input v-model.trim="host" placeholder="地址" autocomplete="off" />
          <input v-model.number="port" type="number" min="1" max="65535" />
          <button type="button" class="link" :disabled="busy" @click="saveConfig">连接</button>
        </span>
      </label>

      <label>
        打印机
        <select v-model="printerName" :disabled="!printers.length">
          <option value="">{{ printers.length ? "请选择打印机" : "无可用打印机" }}</option>
          <option v-for="item in printers" :key="item.name" :value="item.name">
            {{ item.name }}
          </option>
        </select>
      </label>

      <div class="modes" role="tablist">
        <button type="button" role="tab" :aria-selected="mode === 'pdf'" :class="{ on: mode === 'pdf' }" @click="mode = 'pdf'">
          PDF
        </button>
        <button type="button" role="tab" :aria-selected="mode === 'raw'" :class="{ on: mode === 'raw' }" @click="mode = 'raw'">
          RAW
        </button>
        <button type="button" role="tab" :aria-selected="mode === 'file'" :class="{ on: mode === 'file' }" @click="mode = 'file'">
          文件
        </button>
      </div>

      <label v-if="mode === 'raw'">
        指令
        <textarea v-model="command" rows="12" spellcheck="false" />
      </label>

      <label v-if="mode !== 'pdf'" class="check">
        <input v-model="rasterizeCjk" type="checkbox" />
        汉字、符号画成图再发送（机子无需中文字库）
      </label>

      <label v-if="mode === 'file'" class="file">
        RAW 文件
        <button type="button" class="link" @click="rawInput?.click()">
          {{ rawFile ? rawFile.name : rawFileHint }}
        </button>
        <input
          ref="rawInput"
          type="file"
          accept=".zpl,.prn,.raw,.dmi,.txt,application/octet-stream"
          hidden
          @change="pickFile($event, 'raw')"
        />
      </label>

      <label v-if="mode === 'pdf'" class="file">
        PDF 文件
        <button type="button" class="link" @click="pdfInput?.click()">
          {{ pdfFile ? pdfFile.name : "选择 PDF" }}
        </button>
        <input ref="pdfInput" type="file" accept="application/pdf,.pdf" hidden @change="pickFile($event, 'pdf')" />
      </label>

      <button type="button" class="submit" :disabled="!canPrint" @click="printJob">
        {{ busy ? "发送中…" : "打印" }}
      </button>

      <button type="button" class="link config-link" @click="showConfig = !showConfig">配置</button>

      <section v-if="showConfig" class="config">
        <label>
          本页 Origin
          <input :value="origin" readonly />
        </label>
        <p class="hint">把上面的 Origin 加进印枢「网站」。同事用局域网地址打开本页，打印会发到这台电脑的印枢。</p>
      </section>
    </div>
  </div>

  <section class="steps">
    <h2>接入步骤</h2>
    <CodeFold v-for="step in GUIDE_STEPS" :key="step.title" :title="step.title" :code="step.code" />
  </section>
  </div>
</template>

<style scoped>
.layout {
  width: min(1120px, calc(100% - 40px));
  margin: 40px auto;
}

.page {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.7fr);
  align-items: start;
  background: var(--card);
  border: 1px solid var(--line);
}

.steps {
  margin-top: 16px;
  padding: 24px 28px 12px;
  background: var(--card);
  border: 1px solid var(--line);
}

aside {
  padding: 24px 24px 28px;
  border-right: 1px solid var(--line);
}

h2 {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
}

.main {
  padding: 28px 28px 32px;
}

header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 28px;
}

h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.state {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

.state.ok {
  color: var(--ok);
}

.state.bad {
  color: var(--bad);
}

label {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
  color: var(--muted);
  font-size: 13px;
}

.endpoint {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 88px auto;
  align-items: center;
  gap: 8px;
}

.empty {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
}

aside label {
  margin-bottom: 0;
}

.field-name {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.field-name code {
  color: var(--text);
  font-family: "SF Mono", Menlo, Consolas, monospace;
  font-size: 11px;
}

select,
input,
textarea {
  width: 100%;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 0;
  padding: 8px 10px;
}

select:focus,
input:focus,
textarea:focus {
  outline: 1px solid var(--focus);
  outline-offset: 0;
}

textarea {
  resize: vertical;
  min-height: 200px;
  font-family: "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text);
}

.modes {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  margin-bottom: 20px;
  border: 1px solid var(--line);
}

.modes button {
  border: 0;
  background: #fff;
  padding: 8px 0;
}

.modes .on {
  background: var(--text);
  color: #fff;
}

.file {
  margin-bottom: 24px;
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

.check input {
  width: auto;
}

.link,
.link:focus {
  border: 0;
  background: none;
  padding: 0;
  text-align: left;
  color: var(--text);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.submit {
  width: 100%;
  border: 0;
  background: var(--text);
  color: #fff;
  padding: 10px 12px;
}

.config-link {
  display: block;
  width: 100%;
  margin-top: 16px;
  text-align: center;
  color: var(--muted);
}

.config {
  margin-top: 20px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

@media (max-width: 800px) {
  .page {
    grid-template-columns: 1fr;
  }

  aside {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .form {
    grid-template-columns: 1fr;
  }
}
</style>
