/**
 * Mini App içi uyarı / onay / metin girişi pencereleri.
 * Tarayıcının alert/confirm/prompt pencereleri Telegram WebView'da sayfa adresiyle, uygulamadan kopuk
 * görünür; bunların yerine <AppDialogHost /> tarafından çizilen pencereler kullanılır.
 */

export type AppDialogTone = "info" | "success" | "error" | "warning";

export interface AppDialogRequest {
  id: number;
  kind: "alert" | "confirm" | "prompt";
  message: string;
  title?: string;
  tone: AppDialogTone;
  confirmText?: string;
  cancelText?: string;
  defaultValue?: string;
  placeholder?: string;
  destructive?: boolean;
  resolve: (value: unknown) => void;
}

export interface AppDialogOptions {
  title?: string;
  tone?: AppDialogTone;
  confirmText?: string;
  cancelText?: string;
  /** Onay butonu kırmızı (silme, iptal gibi geri alınamaz işlemler) */
  destructive?: boolean;
}

type Listener = (queue: AppDialogRequest[]) => void;

let queue: AppDialogRequest[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(queue);
}

export function subscribeAppDialogs(listener: Listener): () => void {
  listeners.add(listener);
  listener(queue);
  return () => {
    listeners.delete(listener);
  };
}

export function resolveAppDialog(id: number, value: unknown): void {
  const req = queue.find((r) => r.id === id);
  if (!req) return;
  queue = queue.filter((r) => r.id !== id);
  emit();
  req.resolve(value);
}

function open<T>(req: Omit<AppDialogRequest, "id" | "resolve" | "tone"> & { tone?: AppDialogTone }): Promise<T> {
  // Sunucu tarafında (SSR) pencere açılamaz; güvenli varsayılan döner
  if (typeof window === "undefined") {
    return Promise.resolve((req.kind === "confirm" ? false : req.kind === "prompt" ? null : undefined) as T);
  }
  return new Promise<T>((resolve) => {
    queue = [...queue, { tone: "info", ...req, id: nextId++, resolve: resolve as (v: unknown) => void }];
    emit();
  });
}

function toneFromMessage(message: string): AppDialogTone {
  if (/^\s*(✅|🎉)/.test(message)) return "success";
  if (/^\s*(❌|⛔|🚫)|hata|başarısız|edilemedi|alınamadı|yüklenemedi|gönderilemedi|bulunamadı/i.test(message)) return "error";
  if (/^\s*(⚠️|⚠)|lütfen/i.test(message)) return "warning";
  return "info";
}

/** Bilgi / hata penceresi. Kapatılınca çözülür. */
export function appAlert(message: unknown, options: AppDialogOptions = {}): Promise<void> {
  const text = String(message ?? "");
  return open<void>({ kind: "alert", message: text, tone: options.tone ?? toneFromMessage(text), ...options });
}

/** Onay penceresi: "Onayla" → true, "Vazgeç" → false. */
export function appConfirm(message: unknown, options: AppDialogOptions = {}): Promise<boolean> {
  const text = String(message ?? "");
  return open<boolean>({ kind: "confirm", message: text, tone: options.tone ?? "warning", ...options });
}

/** Metin girişi: girilen metin, vazgeçilirse null. */
export function appPrompt(
  message: unknown,
  defaultValue = "",
  options: AppDialogOptions & { placeholder?: string } = {}
): Promise<string | null> {
  const text = String(message ?? "");
  return open<string | null>({ kind: "prompt", message: text, defaultValue, tone: options.tone ?? "info", ...options });
}
