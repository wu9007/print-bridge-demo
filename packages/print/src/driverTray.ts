export type TrayPrinter = {
  name: string;
  online: boolean;
  status: string;
};

export class DriverTrayError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "DriverTrayError";
  }
}

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: DriverTrayError) => void;
};

type TrayResponse = {
  success?: boolean;
  requestId?: string;
  data?: unknown;
  errorCode?: string;
  errorMessage?: string;
};

/** 启奥驱动助手：本机 ws://127.0.0.1:21594/pro/ws */
export class DriverTrayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private seq = 0;
  private connected = false;
  private readonly listeners = {
    connect: new Set<() => void>(),
    disconnect: new Set<() => void>(),
  };

  constructor(private readonly options: { host?: string; port?: number } = {}) {}

  url(): string {
    const host = this.options.host?.trim() || "127.0.0.1";
    const port = this.options.port || 21594;
    return `ws://${host}:${port}/pro/ws`;
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
        reject(new DriverTrayError("连接超时", "CONNECTION_TIMEOUT"));
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
        reject(new DriverTrayError("未连接，请先启动驱动助手", "CONNECTION_FAILED"));
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

  async getPrintersList(): Promise<TrayPrinter[]> {
    const data = await this.request<{ printers?: unknown; items?: unknown }>("listSystemPrinters");
    const source = Array.isArray(data?.items) && data.items.length ? data.items : data?.printers;
    const raw = Array.isArray(source) ? source : [];
    return raw.map(asPrinter).filter((item): item is TrayPrinter => item !== null);
  }

  async printZpl(req: { printerName: string; zpl?: string; zplBase64?: string }): Promise<void> {
    const zplBase64 = req.zplBase64 || textToBase64(req.zpl || "");
    if (!zplBase64) {
      throw new DriverTrayError("ZPL 为空", "INVALID_DATA");
    }
    await this.request("printZpl", {
      printerName: req.printerName,
      data: { zplBase64 },
    });
  }

  /** 托盘原有 printPdf：PDFBox 栅格后再打，和 printZpl 不是一条路。 */
  async printPdf(req: { printerName: string; pdf: Uint8Array | string }): Promise<void> {
    const pdfBase64 = typeof req.pdf === "string" ? req.pdf : bytesToBase64(req.pdf);
    if (!pdfBase64) {
      throw new DriverTrayError("PDF 为空", "INVALID_DATA");
    }
    await this.request("printPdf", {
      printerName: req.printerName,
      data: { pdfBase64 },
    });
  }

  private async request<T = unknown>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
    if (!this.isConnected() || !this.ws) {
      throw new DriverTrayError("未连接", "NOT_CONNECTED");
    }
    const requestId = `zpl-${Date.now()}-${++this.seq}`;
    const timeoutMs = action === "printZpl" || action === "printPdf" ? 60_000 : 10_000;
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new DriverTrayError("请求超时", "TIMEOUT"));
      }, timeoutMs);
      this.pending.set(requestId, {
        resolve: (value) => {
          window.clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error) => {
          window.clearTimeout(timer);
          reject(error);
        },
      });
      this.ws!.send(JSON.stringify({ device: "printer", action, requestId, ...extra }));
    });
  }

  private onMessage(raw: string): void {
    let msg: TrayResponse;
    try {
      msg = JSON.parse(raw) as TrayResponse;
    } catch {
      return;
    }
    if (!msg.requestId) {
      return;
    }
    const pending = this.pending.get(msg.requestId);
    if (!pending) {
      return;
    }
    this.pending.delete(msg.requestId);
    if (msg.success === false) {
      pending.reject(new DriverTrayError(msg.errorMessage || "托盘返回失败", msg.errorCode));
      return;
    }
    pending.resolve(msg.data);
  }

  private failAll(message: string): void {
    for (const [id, pending] of this.pending) {
      pending.reject(new DriverTrayError(message, "NOT_CONNECTED"));
      this.pending.delete(id);
    }
  }
}

function asPrinter(value: unknown): TrayPrinter | null {
  if (typeof value === "string" && value.trim()) {
    return { name: value.trim(), online: false, status: "未知" };
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as { name?: unknown; online?: unknown; status?: unknown };
  if (typeof item.name !== "string" || !item.name.trim()) {
    return null;
  }
  const online = item.online === true;
  const status =
    typeof item.status === "string" && item.status.trim()
      ? item.status
      : online
        ? "在线"
        : "离线";
  return { name: item.name.trim(), online, status };
}

function textToBase64(text: string): string {
  return btoa(bytesToBinary(new TextEncoder().encode(text.replace(/<STX>/gi, "\x02"))));
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes));
}

function bytesToBinary(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return binary;
}
