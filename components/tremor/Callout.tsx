import React from "react";
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";

interface CalloutProps {
  title: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  color?: "emerald" | "amber" | "rose" | "blue";
  className?: string;
}

export function Callout({
  title,
  children,
  icon,
  color = "emerald",
  className = "",
}: CalloutProps) {
  const colorMap = {
    emerald: {
      bg: "bg-brand/10 border-brand/25 text-brand",
      title: "text-brand",
      icon: <CheckCircle2 className="w-5 h-5 text-brand shrink-0 mt-0.5" />,
    },
    amber: {
      bg: "bg-amber-950/40 border-amber-800/40 text-amber-200",
      title: "text-amber-300",
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
    },
    rose: {
      bg: "bg-rose-950/40 border-rose-800/40 text-rose-200",
      title: "text-rose-300",
      icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />,
    },
    blue: {
      bg: "bg-foreground/5 border-foreground/5 text-foreground",
      title: "text-foreground",
      icon: <Info className="w-5 h-5 text-foreground/90 shrink-0 mt-0.5" />,
    },
  };

  const style = colorMap[color];

  return (
    <div className={`flex gap-3 rounded-xl border p-3.5 text-xs sm:text-sm ${style.bg} ${className}`}>
      {icon || style.icon}
      <div className="space-y-0.5">
        <h4 className={`font-medium ${style.title}`}>{title}</h4>
        {children && <div className="opacity-90 leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: "emerald" | "blue" | "amber" | "rose";
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  color = "emerald",
  className = "",
  showLabel = false,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const barColors = {
    emerald: "bg-brand",
    blue: "bg-foreground/60",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  };

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {showLabel && (
        <div className="flex justify-between text-xs text-muted-foreground font-medium">
          <span>Başarı Oranı</span>
          <span className="font-mono text-foreground">%{percentage.toFixed(0)}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/80">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColors[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
