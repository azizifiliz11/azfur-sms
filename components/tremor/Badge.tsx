import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  color?: "emerald" | "amber" | "rose" | "blue" | "zinc" | "purple";
  hasPing?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function Badge({
  children,
  color = "emerald",
  hasPing = false,
  className = "",
  size = "md",
}: BadgeProps) {
  const colorStyles = {
    emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    rose: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    blue: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    purple: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    zinc: "bg-zinc-800 text-zinc-300 border-zinc-700/50",
  };

  const pingDotColors = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    blue: "bg-blue-400",
    purple: "bg-purple-400",
    zinc: "bg-zinc-400",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border shadow-sm ${sizeStyles[size]} ${colorStyles[color]} ${className}`}
    >
      {hasPing && (
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pingDotColors[color]}`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${pingDotColors[color]}`}
          />
        </span>
      )}
      {children}
    </span>
  );
}
