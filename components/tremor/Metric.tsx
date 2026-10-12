import React from "react";

interface MetricProps {
  children: React.ReactNode;
  className?: string;
  isMono?: boolean;
}

export function Metric({ children, className = "", isMono = true }: MetricProps) {
  return (
    <div
      className={`text-3xl sm:text-4xl font-normal tracking-tighter text-foreground ${
        isMono ? "font-mono" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function Text({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs sm:text-sm text-muted-foreground font-medium ${className}`}>{children}</p>;
}
