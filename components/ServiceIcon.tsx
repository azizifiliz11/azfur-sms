"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { serviceIconSources, serviceInitial } from "@/lib/service-icons";

interface ServiceIconProps {
  code: string | undefined | null;
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES = {
  xs: "h-4 w-4 text-[9px]",
  sm: "h-5 w-5 text-[10px]",
  md: "h-6 w-6 text-[11px]",
  lg: "h-9 w-9 text-sm",
};

/**
 * Hero-SMS servis simgesi. Görsel yüklenemezse sıradaki kaynağa, hiçbiri yoksa
 * Hero-SMS'teki gibi adın baş harfini taşıyan yuvarlak rozete düşer.
 */
export function ServiceIcon({ code, name, size = "md", className }: ServiceIconProps) {
  const sources = serviceIconSources(code);
  const [failed, setFailed] = useState<{ code: string | undefined | null; count: number }>({ code, count: 0 });
  // Servis değişince hata sayacı sıfırlanır
  const failCount = failed.code === code ? failed.count : 0;
  const src = sources[failCount];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden",
        SIZE_CLASSES[size],
        src ? "rounded-[25%]" : "rounded-full bg-brand font-semibold leading-none text-background",
        className
      )}
      title={name || undefined}
      aria-hidden="true"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailed({ code, count: failCount + 1 })}
        />
      ) : (
        serviceInitial(name, code)
      )}
    </span>
  );
}
