import React from "react";

interface MetricProps {
  children: React.ReactNode;
  className?: string;
  isMono?: boolean;
}

export function Metric({ children, className = "", isMono = true }: MetricProps) {
  return (
    <div
      className={`text-2xl sm:text-3xl font-bold tracking-tight text-white ${
        isMono ? "font-mono" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function Text({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs sm:text-sm text-zinc-400 font-medium ${className}`}>{children}</p>;
}
