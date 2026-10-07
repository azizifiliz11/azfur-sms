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
      bg: "bg-emerald-950/40 border-emerald-800/40 text-emerald-200",
      title: "text-emerald-300",
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
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
      bg: "bg-blue-950/40 border-blue-800/40 text-blue-200",
      title: "text-blue-300",
      icon: <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />,
    },
  };

  const style = colorMap[color];

  return (
    <div className={`flex gap-3 rounded-xl border p-3.5 text-xs sm:text-sm ${style.bg} ${className}`}>
      {icon || style.icon}
      <div className="space-y-0.5">
        <h4 className={`font-semibold ${style.title}`}>{title}</h4>
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
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  };

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {showLabel && (
        <div className="flex justify-between text-xs text-zinc-400 font-medium">
          <span>Başarı Oranı</span>
          <span className="font-mono text-zinc-200">%{percentage.toFixed(0)}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800/80">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColors[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
