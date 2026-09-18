export type YinshuPrinter = {
  name: string;
  online: boolean;
  status: string;
  isDefault?: boolean;
};

export class YinshuError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "YinshuError";
  }
}

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: YinshuError) => void;
};

type ServerMessage = {
  type?: string;
  request_id?: string;
  printers?: unknown;
  job_id?: string;
  status?: string;
  message?: string;
  error_code?: string;
};

/** 印枢：本机 ws://127.0.0.1:17890/ws */
export class YinshuClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private seq = 0;
  private connected = false;
  private readonly listeners = {
    connect: new Set<() => void>(),
    disconnect: new Set<() => void>(),
  };

  constructor(private readonly options: { host?: string; port?: number } = {}) {}

  private url(): string {
    const host = this.options.host?.trim() || "127.0.0.1";
    const port = this.options.port || 17890;
    return `ws://${host}:${port}/ws`;
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  on(event: "connect" | "disconnect", fn: () => void): () => void {
    this.listeners[event].add(fn);
    return () => this.listeners[event].delete(fn);
  }

  async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }
    this.disconnect();
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(this.url());
      this.ws = ws;
      const timer = window.setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        ws.close();
        reject(new YinshuError("连接超时", "CONNECTION_TIMEOUT"));
      }, 8000);
      ws.onopen = () => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timer);
        this.connected = true;
        this.listeners.connect.forEach((fn) => fn());
        resolve();
      };
      ws.onerror = () => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timer);
        reject(
          new YinshuError(
            "未连接。请确认印枢已启动，并且网站名单包含当前页面。",
            "CONNECTION_FAILED",
          ),
        );
      };
      ws.onclose = () => {
        this.connected = false;
        this.failAll("已断开");
        this.listeners.disconnect.forEach((fn) => fn());
      };
      ws.onmessage = (event) => this.onMessage(String(event.data));
    });
  }

  disconnect(): void {
    this.failAll("已断开");
    const ws = this.ws;
    this.ws = null;
    this.connected = false;
    ws?.close();
  }

  async getPrintersList(): Promise<YinshuPrinter[]> {
    const data = await this.request<{ printers?: unknown }>("get_printers_list");
    const raw = Array.isArray(data.printers) ? data.printers : [];
    return raw.map(asPrinter).filter((item): item is YinshuPrinter => item !== null);
  }

  async sendRaw(req: { printerName: string; zpl?: string; zplBase64?: string }): Promise<void> {
    const data_base64 = req.zplBase64 || textToBase64(req.zpl || "");
    if (!data_base64) {
      throw new YinshuError("ZPL 为空", "INVALID_DATA");
    }
    await this.request("print", {
      job_id: this.nextId("job"),
      format: "raw",
      printer_name: req.printerName,
      data_base64,
    });
  }

  private nextId(prefix: string): string {
    return `${prefix}-${Date.now()}-${++this.seq}`;
  }

  private async request<T = unknown>(
    type: string,
    extra: Record<string, unknown> = {},
  ): Promise<T> {
    if (!this.isConnected() || !this.ws) {
      throw new YinshuError("未连接", "NOT_CONNECTED");
    }
    const request_id = this.nextId("req");
    const timeoutMs = type === "print" ? 60_000 : 10_000;
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(request_id);
        reject(new YinshuError("请求超时", "TIMEOUT"));
      }, timeoutMs);
      this.pending.set(request_id, {
        resolve: (value) => {
          window.clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error) => {
          window.clearTimeout(timer);
          reject(error);
        },
      });
      this.ws!.send(JSON.stringify({ type, request_id, ...extra }));
    });
  }

  private onMessage(raw: string): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    const requestId = msg.request_id;
    if (!requestId) {
      return;
    }
    const pending = this.pending.get(requestId);
    if (!pending) {
      return;
    }
    if (msg.type === "error") {
      this.pending.delete(requestId);
      pending.reject(fromProtocolError(msg.error_code, msg.message));
      return;
    }
    if (msg.type === "printers_list") {
      this.pending.delete(requestId);
      pending.resolve({ printers: msg.printers });
      return;
    }
    if (msg.type === "job_status") {
      const status = msg.status ?? "";
      if (status === "failed" || status === "cancelled") {
        this.pending.delete(requestId);
        pending.reject(new YinshuError(msg.message || "打印失败", status.toUpperCase()));
        return;
      }
      if (status === "queued" || status === "submitted" || status === "completed") {
        this.pending.delete(requestId);
        pending.resolve({ job_id: msg.job_id, status });
      }
    }
  }

  private failAll(message: string): void {
    for (const [id, pending] of this.pending) {
      pending.reject(new YinshuError(message, "NOT_CONNECTED"));
      this.pending.delete(id);
    }
  }
}

function asPrinter(value: unknown): YinshuPrinter | null {
  if (typeof value === "string" && value.trim()) {
    return { name: value.trim(), online: false, status: "未知" };
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as {
    name?: unknown;
    is_default?: unknown;
    availability?: unknown;
  };
  if (typeof item.name !== "string" || !item.name.trim()) {
    return null;
  }
  const availability = item.availability;
  const online = availability !== "unavailable";
  const status =
    availability === "unavailable" ? "离线" : availability === "available" ? "在线" : "未知";
  return {
    name: item.name.trim(),
    online,
    status,
    isDefault: item.is_default === true,
  };
}

/** 默认打印机，否则第一台在线的。 */
export function pickPrinter(printers: YinshuPrinter[]): string {
  const ready = printers.filter((item) => item.online);
  const preferred = ready.find((item) => item.isDefault) ?? ready[0];
  if (!preferred) {
    throw new YinshuError("没有在线打印机", "NO_PRINTER");
  }
  return preferred.name;
}

function fromProtocolError(code?: string, message?: string): YinshuError {
  if (code === "ORIGIN_NOT_ALLOWED") {
    return new YinshuError("当前页面不在印枢网站名单里", code);
  }
  if (code === "PRINTER_NOT_FOUND" || code === "PRINTER_NOT_CONFIGURED") {
    return new YinshuError(message || "未找到打印机", code);
  }
  return new YinshuError(message || "印枢返回失败", code);
}

function textToBase64(text: string): string {
  return btoa(bytesToBinary(new TextEncoder().encode(text.replace(/<STX>/gi, "\x02"))));
}

function bytesToBinary(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return binary;
}
