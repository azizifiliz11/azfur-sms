"use client";

// Cult UI — Copy Button (https://www.cult-ui.com/docs/components/copy-button)
// shadcn Button yerine düz <button>; etiket (label) desteği ve Telegram haptik geri bildirimi eklendi.
import * as React from "react";
import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptic";

const ICON_SPRING = {
  type: "spring" as const,
  duration: 0.3,
  bounce: 0,
};

function iconMotion(reduceMotion: boolean) {
  if (reduceMotion) {
    return {
      initial: { opacity: 1, scale: 1, filter: "blur(0px)" },
      animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
      exit: { opacity: 1, scale: 1, filter: "blur(0px)" },
      transition: { duration: 0 },
    };
  }
  return {
    initial: { opacity: 0, scale: 0.25, filter: "blur(4px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 0.25, filter: "blur(4px)" },
    transition: ICON_SPRING,
  };
}

function legacyCopyToClipboard(value: string) {
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  textArea.style.pointerEvents = "none";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, value.length);

  let hasCopied = false;
  try {
    hasCopied = document.execCommand("copy");
  } catch {
    hasCopied = false;
  }

  document.body.removeChild(textArea);
  return hasCopied;
}

export async function copyToClipboardWithMeta(value: string) {
  if (typeof window === "undefined" || !value) {
    return false;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return legacyCopyToClipboard(value);
    }
  }
  return legacyCopyToClipboard(value);
}

type CopyButtonProps = Omit<React.ComponentProps<"button">, "value" | "children"> & {
  value: string;
  /** Simgenin yanında gösterilecek metin; verilmezse yalnızca simge */
  label?: string;
  copiedLabel?: string;
  onCopied?: () => void;
};

export function CopyButton({
  value,
  label,
  copiedLabel = "Kopyalandı",
  onCopied,
  className,
  onClick,
  ...props
}: CopyButtonProps) {
  const [hasCopied, setHasCopied] = React.useState(false);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    if (hasCopied) {
      const timer = setTimeout(() => setHasCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [hasCopied]);

  const motionProps = iconMotion(!!reduceMotion);

  return (
    <button
      type="button"
      aria-label={hasCopied ? "Panoya kopyalandı" : "Panoya kopyala"}
      className={cn(
        "relative inline-flex shrink-0 touch-manipulation items-center justify-center gap-1.5 overflow-hidden rounded-full transition-colors motion-safe:active:scale-[0.96]",
        "before:absolute before:-inset-2 before:z-[-1] before:content-['']",
        className
      )}
      data-copied={hasCopied}
      data-slot="copy-button"
      onClick={async (event) => {
        event.stopPropagation();
        onClick?.(event);
        const ok = await copyToClipboardWithMeta(value);
        if (ok) {
          haptic.success();
          setHasCopied(true);
          onCopied?.();
        }
      }}
      {...props}
    >
      <span aria-atomic="true" aria-live="polite" className="sr-only">
        {hasCopied ? copiedLabel : ""}
      </span>
      <span aria-hidden="true" className="relative inline-flex size-4 items-center justify-center">
        <AnimatePresence initial={false} mode="sync">
          {hasCopied ? (
            <motion.span className="absolute inset-0 flex items-center justify-center" key="check" {...motionProps}>
              <Check className="size-4" strokeWidth={2} />
            </motion.span>
          ) : (
            <motion.span className="absolute inset-0 flex items-center justify-center" key="copy" {...motionProps}>
              <Copy className="size-4" strokeWidth={2} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {label && <span aria-hidden="true">{hasCopied ? copiedLabel : label}</span>}
    </button>
  );
}
