<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { YinshuClient, YinshuError, listPlaceholders, printZpl, type YinshuPrinter } from "@yinshu/print-zpl";
import { CHONGQING_SAMPLE, FIELD_LABELS } from "./lib/bloodLabel";
import { buildTestPdf } from "./lib/testPdf";
import { ZPL_TEMPLATES, getTemplate, type TemplateId } from "./lib/zplTemplate";

type Tone = "muted" | "ok" | "bad";

const printers = ref<YinshuPrinter[]>([]);
const printerName = ref("");
const templateId = ref<TemplateId>("minimal");
const connected = ref(false);
const busy = ref(false);
const rasterizeCjk = ref(true);
const fields = reactive<Record<string, string>>({ ...CHONGQING_SAMPLE });
const parsedKeys = ref<string[]>([]);
const status = ref("正在连接…");
const tone = ref<Tone>("muted");
const currentTemplate = computed(() => getTemplate(templateId.value));

const canPrint = computed(
  () => !busy.value && connected.value && Boolean(printerName.value),
);

const labelPrinter = computed(() =>
  /citizen|zebra|zdesigner|cl-s|gx430|gk420|zd/i.test(printerName.value),
);

const canPrintPdf = computed(() => canPrint.value && !labelPrinter.value);

const visibleFields = computed(() =>
  parsedKeys.value.map((key) => ({
    key,
    label: FIELD_LABELS[key] ?? key,
  })),
);

let client: YinshuClient | null = null;
const unsubs: Array<() => void> = [];

function setStatus(next: string, nextTone: Tone = "muted"): void {
  status.value = next;
  tone.value = nextTone;
}

function errorText(error: unknown): string {
  if (error instanceof YinshuError) {
    return error.message.replace(/\.$/, "");
  }
  return error instanceof Error ? error.message : String(error);
}

function token(key: string): string {
  return `{{${key}}}`;
}

function syncFields(keys: string[]): void {
  parsedKeys.value = keys;
  for (const key of keys) {
    if (!Object.hasOwn(fields, key)) {
      fields[key] = "";
    }
  }
}

watch(
  () => currentTemplate.value.text,
  (text) => syncFields(listPlaceholders(text)),
  { immediate: true },
);

function disposeClient(): void {
  unsubs.splice(0).forEach((off) => off());
  client?.disconnect();
  client = null;
  connected.value = false;
}

function applyPrinters(next: YinshuPrinter[]): void {
  printers.value = next;
  if (!next.some((item) => item.name === printerName.value)) {
    printerName.value = "";
  }
}

function flag(item: YinshuPrinter): string {
  if (item.online) {
    return "在线";
  }
  return item.status === "已停用" ? "已停用" : "离线";
}

async function loadPrinters(): Promise<void> {
  if (!client?.isConnected()) {
    return;
  }
  applyPrinters(await client.getPrintersList());
}

async function connect(): Promise<void> {
  busy.value = true;
  setStatus("正在连接…");
  try {
    disposeClient();
    const next = new YinshuClient();
    unsubs.push(
      next.on("connect", () => {
        connected.value = true;
      }),
      next.on("disconnect", () => {
        connected.value = false;
        setStatus("已断开", "bad");
      }),
    );
    await next.connect();
    client = next;
    await loadPrinters();
    setStatus(printers.value.length ? "已连接" : "已连接，未发现打印机");
  } catch (error) {
    disposeClient();
    printers.value = [];
    setStatus(errorText(error) || "未连接。请确认印枢已启动，并且网站名单包含当前页面。", "bad");
  } finally {
    busy.value = false;
  }
}

async function refreshPrinters(): Promise<void> {
  if (!client?.isConnected()) {
    await connect();
    return;
  }
  busy.value = true;
  try {
    await loadPrinters();
    setStatus(printers.value.length ? "已连接" : "已连接，未发现打印机");
  } catch (error) {
    setStatus(errorText(error), "bad");
  } finally {
    busy.value = false;
  }
}

async function ensureClient(): Promise<boolean> {
  if (!client?.isConnected()) {
    await connect();
  }
  return Boolean(client?.isConnected());
}

async function printJob(): Promise<void> {
  if (!(await ensureClient()) || !client) {
    return;
  }
  busy.value = true;
  setStatus("发送中…");
  try {
    await printZpl(client, printerName.value, currentTemplate.value.text, fields, {
      rasterizeCjk: rasterizeCjk.value,
    });
    setStatus("已发送", "ok");
  } catch (error) {
    setStatus(errorText(error), "bad");
  } finally {
    busy.value = false;
  }
}

