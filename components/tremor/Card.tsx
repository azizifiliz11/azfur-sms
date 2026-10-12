import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  decoration?: "top" | "bottom" | "left" | "right";
  decorationColor?: "emerald" | "blue" | "amber" | "red" | "purple";
}

export function Card({
  children,
  className = "",
  decoration,
  decorationColor = "emerald",
  ...props
}: CardProps) {
  const decorColors = {
    emerald: "border-brand",
    blue: "border-foreground/40",
    amber: "border-amber-500",
    red: "border-rose-500",
    purple: "border-foreground/40",
  };

  const decorBorders = {
    top: `border-t-2 ${decorColors[decorationColor]}`,
    bottom: `border-b-2 ${decorColors[decorationColor]}`,
    left: `border-l-2 ${decorColors[decorationColor]}`,
    right: `border-r-2 ${decorColors[decorationColor]}`,
  };

  return (
    <div
      className={`relative rounded-3xl bg-background/70 backdrop-blur-xl ring-1 ring-foreground/10 shadow-xs p-4 transition-all ${
        decoration ? decorBorders[decoration] : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
