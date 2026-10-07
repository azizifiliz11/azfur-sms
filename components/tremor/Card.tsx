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
    emerald: "border-emerald-500",
    blue: "border-blue-500",
    amber: "border-amber-500",
    red: "border-rose-500",
    purple: "border-purple-500",
  };

  const decorBorders = {
    top: `border-t-2 ${decorColors[decorationColor]}`,
    bottom: `border-b-2 ${decorColors[decorationColor]}`,
    left: `border-l-2 ${decorColors[decorationColor]}`,
    right: `border-r-2 ${decorColors[decorationColor]}`,
  };

  return (
    <div
      className={`relative rounded-2xl bg-[#11131a]/90 backdrop-blur-xl border border-white/[0.08] shadow-lg shadow-black/40 p-4 transition-all ${
        decoration ? decorBorders[decoration] : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
