"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { haptic } from "@/lib/haptic";
import { AppDialogRequest, resolveAppDialog, subscribeAppDialogs } from "@/lib/app-dialog";

const TONES = {
  info: { Icon: Info, box: "bg-brand/15 border-brand/30 text-brand", title: "Bilgi" },
  success: { Icon: CheckCircle2, box: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400", title: "Başarılı" },
  warning: { Icon: AlertTriangle, box: "bg-amber-500/15 border-amber-500/30 text-amber-400", title: "Uyarı" },
  error: { Icon: XCircle, box: "bg-rose-500/15 border-rose-500/30 text-rose-400", title: "Hata" },
};

/** lib/app-dialog.ts ile açılan pencereleri sırayla (en eskisi önce) gösterir. */
export function AppDialogHost() {
  const [queue, setQueue] = useState<AppDialogRequest[]>([]);
  useEffect(() => subscribeAppDialogs(setQueue), []);

  const current = queue[0];
  if (!current) return null;
  return <DialogView key={current.id} req={current} />;
}

function DialogView({ req }: { req: AppDialogRequest }) {
  const [value, setValue] = useState(req.defaultValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const tone = TONES[req.tone];

  useEffect(() => {
    if (req.tone === "error") haptic.error();
    else if (req.tone === "success") haptic.success();
    else haptic.impact("light");
    if (req.kind === "prompt") inputRef.current?.focus();
  }, [req]);

  const cancelValue = req.kind === "confirm" ? false : req.kind === "prompt" ? null : undefined;
  const okValue = req.kind === "confirm" ? true : req.kind === "prompt" ? value : undefined;
  const close = (v: unknown) => resolveAppDialog(req.id, v);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(cancelValue);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => req.kind === "alert" && close(undefined)}
    >
      <div
        role={req.kind === "alert" ? "alertdialog" : "dialog"}
        aria-modal="true"
        className="w-full max-w-sm bg-background border border-border rounded-3xl p-5 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35)] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tone.box}`}>
            <tone.Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-sm font-semibold text-foreground">{req.title || (req.kind === "confirm" ? "Onay" : tone.title)}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground whitespace-pre-line break-words">{req.message}</p>
          </div>
        </div>

        {req.kind === "prompt" && (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && close(value)}
            placeholder={req.placeholder}
            className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-brand/60"
          />
        )}

        <div className="flex gap-2">
          {req.kind !== "alert" && (
            <button
              type="button"
              onClick={() => close(cancelValue)}
              className="h-10 flex-1 rounded-full border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              {req.cancelText || "Vazgeç"}
            </button>
          )}
          <button
            type="button"
            autoFocus={req.kind !== "prompt"}
            onClick={() => close(okValue)}
            className={`h-10 flex-1 rounded-full text-xs font-semibold transition-colors ${
              req.destructive ? "bg-rose-500 text-white hover:bg-rose-500/90" : "bg-foreground text-background hover:bg-foreground/85"
            }`}
          >
            {req.confirmText || (req.kind === "alert" ? "Tamam" : "Onayla")}
          </button>
        </div>
      </div>
    </div>
  );
}