async function printPdfJob(): Promise<void> {
  if (!(await ensureClient()) || !client) {
    return;
  }
  busy.value = true;
  setStatus("PDF 发送中…");
  try {
    await client.printPdf({
      printerName: printerName.value,
      pdf: buildTestPdf(),
    });
    setStatus("PDF 已发送", "ok");
  } catch (error) {
    setStatus(errorText(error), "bad");
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void connect();
});

onUnmounted(() => {
  disposeClient();
});
</script>

<template>
  <div class="page">
    <aside>
      <h2>变量</h2>
      <p v-if="!visibleFields.length" class="empty">当前内容没有变量</p>
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
          <h1>印枢</h1>
          <p class="hint">填变量、转中文、发给本机印枢。模板用内容，不传路径。</p>
        </div>
        <p :class="['state', tone]">
          {{ status }}
          <button v-if="!connected" type="button" class="link" :disabled="busy" @click="connect">
            重新连接
          </button>
        </p>
      </header>

      <section class="printers-block">
        <div class="printers-head">
          <span>模板</span>
        </div>
        <div class="printers" role="listbox" aria-label="模板">
          <button
            v-for="item in ZPL_TEMPLATES"
            :key="item.id"
            type="button"
            role="option"
            :aria-selected="templateId === item.id"
            :class="['printer', { selected: templateId === item.id }]"
            @click="templateId = item.id"
          >
            <span class="name">{{ item.name }}</span>
          </button>
        </div>
      </section>

      <section class="printers-block">
        <div class="printers-head">
          <span>打印机</span>
          <button type="button" class="link" :disabled="busy" @click="refreshPrinters">刷新</button>
        </div>
        <p v-if="!printers.length" class="empty">{{ connected ? "无可用打印机" : "未连接" }}</p>
        <div v-else class="printers" role="listbox" :aria-label="'打印机'">
          <button
            v-for="item in printers"
            :key="item.name"
            type="button"
            role="option"
            :aria-selected="printerName === item.name"
            :class="['printer', { on: item.online, selected: printerName === item.name }]"
            @click="printerName = item.name"
          >
            <span class="dot" aria-hidden="true" />
            <span class="name">{{ item.name }}</span>
            <span class="flag">{{ flag(item) }}</span>
          </button>
        </div>
      </section>

      <label class="check">
        <input v-model="rasterizeCjk" type="checkbox" />
        汉字、符号画成图再发送
      </label>

      <button type="button" class="submit" :disabled="!canPrint" @click="printJob">
        {{ busy ? "发送中…" : "打印 ZPL" }}
      </button>
      <button type="button" class="ghost" :disabled="!canPrintPdf" @click="printPdfJob">
        测试 PDF
      </button>
      <p class="hint">
        {{
          labelPrinter
            ? "当前是标签机，PDF 测试已关掉，避免再烧标签纸。"
            : "PDF 走印枢 format=pdf，和 ZPL raw 无关。请打到激光机。"
        }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.page {
  width: min(1120px, calc(100% - 40px));
  margin: 40px auto;
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.7fr);
  align-items: start;
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
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
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

.printers-block {
  margin-bottom: 16px;
  color: var(--muted);
  font-size: 13px;
}

.printers-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}

.printers {
  border: 1px solid var(--line);
}

.printer {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: #fff;
  padding: 8px 10px;
  text-align: left;
}

.printer:last-child {
  border-bottom: 0;
}

.printer.selected {
  outline: 1px solid var(--focus);
  outline-offset: -1px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c6c6c6;
}

.printer.on .dot {
  background: var(--ok);
}

.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}

.flag {
  font-size: 12px;
}

.printer.on .flag {
  color: var(--ok);
}

input {
  width: 100%;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 0;
  padding: 8px 10px;
}

input:focus {
  outline: 1px solid var(--focus);
  outline-offset: 0;
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

.submit,
.ghost {
  width: 100%;
  padding: 10px 12px;
}

.submit {
  border: 0;
  background: var(--text);
  color: #fff;
}

.ghost {
  margin-top: 8px;
  border: 1px solid var(--line);
  background: #fff;
}

.ghost + .hint {
  margin-top: 10px;
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
