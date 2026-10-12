"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, getCurrentTheme, getStoredTheme, setThemePreference, THEME_CHANGE_EVENT, ThemeMode } from "@/lib/theme";
import { haptic } from "@/lib/haptic";

// Axis şablonundaki ThemeToggle'ın görünümü
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = React.useState<ThemeMode | null>(null);

  React.useEffect(() => {
    const initial = getStoredTheme() ?? getCurrentTheme();
    applyTheme(initial);
    setMode(initial);

    // Profil > Ayarlar'dan tema değişirse anahtarı güncelle
    const sync = () => setMode(getCurrentTheme());
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, sync);
  }, []);

  if (!mode) {
    return <div className={`h-9 w-[72px] shrink-0 rounded-full border border-border ${className}`} />;
  }

  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={() => {
        haptic.selection();
        const next: ThemeMode = isDark ? "light" : "dark";
        setThemePreference(next);
        setMode(next);
      }}
      aria-label={isDark ? "Açık temaya geç" : "Koyu temaya geç"}
      className={`relative inline-flex h-9 w-[72px] shrink-0 items-center justify-center rounded-full border border-border bg-background/80 px-2 transition-colors ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute h-7 w-7 rounded-full bg-muted shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
        style={{ transform: `translateX(${isDark ? -18 : 18}px)` }}
      />
      <span className="relative z-10 flex w-full items-center justify-between">
        <Moon className="h-4 w-4 dark:text-secondary" aria-hidden="true" strokeWidth={1.8} style={{ opacity: isDark ? 1 : 0.35 }} />
        <Sun className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} style={{ opacity: isDark ? 0.35 : 1 }} />
      </span>
    </button>
  );
}
